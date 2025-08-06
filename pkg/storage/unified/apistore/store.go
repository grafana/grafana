// SPDX-License-Identifier: AGPL-3.0-only
// Provenance-includes-location: https://github.com/kubernetes-sigs/apiserver-runtime/blob/main/pkg/experimental/storage/filepath/jsonfile_rest.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: The Kubernetes Authors.

package apistore

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"math/rand/v2"
	"net/http"
	"reflect"
	"strconv"
	"time"

	"github.com/bwmarrin/snowflake"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metaV1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/apiserver/pkg/storage/storagebackend"
	"k8s.io/apiserver/pkg/storage/storagebackend/factory"
	clientrest "k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"

	authtypes "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	secrets "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

const (
	MaxUpdateAttempts          = 30
	LargeObjectSupportEnabled  = true
	LargeObjectSupportDisabled = false
)

var _ storage.Interface = (*Storage)(nil)

type DefaultPermissionSetter = func(ctx context.Context, key *resourcepb.ResourceKey, id authtypes.AuthInfo, obj utils.GrafanaMetaAccessor) error

// Optional settings that apply to a single resource
type StorageOptions struct {
	// ????: should we constrain this to only dashboards for now?
	// Not yet clear if this is a good general solution, or just a stop-gap
	LargeObjectSupport LargeObjectSupport

	// Allow writing objects with metadata.annotations[grafana.app/folder]
	EnableFolderSupport bool

	// Add internalID label when missing
	RequireDeprecatedInternalID bool

	// Process inline secure values
	SecureValues secrets.InlineSecureValueSupport

	// Temporary fix to support adding default permissions AfterCreate
	Permissions DefaultPermissionSetter
}

// Storage implements storage.Interface and storage resources as JSON files on disk.
type Storage struct {
	gr           schema.GroupResource
	codec        runtime.Codec
	keyFunc      func(obj runtime.Object) (string, error)
	newFunc      func() runtime.Object
	newListFunc  func() runtime.Object
	getAttrsFunc storage.AttrFunc
	trigger      storage.IndexerFuncs
	indexers     *cache.Indexers

	store          resource.ResourceClient
	getKey         func(string) (*resourcepb.ResourceKey, error)
	snowflake      *snowflake.Node    // used to enforce internal ids
	configProvider RestConfigProvider // used for provisioning

	versioner storage.Versioner

	// Resource options like large object support
	opts StorageOptions
}

// ErrFileNotExists means the file doesn't actually exist.
var ErrFileNotExists = fmt.Errorf("file doesn't exist")

// ErrNamespaceNotExists means the directory for the namespace doesn't actually exist.
var ErrNamespaceNotExists = errors.New("namespace does not exist")

type RestConfigProvider interface {
	GetRestConfig(context.Context) (*clientrest.Config, error)
}

// NewStorage instantiates a new Storage.
func NewStorage(
	config *storagebackend.ConfigForResource,
	store resource.ResourceClient,
	keyFunc func(obj runtime.Object) (string, error),
	keyParser func(key string) (*resourcepb.ResourceKey, error),
	newFunc func() runtime.Object,
	newListFunc func() runtime.Object,
	getAttrsFunc storage.AttrFunc,
	trigger storage.IndexerFuncs,
	indexers *cache.Indexers,
	configProvider RestConfigProvider,
	opts StorageOptions,
) (storage.Interface, factory.DestroyFunc, error) {
	s := &Storage{
		store:          store,
		gr:             config.GroupResource,
		codec:          config.Codec,
		keyFunc:        keyFunc,
		newFunc:        newFunc,
		newListFunc:    newListFunc,
		getAttrsFunc:   getAttrsFunc,
		trigger:        trigger,
		indexers:       indexers,
		configProvider: configProvider,

		getKey: keyParser,

		versioner: &storage.APIObjectVersioner{},

		opts: opts,
	}

	if opts.RequireDeprecatedInternalID {
		node, err := snowflake.NewNode(rand.Int64N(1024))
		if err != nil {
			return nil, nil, err
		}
		s.snowflake = node
	}

	// The key parsing callback allows us to support the hardcoded paths from upstream tests
	if s.getKey == nil {
		s.getKey = func(key string) (*resourcepb.ResourceKey, error) {
			k, err := grafanaregistry.ParseKey(key)
			if err != nil {
				return nil, err
			}
			if k.Group == "" {
				return nil, apierrors.NewInternalError(fmt.Errorf("missing group in request"))
			}
			if k.Resource == "" {
				return nil, apierrors.NewInternalError(fmt.Errorf("missing resource in request"))
			}
			return &resourcepb.ResourceKey{
				Namespace: k.Namespace,
				Group:     k.Group,
				Resource:  k.Resource,
				Name:      k.Name,
			}, err
		}
	}

	return s, func() {}, nil
}

