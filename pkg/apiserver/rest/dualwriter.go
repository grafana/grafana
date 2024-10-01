package rest

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/klog/v2"
)

var (
	_ rest.Storage              = (DualWriter)(nil)
	_ rest.Scoper               = (DualWriter)(nil)
	_ rest.TableConvertor       = (DualWriter)(nil)
	_ rest.CreaterUpdater       = (DualWriter)(nil)
	_ rest.CollectionDeleter    = (DualWriter)(nil)
	_ rest.GracefulDeleter      = (DualWriter)(nil)
	_ rest.SingularNameProvider = (DualWriter)(nil)
)

// Function that will create a dual writer
type DualWriteBuilder func(gr schema.GroupResource, legacy LegacyStorage, storage Storage) (Storage, error)

// Storage is a storage implementation that satisfies the same interfaces as genericregistry.Store.
type Storage interface {
	rest.Storage
	rest.Scoper
	rest.TableConvertor
	rest.SingularNameProvider
	rest.Getter
	// TODO: when watch is implemented, we can replace all the below with rest.StandardStorage
	rest.Lister
	rest.CreaterUpdater
	rest.GracefulDeleter
	rest.CollectionDeleter
}

// LegacyStorage is a storage implementation that writes to the Grafana SQL database.
type LegacyStorage interface {
	rest.Storage
	rest.Scoper
	rest.SingularNameProvider
	rest.CreaterUpdater
	rest.Lister
	rest.GracefulDeleter
	rest.CollectionDeleter
	rest.TableConvertor
	rest.Getter
}

// DualWriter is a storage implementation that writes first to LegacyStorage and then to Storage.
// If writing to LegacyStorage fails, the write to Storage is skipped and the error is returned.
// Storage is used for all read operations.  This is useful as a migration step from SQL based
// legacy storage to a more standard kubernetes backed storage interface.
//
// NOTE: Only values supported by legacy storage will be preserved in the CREATE/UPDATE commands.
// For example, annotations, labels, and managed fields may not be preserved.  Everything in upstream
// storage can be recrated from the data in legacy storage.
//
// The LegacyStorage implementation must implement the following interfaces:
// - rest.Storage
// - rest.TableConvertor
// - rest.Scoper
// - rest.SingularNameProvider
//
// These interfaces are optional, but they all should be implemented to fully support dual writes:
// - rest.Creater
// - rest.Updater
// - rest.GracefulDeleter
// - rest.CollectionDeleter

type DualWriter interface {
	Storage
	LegacyStorage
	Mode() DualWriterMode
}

type DualWriterMode int

const (
	// Mode0 represents writing to and reading from solely LegacyStorage. This mode is enabled when the
	// Unified Storage is disabled. All reads and writes are made to LegacyStorage. None are made to Storage.
	Mode0 DualWriterMode = iota
	// Mode1 represents writing to and reading from LegacyStorage for all primary functionality while additionally
	// reading and writing to Storage on a best effort basis for the sake of collecting metrics.
	Mode1
	// Mode2 is the dual writing mode that represents writing to LegacyStorage and Storage and reading from LegacyStorage.
	// The objects written to storage will include any labels and annotations.
	// When reading values, the results will be from Storage when they exist, otherwise from legacy storage
	Mode2
	// Mode3 represents writing to LegacyStorage and Storage and reading from Storage.
	// NOTE: Requesting mode3 will only happen when after a background sync job succeeds
	Mode3
	// Mode4 represents writing and reading from Storage.
	// NOTE: Requesting mode4 will only happen when after a background sync job succeeds
	Mode4
	// Mode5 uses storage regardless of the background sync state
	Mode5
)