// GetCurrentResourceVersion implements storage.Interface.
// See: https://github.com/kubernetes/kubernetes/blob/v1.33.0/staging/src/k8s.io/apiserver/pkg/storage/etcd3/store.go#L647
func (s *Storage) GetCurrentResourceVersion(ctx context.Context) (uint64, error) {
	// Although not totally accurate, this is sufficient
	return uint64(time.Now().UnixMicro()), nil
}

func (s *Storage) Versioner() storage.Versioner {
	return s.versioner
}

func (s *Storage) convertToObject(data []byte, obj runtime.Object) (runtime.Object, error) {
	obj, _, err := s.codec.Decode(data, nil, obj)
	return obj, err
}

// Create adds a new object at a key unless it already exists. 'ttl' is time-to-live
// in seconds (0 means forever). If no error is returned and out is not nil, out will be
// set to the read value from database.
func (s *Storage) Create(ctx context.Context, key string, obj runtime.Object, out runtime.Object, ttl uint64) error {
	v, err := s.prepareObjectForStorage(ctx, obj)
	if err != nil {
		return s.handleManagedResourceRouting(ctx, err, resourcepb.WatchEvent_ADDED, key, obj, out)
	}
	req := &resourcepb.CreateRequest{
		Value: v.raw.Bytes(),
	}
	req.Key, err = s.getKey(key)
	if err != nil {
		return err
	}

	v.permissionCreator, err = afterCreatePermissionCreator(ctx, req.Key, v.grantPermissions, obj, s.opts.Permissions)
	if err != nil {
		return err
	}

	rsp, err := s.store.Create(ctx, req)
	if err != nil {
		return v.finish(ctx, resource.GetError(resource.AsErrorResult(err)), s)
	}
	if rsp.Error != nil {
		err = resource.GetError(rsp.Error)
		if rsp.Error.Code == http.StatusConflict {
			err = storage.NewKeyExistsError(key, 0)
		}
		return v.finish(ctx, err, s)
	}

	if _, err := s.convertToObject(req.Value, out); err != nil {
		return err
	}

	meta, err := utils.MetaAccessor(out)
	if err != nil {
		return err
	}
	meta.SetResourceVersionInt64(rsp.ResourceVersion)

	// set a timer to delete the file after ttl seconds
	if ttl > 0 {
		time.AfterFunc(time.Second*time.Duration(ttl), func() {
			if err := s.Delete(ctx, key, s.newFunc(), &storage.Preconditions{}, func(ctx context.Context, obj runtime.Object) error { return nil }, obj, storage.DeleteOptions{}); err != nil {
				panic(err)
			}
		})
	}

	return v.finish(ctx, nil, s)
}

// Delete removes the specified key and returns the value that existed at that spot.
// If key didn't exist, it will return NotFound storage error.
// If 'cachedExistingObject' is non-nil, it can be used as a suggestion about the
// current version of the object to avoid read operation from storage to get it.
// However, the implementations have to retry in case suggestion is stale.
func (s *Storage) Delete(
	ctx context.Context,
	key string,
	out runtime.Object,
	preconditions *storage.Preconditions,
	validateDeletion storage.ValidateObjectFunc,
	_ runtime.Object,
	opts storage.DeleteOptions,
) error {
	info, ok := authtypes.AuthInfoFrom(ctx)
	if !ok {
		return errors.New("missing auth info")
	}

	if err := s.Get(ctx, key, storage.GetOptions{}, out); err != nil {
		return err
	}

	k, err := s.getKey(key)
	if err != nil {
		return err
	}
	cmd := &resourcepb.DeleteRequest{Key: k}

	if preconditions != nil {
		if err := preconditions.Check(key, out); err != nil {
			return err
		}

		if preconditions.ResourceVersion != nil {
			cmd.ResourceVersion, err = strconv.ParseInt(*preconditions.ResourceVersion, 10, 64)
			if err != nil {
				return err
			}
		}
		if preconditions.UID != nil {
			cmd.Uid = string(*preconditions.UID)
		}
	}

	if validateDeletion != nil {
		if err := validateDeletion(ctx, out); err != nil {
			return err
		}
	}

	meta, err := utils.MetaAccessor(out)
	if err != nil {
		return fmt.Errorf("unable to read object %w", err)
	}
	if err = checkManagerPropertiesOnDelete(info, meta); err != nil {
		return s.handleManagedResourceRouting(ctx, err, resourcepb.WatchEvent_DELETED, key, out, out)
	}

	rsp, err := s.store.Delete(ctx, cmd)
	if err != nil {
		return resource.GetError(resource.AsErrorResult(err))
	}
	if rsp.Error != nil {
		return resource.GetError(rsp.Error)
	}

	if err = handleSecureValuesDelete(ctx, s.opts.SecureValues, meta); err != nil {
		logging.FromContext(ctx).Warn("failed to delete inline secure values", "err", err)
	}

	if err := s.versioner.UpdateObject(out, uint64(rsp.ResourceVersion)); err != nil {
		return err
	}
	return nil
}

// This version is not yet passing the watch tests
func (s *Storage) Watch(ctx context.Context, key string, opts storage.ListOptions) (watch.Interface, error) {
	k, err := s.getKey(key)
	if err != nil {
		return watch.NewEmptyWatch(), nil
	}

	req, predicate, err := toListRequest(k, opts)
	if err != nil {
		return watch.NewEmptyWatch(), nil
	}

	cmd := &resourcepb.WatchRequest{
		Since:               req.ResourceVersion,
		Options:             req.Options,
		SendInitialEvents:   false,
		AllowWatchBookmarks: opts.Predicate.AllowWatchBookmarks,
	}
	if opts.SendInitialEvents != nil {
		cmd.SendInitialEvents = *opts.SendInitialEvents
	}
	ctx, cancelWatch := context.WithCancel(ctx)
	client, err := s.store.Watch(ctx, cmd)
	if err != nil {
		// if the context was canceled, just return a new empty watch
		cancelWatch()
		if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) || errors.Is(err, io.EOF) {
			return watch.NewEmptyWatch(), nil
		}

		return nil, resource.GetError(resource.AsErrorResult(err))
	}

	reporter := apierrors.NewClientErrorReporter(500, "WATCH", "")
	decoder := newStreamDecoder(client, s.newFunc, predicate, s.codec, cancelWatch)

	return watch.NewStreamWatcher(decoder, reporter), nil
}

// Get unmarshals object found at key into objPtr. On a not found error, will either
// return a zero object of the requested type, or an error, depending on 'opts.ignoreNotFound'.
// Treats empty responses and nil response nodes exactly like a not found error.
// The returned contents may be delayed, but it is guaranteed that they will
// match 'opts.ResourceVersion' according 'opts.ResourceVersionMatch'.
func (s *Storage) Get(ctx context.Context, key string, opts storage.GetOptions, objPtr runtime.Object) error {
	var err error
	req := &resourcepb.ReadRequest{}
	req.Key, err = s.getKey(key)
	if err != nil {
		if opts.IgnoreNotFound {
			return runtime.SetZeroValue(objPtr)
		}
		return storage.NewKeyNotFoundError(key, 0)
	}

	if opts.ResourceVersion != "" {
		req.ResourceVersion, err = strconv.ParseInt(opts.ResourceVersion, 10, 64)
		if err != nil {
			return err
		}
	}

	rsp, err := s.store.Read(ctx, req)
	if err != nil {
		return resource.GetError(resource.AsErrorResult(err))
	}
	if rsp.Error != nil {
		if rsp.Error.Code == http.StatusNotFound {
			if opts.IgnoreNotFound {
				return runtime.SetZeroValue(objPtr)
			}
			return storage.NewKeyNotFoundError(key, req.ResourceVersion)
		}
		return resource.GetError(rsp.Error)
	}

	_, err = s.convertToObject(rsp.Value, objPtr)
	if err != nil {
		return err
	}
	return s.versioner.UpdateObject(objPtr, uint64(rsp.ResourceVersion))
}