// TODO: make this function private as there should only be one public way of setting the dual writing mode
// NewDualWriter returns a new DualWriter.
func NewDualWriter(
	mode DualWriterMode,
	legacy LegacyStorage,
	storage Storage,
	reg prometheus.Registerer,
	resource string,
) Storage {
	metrics := &dualWriterMetrics{}
	metrics.init(reg)
	switch mode {
	case Mode0:
		return legacy
	case Mode1:
		// read and write only from legacy storage
		return newDualWriterMode1(legacy, storage, metrics, resource)
	case Mode2:
		// write to both, read from storage but use legacy as backup
		return newDualWriterMode2(legacy, storage, metrics, resource)
	case Mode3:
		// write to both, read from storage only
		return newDualWriterMode3(legacy, storage, metrics, resource)
	case Mode4, Mode5:
		return storage
	default:
		return newDualWriterMode1(legacy, storage, metrics, resource)
	}
}

type updateWrapper struct {
	upstream rest.UpdatedObjectInfo
	updated  runtime.Object
}

// Returns preconditions built from the updated object, if applicable.
// May return nil, or a preconditions object containing nil fields,
// if no preconditions can be determined from the updated object.
func (u *updateWrapper) Preconditions() *metav1.Preconditions {
	if u.upstream == nil {
		return nil
	}
	return u.upstream.Preconditions()
}

// UpdatedObject returns the updated object, given a context and old object.
// The only time an empty oldObj should be passed in is if a "create on update" is occurring (there is no oldObj).
func (u *updateWrapper) UpdatedObject(ctx context.Context, oldObj runtime.Object) (newObj runtime.Object, err error) {
	return u.updated, nil
}

type NamespacedKVStore interface {
	Get(ctx context.Context, key string) (string, bool, error)
	Set(ctx context.Context, key, value string) error
}

type ServerLockService interface {
	LockExecuteAndRelease(ctx context.Context, actionName string, maxInterval time.Duration, fn func(ctx context.Context)) error
}

func SetDualWritingMode(
	ctx context.Context,
	kvs NamespacedKVStore,
	legacy LegacyStorage,
	storage Storage,
	entity string,
	desiredMode DualWriterMode,
	reg prometheus.Registerer,
	serverLockService ServerLockService,
	requestInfo *request.RequestInfo,
) (DualWriterMode, error) {
	// Mode0 means no DualWriter
	if desiredMode == Mode0 {
		return Mode0, nil
	}

	toMode := map[string]DualWriterMode{
		// It is not possible to initialize a mode 0 dual writer. Mode 0 represents
		// writing to legacy storage without Unified Storage enabled.
		"1": Mode1,
		"2": Mode2,
		"3": Mode3,
		"4": Mode4,
	}
	errDualWriterSetCurrentMode := errors.New("failed to set current dual writing mode")

	// Use entity name as key
	m, ok, err := kvs.Get(ctx, entity)
	if err != nil {
		return Mode0, errors.New("failed to fetch current dual writing mode")
	}

	currentMode, valid := toMode[m]

	if !valid && ok {
		// Only log if "ok" because initially all instances will have mode unset for playlists.
		klog.Infof("invalid dual writing mode for %s mode: %v", entity, m)
	}

	if !valid || !ok {
		// Default to mode 1
		currentMode = Mode1

		err := kvs.Set(ctx, entity, fmt.Sprint(currentMode))
		if err != nil {
			return Mode0, errDualWriterSetCurrentMode
		}
	}

	// Desired mode is 2 and current mode is 1
	if (desiredMode == Mode2) && (currentMode == Mode1) {
		// This is where we go through the different gates to allow the instance to migrate from mode 1 to mode 2.
		// There are none between mode 1 and mode 2
		currentMode = Mode2

		err := kvs.Set(ctx, entity, fmt.Sprint(currentMode))
		if err != nil {
			return Mode0, errDualWriterSetCurrentMode
		}
	}

	if (desiredMode == Mode1) && (currentMode == Mode2) {
		// This is where we go through the different gates to allow the instance to migrate from mode 2 to mode 1.
		// There are none between mode 1 and mode 2
		currentMode = Mode1

		err := kvs.Set(ctx, entity, fmt.Sprint(currentMode))
		if err != nil {
			return Mode0, errDualWriterSetCurrentMode
		}
	}

	if (desiredMode == Mode3) && (currentMode == Mode2) {
		// This is where we go through the different gates to allow the instance to migrate from mode 2 to mode 3.

		// gate #1: ensure the data is 100% in sync
		syncOk, err := runDataSyncer(ctx, currentMode, legacy, storage, entity, reg, serverLockService, requestInfo)
		if err != nil {
			klog.Info("data syncer failed for mode:", m)
			return currentMode, err
		}
		if !syncOk {
			klog.Info("data syncer not ok for mode:", m)
			return currentMode, nil
		}

		err = kvs.Set(ctx, entity, fmt.Sprint(desiredMode))
		if err != nil {
			return currentMode, errDualWriterSetCurrentMode
		}

		return desiredMode, nil
	}

	// 	#TODO add support for other combinations of desired and current modes

	return currentMode, nil
}