// GetList unmarshalls objects found at key into a *List api object (an object
// that satisfies runtime.IsList definition).
// If 'opts.Recursive' is false, 'key' is used as an exact match. If `opts.Recursive'
// is true, 'key' is used as a prefix.
// The returned contents may be delayed, but it is guaranteed that they will
// match 'opts.ResourceVersion' according 'opts.ResourceVersionMatch'.
func (s *Storage) GetList(ctx context.Context, key string, opts storage.ListOptions, listObj runtime.Object) error {
	k, err := s.getKey(key)
	if err != nil {
		return err
	}

	req, predicate, err := toListRequest(k, opts)
	if err != nil {
		return err
	}

	rsp, err := s.store.List(ctx, req)
	if err != nil {
		return resource.GetError(resource.AsErrorResult(err))
	}
	if rsp.Error != nil {
		return resource.GetError(rsp.Error)
	}

	if err := s.validateMinimumResourceVersion(opts.ResourceVersion, uint64(rsp.ResourceVersion)); err != nil {
		return err
	}

	listPtr, err := meta.GetItemsPtr(listObj)
	if err != nil {
		return err
	}
	v, err := conversion.EnforcePtr(listPtr)
	if err != nil {
		return err
	}

	if v.IsNil() {
		v.Set(reflect.MakeSlice(v.Type(), 0, 0))
	}

	for _, item := range rsp.Items {
		obj, err := s.convertToObject(item.Value, s.newFunc())
		if err != nil {
			return err
		}
		if err := s.versioner.UpdateObject(obj, uint64(item.ResourceVersion)); err != nil {
			return err
		}

		if opts.ResourceVersionMatch == metaV1.ResourceVersionMatchExact {
			currentVersion, err := s.versioner.ObjectResourceVersion(obj)
			if err != nil {
				return err
			}
			expectedRV, err := s.versioner.ParseResourceVersion(opts.ResourceVersion)
			if err != nil {
				return err
			}
			if currentVersion != expectedRV {
				continue
			}
		}

		ok, err := predicate.Matches(obj)
		if err == nil && ok {
			v.Set(reflect.Append(v, reflect.ValueOf(obj).Elem()))
		}
	}

	var remainingItems *int64
	if rsp.RemainingItemCount > 0 {
		remainingItems = &rsp.RemainingItemCount
	}
	if err := s.versioner.UpdateList(listObj, uint64(rsp.ResourceVersion), rsp.NextPageToken, remainingItems); err != nil {
		return err
	}
	return nil
}