var defaultConverter = runtime.UnstructuredConverter(runtime.DefaultUnstructuredConverter)

// Compare asserts on the equality of objects returned from both stores	(object storage and legacy storage)
func Compare(storageObj, legacyObj runtime.Object) bool {
	if storageObj == nil || legacyObj == nil {
		return storageObj == nil && legacyObj == nil
	}
	return bytes.Equal(removeMeta(storageObj), removeMeta(legacyObj))
}

func removeMeta(obj runtime.Object) []byte {
	cpy := obj.DeepCopyObject()
	unstObj, err := defaultConverter.ToUnstructured(cpy)
	if err != nil {
		return nil
	}
	// we don't want to compare meta fields
	delete(unstObj, "metadata")
	delete(unstObj, "objectMeta")

	jsonObj, err := json.Marshal(unstObj)
	if err != nil {
		return nil
	}
	return jsonObj
}

func getName(o runtime.Object) string {
	if o == nil {
		return ""
	}
	accessor, err := meta.Accessor(o)
	if err != nil {
		klog.Error("failed to get object name: ", err)
		return ""
	}
	return accessor.GetName()
}

const dataSyncerInterval = 60 * time.Minute

// StartPeriodicDataSyncer starts a background job that will execute the DataSyncer every 60 minutes
func StartPeriodicDataSyncer(ctx context.Context, mode DualWriterMode, legacy LegacyStorage, storage Storage,
	kind string, reg prometheus.Registerer, serverLockService ServerLockService, requestInfo *request.RequestInfo) {
	klog.Info("Starting periodic data syncer for mode mode: ", mode)

	// run in background
	go func() {
		r := rand.New(rand.NewSource(time.Now().UnixNano()))
		timeWindow := 600 // 600 seconds (10 minutes)
		jitterSeconds := r.Int63n(int64(timeWindow))
		klog.Info("data syncer is going to start at: ", time.Now().Add(time.Second*time.Duration(jitterSeconds)))
		time.Sleep(time.Second * time.Duration(jitterSeconds))

		// run it immediately
		syncOK, err := runDataSyncer(ctx, mode, legacy, storage, kind, reg, serverLockService, requestInfo)
		klog.Info("data syncer finished, syncOK: ", syncOK, ", error: ", err)

		ticker := time.NewTicker(dataSyncerInterval)
		for {
			select {
			case <-ticker.C:
				syncOK, err = runDataSyncer(ctx, mode, legacy, storage, kind, reg, serverLockService, requestInfo)
				klog.Info("data syncer finished, syncOK: ", syncOK, ", error: ", err)
			case <-ctx.Done():
				return
			}
		}
	}()
}

// runDataSyncer will ensure that data between legacy storage and unified storage are in sync.
// The sync implementation depends on the DualWriter mode
func runDataSyncer(ctx context.Context, mode DualWriterMode, legacy LegacyStorage, storage Storage,
	kind string, reg prometheus.Registerer, serverLockService ServerLockService, requestInfo *request.RequestInfo) (bool, error) {
	// ensure that execution takes no longer than necessary
	const timeout = dataSyncerInterval - time.Minute
	ctx, cancelFn := context.WithTimeout(ctx, timeout)
	defer cancelFn()

	// implementation depends on the current DualWriter mode
	switch mode {
	case Mode2:
		return mode2DataSyncer(ctx, legacy, storage, kind, reg, serverLockService, requestInfo)
	default:
		klog.Info("data syncer not implemented for mode mode:", mode)
		return false, nil
	}
}