// GuaranteedUpdate keeps calling 'tryUpdate()' to update key 'key' (of type 'destination')
// retrying the update until success if there is index conflict.
// Note that object passed to tryUpdate may change across invocations of tryUpdate() if
// other writers are simultaneously updating it, so tryUpdate() needs to take into account
// the current contents of the object when deciding how the update object should look.
// If the key doesn't exist, it will return NotFound storage error if ignoreNotFound=false
// else `destination` will be set to the zero value of it's type.
// If the eventual successful invocation of `tryUpdate` returns an output with the same serialized
// contents as the input, it won't perform any update, but instead set `destination` to an object with those
// contents.
// If 'cachedExistingObject' is non-nil, it can be used as a suggestion about the
// current version of the object to avoid read operation from storage to get it.
// However, the implementations have to retry in case suggestion is stale.
// nolint:gocyclo
func (s *Storage) GuaranteedUpdate(
	ctx context.Context,
	key string,
	destination runtime.Object,
	ignoreNotFound bool,
	preconditions *storage.Preconditions,
	tryUpdate storage.UpdateFunc,
	cachedExistingObject runtime.Object,
) error {
	var (
		res           storage.ResponseMeta
		updatedObj    runtime.Object
		existingObj   runtime.Object
		existingBytes []byte
		err           error
	)
	req := &resourcepb.UpdateRequest{}
	req.Key, err = s.getKey(key)
	if err != nil {
		return err
	}
	if preconditions != nil && preconditions.ResourceVersion != nil {
		req.ResourceVersion, err = strconv.ParseInt(*preconditions.ResourceVersion, 10, 64)
		if err != nil {
			return err
		}
	}

	for attempt := 1; attempt <= MaxUpdateAttempts; attempt = attempt + 1 {
		// Read the latest value
		readResponse, err := s.store.Read(ctx, &resourcepb.ReadRequest{Key: req.Key})
		if err != nil {
			return resource.GetError(resource.AsErrorResult(err))
		}

		if readResponse.Error != nil {
			if readResponse.Error.Code == http.StatusNotFound {
				if !ignoreNotFound {
					return apierrors.NewNotFound(s.gr, req.Key.Name)
				}
			} else {
				return resource.GetError(readResponse.Error)
			}
		}

		// Upsert?  (create because it does not already exist)
		if len(readResponse.Value) == 0 {
			if !ignoreNotFound {
				return apierrors.NewNotFound(s.gr, req.Key.Name)
			}

			updatedObj, _, err = tryUpdate(s.newFunc(), res)
			if err != nil {
				if attempt >= MaxUpdateAttempts {
					return err
				}
				continue
			}
			return s.Create(ctx, key, updatedObj, destination, 0)
		}

		existingBytes = readResponse.Value
		existingObj, err = s.convertToObject(readResponse.Value, s.newFunc())
		if err != nil {
			return err
		}

		existing, err := utils.MetaAccessor(existingObj)
		if err != nil {
			return err
		}
		existing.SetResourceVersionInt64(readResponse.ResourceVersion)
		res.ResourceVersion = uint64(readResponse.ResourceVersion)

		if err := preconditions.Check(key, existingObj); err != nil {
			if attempt >= MaxUpdateAttempts {
				return fmt.Errorf("precondition failed: %w", err)
			}
			continue
		}

		// restore the full original object before tryUpdate
		if s.opts.LargeObjectSupport != nil && existing.GetBlob() != nil {
			err = s.opts.LargeObjectSupport.Reconstruct(ctx, req.Key, s.store, existing)
			if err != nil {
				return err
			}
		}

		updatedObj, _, err = tryUpdate(existingObj, res)
		if err != nil {
			if attempt >= MaxUpdateAttempts {
				return err
			}
			continue
		}
		break
	}

	v, err := s.prepareObjectForUpdate(ctx, updatedObj, existingObj)
	if err != nil {
		return s.handleManagedResourceRouting(ctx, err, resourcepb.WatchEvent_MODIFIED, key, updatedObj, destination)
	}

	var rv uint64
	// Only update (for real) if the bytes have changed
	if !bytes.Equal(req.Value, existingBytes) {
		updateResponse, err := s.store.Update(ctx, req)
		if err != nil {
			err = resource.GetError(resource.AsErrorResult(err))
		} else if updateResponse.Error != nil {
			err = resource.GetError(updateResponse.Error)
		}

		// Cleanup secure values
		if err = v.finish(ctx, err, s); err != nil {
			return err
		}

		rv = uint64(updateResponse.ResourceVersion)
	}

	if _, err := s.convertToObject(req.Value, destination); err != nil {
		return err
	}

	if rv > 0 {
		if err := s.versioner.UpdateObject(destination, rv); err != nil {
			return err
		}
	}

	return nil
}

// Count returns number of different entries under the key (generally being path prefix).
// TODO: Implement count.
func (s *Storage) Count(key string) (int64, error) {
	return 0, nil
}

// RequestWatchProgress requests the a watch stream progress status be sent in the
// watch response stream as soon as possible.
// Used for monitor watch progress even if watching resources with no changes.
//
// If watch is lagging, progress status might:
// * be pointing to stale resource version. Use etcd KV request to get linearizable resource version.
// * not be delivered at all. It's recommended to poll request progress periodically.
//
// Note: Only watches with matching context grpc metadata will be notified.
// https://github.com/kubernetes/kubernetes/blob/9325a57125e8502941d1b0c7379c4bb80a678d5c/vendor/go.etcd.io/etcd/client/v3/watch.go#L1037-L1042
//
// TODO: Remove when storage.Interface will be separate from etc3.store.
// Deprecated: Added temporarily to simplify exposing RequestProgress for watch cache.
func (s *Storage) RequestWatchProgress(_ context.Context) error {
	return nil
}

// ReadinessCheck checks if the storage is ready for accepting requests.
// TODO: Implement readiness check.
func (s *Storage) ReadinessCheck() error {
	return nil
}

// validateMinimumResourceVersion returns a 'too large resource' version error when the provided minimumResourceVersion is
// greater than the most recent actualRevision available from storage.
func (s *Storage) validateMinimumResourceVersion(minimumResourceVersion string, actualRevision uint64) error {
	if minimumResourceVersion == "" {
		return nil
	}
	minimumRV, err := s.versioner.ParseResourceVersion(minimumResourceVersion)
	if err != nil {
		return apierrors.NewBadRequest(fmt.Sprintf("invalid resource version: %v", err))
	}

	// Enforce the storage.Interface guarantee that the resource version of the returned data
	// "will be at least 'resourceVersion'".
	if minimumRV > actualRevision {
		return storage.NewTooLargeResourceVersionError(minimumRV, actualRevision, 0)
	}
	return nil
}
