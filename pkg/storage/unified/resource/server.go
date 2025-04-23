package resource

import (
	"context"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"log/slog"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"
	"google.golang.org/grpc"
	"google.golang.org/grpc/health/grpc_health_v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/dskit/ring"
	ringclient "github.com/grafana/dskit/ring/client"
	userutils "github.com/grafana/dskit/user"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// ResourceServer implements all gRPC services
type ResourceServer interface {
	ResourceStoreServer
	BulkStoreServer
	ResourceIndexServer
	ManagedObjectIndexServer
	BlobStoreServer
	DiagnosticsServer
}

type ListIterator interface {
	// Next advances iterator and returns true if there is next value is available from the iterator.
	// Error() should be checked after every call of Next(), even when Next() returns true.
	Next() bool // sql.Rows

	// Error returns iterator error, if any. This should be checked after any Next() call.
	// (Some iterator implementations return true from Next, but also set the error at the same time).
	Error() error

	// ContinueToken returns the token that can be used to start iterating *after* this item
	ContinueToken() string

	// ContinueTokenWithCurrentRV returns the token that can be used to start iterating *before* this item
	ContinueTokenWithCurrentRV() string

	// ResourceVersion of the current item
	ResourceVersion() int64

	// Namespace of the current item
	// Used for fast(er) authz filtering
	Namespace() string

	// Name of the current item
	// Used for fast(er) authz filtering
	Name() string

	// Folder of the current item
	// Used for fast(er) authz filtering
	Folder() string

	// Value for the current item
	Value() []byte
}

type BackendReadResponse struct {
	// Metadata
	Key    *ResourceKey
	Folder string

	// GUID that is used internally
	GUID string
	// The new resource version
	ResourceVersion int64
	// The properties
	Value []byte
	// Error details
	Error *ErrorResult
}

// The StorageBackend is an internal abstraction that supports interacting with
// the underlying raw storage medium.  This interface is never exposed directly,
// it is provided by concrete instances that actually write values.
type StorageBackend interface {
	// Write a Create/Update/Delete,
	// NOTE: the contents of WriteEvent have been validated
	// Return the revisionVersion for this event or error
	WriteEvent(context.Context, WriteEvent) (int64, error)

	// Read a resource from storage optionally at an explicit version
	ReadResource(context.Context, *ReadRequest) *BackendReadResponse

	// When the ResourceServer executes a List request, this iterator will
	// query the backend for potential results.  All results will be
	// checked against the kubernetes requirements before finally returning
	// results.  The list options can be used to improve performance
	// but are the the final answer.
	ListIterator(context.Context, *ListRequest, func(ListIterator) error) (int64, error)

	// Get all events from the store
	// For HA setups, this will be more events than the local WriteEvent above!
	WatchWriteEvents(ctx context.Context) (<-chan *WrittenEvent, error)

	// Get resource stats within the storage backend.  When namespace is empty, it will apply to all
	GetResourceStats(ctx context.Context, namespace string, minCount int) ([]ResourceStats, error)
}

type ResourceStats struct {
	NamespacedResource

	Count           int64
	ResourceVersion int64
}

// This interface is not exposed to end users directly
// Access to this interface is already gated by access control
type BlobSupport interface {
	// Indicates if storage layer supports signed urls
	SupportsSignedURLs() bool

	// Get the raw blob bytes and metadata -- limited to protobuf message size
	// For larger payloads, we should use presigned URLs to upload from the client
	PutResourceBlob(context.Context, *PutBlobRequest) (*PutBlobResponse, error)

	// Get blob contents.  When possible, this will return a signed URL
	// For large payloads, signed URLs are required to avoid protobuf message size limits
	GetResourceBlob(ctx context.Context, resource *ResourceKey, info *utils.BlobInfo, mustProxy bool) (*GetBlobResponse, error)

	// TODO? List+Delete?  This is for admin access
}

type BlobConfig struct {
	// The CDK configuration URL
	URL string

	// Directly implemented blob support
	Backend BlobSupport
}

// IndexLatencyObserver is an interface for observing index latency metrics
// This is used for testing
type IndexLatencyObserver interface {
	Observe(evt *WrittenEvent, latency float64)
}

// Passed as input to the constructor
type SearchOptions struct {
	// The raw index backend (eg, bleve, frames, parquet, etc)
	Backend SearchBackend

	// The supported resource types
	Resources DocumentBuilderSupplier

	// How many threads should build indexes
	WorkerThreads int

	// Skip building index on startup for small indexes
	InitMinCount int

	// Observer for index latency metrics
	IndexLatencyObserver IndexLatencyObserver
}

type ResourceServerOptions struct {
	// OTel tracer
	Tracer trace.Tracer

	// Real storage backend
	Backend StorageBackend

	// The blob configuration
	Blob BlobConfig

	// Search options
	Search SearchOptions

	// Diagnostics
	Diagnostics DiagnosticsServer

	// Check if a user has access to write folders
	// When this is nil, no resources can have folders configured
	WriteHooks WriteAccessHooks

	// Link RBAC
	AccessClient claims.AccessClient

	// Callbacks for startup and shutdown
	Lifecycle LifecycleHooks

	// Get the current time in unix millis
	Now func() int64

	// Registerer to register prometheus Metrics for the Resource server
	Reg prometheus.Registerer

	storageMetrics *StorageMetrics

	IndexMetrics *BleveIndexMetrics

	Distributor *Distributor
}

func NewResourceServer(opts ResourceServerOptions) (ResourceServer, error) {
	if opts.Tracer == nil {
		opts.Tracer = noop.NewTracerProvider().Tracer("resource-server")
	}

	if opts.Backend == nil {
		return nil, fmt.Errorf("missing Backend implementation")
	}

	if opts.AccessClient == nil {
		opts.AccessClient = claims.FixedAccessClient(true) // everything OK
	}

	if opts.Diagnostics == nil {
		opts.Diagnostics = &noopService{}
	}
	if opts.Now == nil {
		opts.Now = func() int64 {
			return time.Now().UnixMilli()
		}
	}

	// Initialize the blob storage
	blobstore := opts.Blob.Backend
	if blobstore == nil {
		if opts.Blob.URL != "" {
			ctx := context.Background()
			bucket, err := OpenBlobBucket(ctx, opts.Blob.URL)
			if err != nil {
				return nil, err
			}

			blobstore, err = NewCDKBlobSupport(ctx, CDKBlobSupportOptions{
				Tracer: opts.Tracer,
				Bucket: NewInstrumentedBucket(bucket, opts.Reg, opts.Tracer),
			})
			if err != nil {
				return nil, err
			}
		} else {
			// Check if the backend supports blob storage
			blobstore, _ = opts.Backend.(BlobSupport)
		}
	}

	logger := slog.Default().With("logger", "resource-server")

	// Make this cancelable
	ctx, cancel := context.WithCancel(context.Background())
	s := &server{
		tracer:         opts.Tracer,
		log:            logger,
		backend:        opts.Backend,
		blob:           blobstore,
		diagnostics:    opts.Diagnostics,
		access:         opts.AccessClient,
		writeHooks:     opts.WriteHooks,
		lifecycle:      opts.Lifecycle,
		now:            opts.Now,
		ctx:            ctx,
		cancel:         cancel,
		storageMetrics: opts.storageMetrics,
		indexMetrics:   opts.IndexMetrics,
		reg:            opts.Reg,
	}

	if opts.Distributor != nil {
		s.shardingEnabled = true
		s.distributor = *opts.Distributor
	}

	if opts.Search.Resources != nil {
		var err error
		s.search, err = newSearchSupport(opts.Search, s.backend, s.access, s.blob, opts.Tracer, opts.IndexMetrics)
		if err != nil {
			return nil, err
		}
	}

	err := s.Init(ctx)
	if err != nil {
		s.log.Error("resource server init failed", "error", err)
		return nil, err
	}

	return s, nil
}

var _ ResourceServer = &server{}

type server struct {
	tracer         trace.Tracer
	log            *slog.Logger
	backend        StorageBackend
	blob           BlobSupport
	search         *searchSupport
	diagnostics    DiagnosticsServer
	access         claims.AccessClient
	writeHooks     WriteAccessHooks
	lifecycle      LifecycleHooks
	now            func() int64
	mostRecentRV   atomic.Int64 // The most recent resource version seen by the server
	storageMetrics *StorageMetrics
	indexMetrics   *BleveIndexMetrics

	// Background watch task -- this has permissions for everything
	ctx         context.Context
	cancel      context.CancelFunc
	broadcaster Broadcaster[*WrittenEvent]

	// init checking
	once    sync.Once
	initErr error

	shardingEnabled bool
	distributor     Distributor
	reg             prometheus.Registerer
}

type Distributor struct {
	ClientPool *ringclient.Pool
	Ring       *ring.Ring
	Lifecycler *ring.BasicLifecycler
}

type RingClient struct {
	Client ResourceClient
	grpc_health_v1.HealthClient
	Conn *grpc.ClientConn
}

func (c *RingClient) Close() error {
	return c.Conn.Close()
}

func (c *RingClient) String() string {
	return c.RemoteAddress()
}

func (c *RingClient) RemoteAddress() string {
	return c.Conn.Target()
}

// Init implements ResourceServer.
func (s *server) Init(ctx context.Context) error {
	s.once.Do(func() {
		// Call lifecycle hooks
		if s.lifecycle != nil {
			err := s.lifecycle.Init(ctx)
			if err != nil {
				s.initErr = fmt.Errorf("initialize Resource Server: %w", err)
			}
		}

		// initialize the search index
		if s.initErr == nil && s.search != nil {
			s.initErr = s.search.init(ctx)
		}

		// Start watching for changes
		if s.initErr == nil {
			s.initErr = s.initWatcher()
		}

		if s.initErr != nil {
			s.log.Error("error running resource server init", "error", s.initErr)
		}
	})
	return s.initErr
}

var ringOp = ring.NewOp([]ring.InstanceState{ring.ACTIVE}, func(s ring.InstanceState) bool {
	return s != ring.ACTIVE
})

func (s *server) getClientToDistributeRequest(namespace string) *RingClient {
	ringHasher := fnv.New32a()
	_, err := ringHasher.Write([]byte(namespace))
	if err != nil {
		s.log.Error("Error hashing namespace. Will not distribute request", "err", err)
		return nil
	}

	rs, err := s.distributor.Ring.Get(ringHasher.Sum32(), ringOp, nil, nil, nil)

	if err != nil {
		s.log.Error("Error getting replication set. Will not distribute request", "err", err)
		return nil
	}

	if rs.Instances[0].Id != s.distributor.Lifecycler.GetInstanceID() {
		s.log.Info("distributing request", "instanceId", rs.Instances[0].Id)

		ins, err := s.distributor.ClientPool.GetClientForInstance(rs.Instances[0])
		if err != nil {
			s.log.Error("Error getting client. Will not distribute request", "err", err)
			return nil
		}
		return ins.(*RingClient)
	}

	return nil
}

func (s *server) Stop(ctx context.Context) error {
	s.initErr = fmt.Errorf("service is stopping")

	var stopFailed bool
	if s.lifecycle != nil {
		err := s.lifecycle.Stop(ctx)
		if err != nil {
			stopFailed = true
			s.initErr = fmt.Errorf("service stopeed with error: %w", err)
		}
	}

	// Stops the streaming
	s.cancel()

	// mark the value as done
	if stopFailed {
		return s.initErr
	}
	s.initErr = fmt.Errorf("service is stopped")

	return nil
}

// Old value indicates an update -- otherwise a create
func (s *server) newEvent(ctx context.Context, user claims.AuthInfo, key *ResourceKey, value, oldValue []byte) (*WriteEvent, *ErrorResult) {
	tmp := &unstructured.Unstructured{}
	err := tmp.UnmarshalJSON(value)
	if err != nil {
		return nil, AsErrorResult(err)
	}
	obj, err := utils.MetaAccessor(tmp)
	if err != nil {
		return nil, AsErrorResult(err)
	}

	if obj.GetUID() == "" {
		// TODO! once https://github.com/grafana/grafana/pull/96086 is deployed everywhere
		// return nil, NewBadRequestError("object is missing UID")
		s.log.Error("object is missing UID", "key", key)
	}

	if obj.GetResourceVersion() != "" {
		s.log.Error("object must not include a resource version", "key", key)
	}

	// Make sure the command labels are not saved
	for k := range obj.GetLabels() {
		if k == utils.LabelKeyGetHistory || k == utils.LabelKeyGetTrash || k == utils.LabelGetFullpath {
			return nil, NewBadRequestError("can not save label: " + k)
		}
	}

	if obj.GetAnnotation(utils.AnnoKeyGrantPermissions) != "" {
		return nil, NewBadRequestError("can not save annotation: " + utils.AnnoKeyGrantPermissions)
	}

	event := &WriteEvent{
		Value:  value,
		Key:    key,
		Object: obj,
	}

	if oldValue == nil {
		event.Type = WatchEvent_ADDED
	} else {
		event.Type = WatchEvent_MODIFIED

		temp := &unstructured.Unstructured{}
		err = temp.UnmarshalJSON(oldValue)
		if err != nil {
			return nil, AsErrorResult(err)
		}
		event.ObjectOld, err = utils.MetaAccessor(temp)
		if err != nil {
			return nil, AsErrorResult(err)
		}
	}

	if key.Namespace != obj.GetNamespace() {
		return nil, NewBadRequestError("key/namespace do not match")
	}

	gvk := obj.GetGroupVersionKind()
	if gvk.Kind == "" {
		return nil, NewBadRequestError("expecting resources with a kind in the body")
	}
	if gvk.Version == "" {
		return nil, NewBadRequestError("expecting resources with an apiVersion")
	}
	if gvk.Group != "" && gvk.Group != key.Group {
		return nil, NewBadRequestError(
			fmt.Sprintf("group in key does not match group in the body (%s != %s)", key.Group, gvk.Group),
		)
	}

	// This needs to be a create function
	if key.Name == "" {
		if obj.GetName() == "" {
			return nil, NewBadRequestError("missing name")
		}
		key.Name = obj.GetName()
	} else if key.Name != obj.GetName() {
		return nil, NewBadRequestError(
			fmt.Sprintf("key/name do not match (key: %s, name: %s)", key.Name, obj.GetName()))
	}
	if err := validateName(obj.GetName()); err != nil {
		return nil, err
	}

	// For folder moves, we need to check permissions on both folders
	if s.isFolderMove(event) {
		if err := s.checkFolderMovePermissions(ctx, user, key, event.ObjectOld.GetFolder(), obj.GetFolder()); err != nil {
			return nil, err
		}
	} else {
		// Regular permission check for create/update
		check := claims.CheckRequest{
			Verb:      utils.VerbCreate,
			Group:     key.Group,
			Resource:  key.Resource,
			Namespace: key.Namespace,
		}

		if event.Type == WatchEvent_MODIFIED {
			check.Verb = utils.VerbUpdate
			check.Name = key.Name
		}

		check.Folder = obj.GetFolder()
		a, err := s.access.Check(ctx, user, check)
		if err != nil {
			return nil, AsErrorResult(err)
		}
		if !a.Allowed {
			return nil, &ErrorResult{
				Code: http.StatusForbidden,
			}
		}
	}

	m, ok := obj.GetManagerProperties()
	if ok && m.Kind == utils.ManagerKindRepo {
		err = s.writeHooks.CanWriteValueFromRepository(ctx, user, m.Identity)
		if err != nil {
			return nil, AsErrorResult(err)
		}
	}
	return event, nil
}

// isFolderMove determines if an event represents a resource being moved between folders
func (s *server) isFolderMove(event *WriteEvent) bool {
	return event.Type == WatchEvent_MODIFIED &&
		event.ObjectOld != nil &&
		event.ObjectOld.GetFolder() != event.Object.GetFolder()
}

// checkFolderMovePermissions handles permission checks when a resource is being moved between folders
func (s *server) checkFolderMovePermissions(ctx context.Context, user claims.AuthInfo, key *ResourceKey, oldFolder, newFolder string) *ErrorResult {
	// First check if user can update the resource in the original folder
	updateCheck := claims.CheckRequest{
		Verb:      utils.VerbUpdate,
		Group:     key.Group,
		Resource:  key.Resource,
		Namespace: key.Namespace,
		Name:      key.Name,
		Folder:    oldFolder,
	}

	a, err := s.access.Check(ctx, user, updateCheck)
	if err != nil {
		return AsErrorResult(err)
	}
	if !a.Allowed {
		return &ErrorResult{
			Code:    http.StatusForbidden,
			Message: "not allowed to update resource in the source folder",
		}
	}

	// Then check if user can create the resource in the destination folder
	createCheck := claims.CheckRequest{
		Verb:      utils.VerbCreate,
		Group:     key.Group,
		Resource:  key.Resource,
		Namespace: key.Namespace,
		Folder:    newFolder,
	}

	a, err = s.access.Check(ctx, user, createCheck)
	if err != nil {
		return AsErrorResult(err)
	}
	if !a.Allowed {
		return &ErrorResult{
			Code:    http.StatusForbidden,
			Message: "not allowed to create resource in the destination folder",
		}
	}

	return nil
}

func (s *server) Create(ctx context.Context, req *CreateRequest) (*CreateResponse, error) {
	ctx, span := s.tracer.Start(ctx, "storage_server.Create")
	defer span.End()

	rsp := &CreateResponse{}
	user, ok := claims.AuthInfoFrom(ctx)
	if !ok || user == nil {
		rsp.Error = &ErrorResult{
			Message: "no user found in context",
			Code:    http.StatusUnauthorized,
		}
		return rsp, nil
	}

	event, e := s.newEvent(ctx, user, req.Key, req.Value, nil)
	if e != nil {
		rsp.Error = e
		return rsp, nil
	}

	// If the resource already exists, the create will return an already exists error that is remapped appropriately by AsErrorResult.
	// This also benefits from ACID behaviours on our databases, so we avoid race conditions.
	var err error
	rsp.ResourceVersion, err = s.backend.WriteEvent(ctx, *event)
	if err != nil {
		rsp.Error = AsErrorResult(err)
	}
	s.log.Debug("server.WriteEvent", "type", event.Type, "rv", rsp.ResourceVersion, "previousRV", event.PreviousRV, "group", event.Key.Group, "namespace", event.Key.Namespace, "name", event.Key.Name, "resource", event.Key.Resource)
	return rsp, nil
}

func (s *server) Update(ctx context.Context, req *UpdateRequest) (*UpdateResponse, error) {
	ctx, span := s.tracer.Start(ctx, "storage_server.Update")
	defer span.End()

	rsp := &UpdateResponse{}
	user, ok := claims.AuthInfoFrom(ctx)
	if !ok || user == nil {
		rsp.Error = &ErrorResult{
			Message: "no user found in context",
			Code:    http.StatusUnauthorized,
		}
		return rsp, nil
	}
	if req.ResourceVersion < 0 {
		rsp.Error = AsErrorResult(apierrors.NewBadRequest("update must include the previous version"))
		return rsp, nil
	}

	latest := s.backend.ReadResource(ctx, &ReadRequest{
		Key: req.Key,
	})
	if latest.Error != nil {
		return rsp, nil
	}
	if latest.Value == nil {
		rsp.Error = NewBadRequestError("current value does not exist")
		return rsp, nil
	}

	if req.ResourceVersion > 0 && latest.ResourceVersion != req.ResourceVersion {
		return nil, ErrOptimisticLockingFailed
	}

	event, e := s.newEvent(ctx, user, req.Key, req.Value, latest.Value)
	if e != nil {
		rsp.Error = e
		return rsp, nil
	}

	event.Type = WatchEvent_MODIFIED
	event.PreviousRV = latest.ResourceVersion

	var err error
	rsp.ResourceVersion, err = s.backend.WriteEvent(ctx, *event)
	if err != nil {
		rsp.Error = AsErrorResult(err)
	}
	return rsp, nil
}

func (s *server) Delete(ctx context.Context, req *DeleteRequest) (*DeleteResponse, error) {
	ctx, span := s.tracer.Start(ctx, "storage_server.Delete")
	defer span.End()

	rsp := &DeleteResponse{}
	if req.ResourceVersion < 0 {
		return nil, apierrors.NewBadRequest("update must include the previous version")
	}
	user, ok := claims.AuthInfoFrom(ctx)
	if !ok || user == nil {
		rsp.Error = &ErrorResult{
			Message: "no user found in context",
			Code:    http.StatusUnauthorized,
		}
		return rsp, nil
	}

	latest := s.backend.ReadResource(ctx, &ReadRequest{
		Key: req.Key,
	})
	if latest.Error != nil {
		rsp.Error = latest.Error
		return rsp, nil
	}
	if req.ResourceVersion > 0 && latest.ResourceVersion != req.ResourceVersion {
		rsp.Error = AsErrorResult(ErrOptimisticLockingFailed)
		return rsp, nil
	}

	access, err := s.access.Check(ctx, user, claims.CheckRequest{
		Verb:      "delete",
		Group:     req.Key.Group,
		Resource:  req.Key.Resource,
		Namespace: req.Key.Namespace,
		Name:      req.Key.Name,
		Folder:    latest.Folder,
	})
	if err != nil {
		rsp.Error = AsErrorResult(err)
		return rsp, nil
	}
	if !access.Allowed {
		rsp.Error = &ErrorResult{
			Code: http.StatusForbidden,
		}
		return rsp, nil
	}

	now := metav1.NewTime(time.UnixMilli(s.now()))
	event := WriteEvent{
		Key:        req.Key,
		Type:       WatchEvent_DELETED,
		PreviousRV: latest.ResourceVersion,
	}
	requester, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return nil, apierrors.NewBadRequest("unable to get user")
	}
	marker := &unstructured.Unstructured{}
	err = json.Unmarshal(latest.Value, marker)
	if err != nil {
		return nil, apierrors.NewBadRequest(
			fmt.Sprintf("unable to read previous object, %v", err))
	}
	obj, err := utils.MetaAccessor(marker)
	if err != nil {
		return nil, err
	}
	obj.SetDeletionTimestamp(&now)
	obj.SetUpdatedTimestamp(&now.Time)
	obj.SetManagedFields(nil)
	obj.SetFinalizers(nil)
	obj.SetUpdatedBy(requester.GetUID())
	obj.SetGeneration(utils.DeletedGeneration)
	obj.SetAnnotation(utils.AnnoKeyKubectlLastAppliedConfig, "") // clears it
	event.Value, err = marker.MarshalJSON()
	if err != nil {
		return nil, apierrors.NewBadRequest(
			fmt.Sprintf("unable creating deletion marker, %v", err))
	}

	rsp.ResourceVersion, err = s.backend.WriteEvent(ctx, event)
	if err != nil {
		rsp.Error = AsErrorResult(err)
	}
	return rsp, nil
}

func (s *server) Read(ctx context.Context, req *ReadRequest) (*ReadResponse, error) {
	user, ok := claims.AuthInfoFrom(ctx)
	if !ok || user == nil {
		return &ReadResponse{
			Error: &ErrorResult{
				Message: "no user found in context",
				Code:    http.StatusUnauthorized,
			}}, nil
	}

	// if req.Key.Group == "" {
	// 	status, _ := AsErrorResult(apierrors.NewBadRequest("missing group"))
	// 	return &ReadResponse{Status: status}, nil
	// }
	if req.Key.Resource == "" {
		return &ReadResponse{Error: NewBadRequestError("missing resource")}, nil
	}

	rsp := s.backend.ReadResource(ctx, req)
	if rsp.Error != nil && rsp.Error.Code == http.StatusNotFound {
		return &ReadResponse{Error: rsp.Error}, nil
	}

	a, err := s.access.Check(ctx, user, claims.CheckRequest{
		Verb:      "get",
		Group:     req.Key.Group,
		Resource:  req.Key.Resource,
		Namespace: req.Key.Namespace,
		Name:      req.Key.Name,
		Folder:    rsp.Folder,
	})
	if err != nil {
		return &ReadResponse{Error: AsErrorResult(err)}, nil
	}
	if !a.Allowed {
		return &ReadResponse{
			Error: &ErrorResult{
				Code: http.StatusForbidden,
			}}, nil
	}
	return &ReadResponse{
		ResourceVersion: rsp.ResourceVersion,
		Value:           rsp.Value,
		Error:           rsp.Error,
	}, nil
}

func (s *server) List(ctx context.Context, req *ListRequest) (*ListResponse, error) {
	ctx, span := s.tracer.Start(ctx, "storage_server.List")
	defer span.End()

	// The history + trash queries do not yet support additional filters
	if req.Source != ListRequest_STORE {
		if len(req.Options.Fields) > 0 || len(req.Options.Labels) > 0 {
			return &ListResponse{
				Error: NewBadRequestError("unexpected field/label selector for history query"),
			}, nil
		}
	}

	user, ok := claims.AuthInfoFrom(ctx)
	if !ok || user == nil {
		return &ListResponse{
			Error: &ErrorResult{
				Message: "no user found in context",
				Code:    http.StatusUnauthorized,
			}}, nil
	}

	// Do not allow label query for trash/history
	for _, v := range req.Options.Labels {
		if v.Key == utils.LabelKeyGetHistory || v.Key == utils.LabelKeyGetTrash {
			return &ListResponse{Error: NewBadRequestError("history and trash must be requested as source")}, nil
		}
	}

	if req.Limit < 1 {
		req.Limit = 50 // default max 50 items in a page
	}
	maxPageBytes := 1024 * 1024 * 2 // 2mb/page
	pageBytes := 0
	rsp := &ListResponse{}

	key := req.Options.Key
	checker, err := s.access.Compile(ctx, user, claims.ListRequest{
		Group:     key.Group,
		Resource:  key.Resource,
		Namespace: key.Namespace,
		Verb:      utils.VerbGet,
	})
	if err != nil {
		return &ListResponse{Error: AsErrorResult(err)}, nil
	}
	if checker == nil {
		return &ListResponse{Error: &ErrorResult{
			Code: http.StatusForbidden,
		}}, nil
	}

	rv, err := s.backend.ListIterator(ctx, req, func(iter ListIterator) error {
		for iter.Next() {
			if err := iter.Error(); err != nil {
				return err
			}

			item := &ResourceWrapper{
				ResourceVersion: iter.ResourceVersion(),
				Value:           iter.Value(),
			}

			if !checker(iter.Name(), iter.Folder()) {
				continue
			}

			pageBytes += len(item.Value)
			rsp.Items = append(rsp.Items, item)
			if len(rsp.Items) >= int(req.Limit) || pageBytes >= maxPageBytes {
				t := iter.ContinueToken()
				if req.Source == ListRequest_HISTORY || req.Source == ListRequest_TRASH {
					// For history lists, we need to use the current RV in the continue token
					// to ensure consistent pagination. The order depends on VersionMatch:
					// - NotOlderThan: ascending order (oldest to newest)
					// - Unset: descending order (newest to oldest)
					t = iter.ContinueTokenWithCurrentRV()
				}
				if iter.Next() {
					rsp.NextPageToken = t
				}
				return iter.Error()
			}
		}
		return iter.Error()
	})
	if err != nil {
		rsp.Error = AsErrorResult(err)
		return rsp, nil
	}

	if rv < 1 {
		rsp.Error = &ErrorResult{
			Code:    http.StatusInternalServerError,
			Message: fmt.Sprintf("invalid resource version for list: %v", rv),
		}
		return rsp, nil
	}
	rsp.ResourceVersion = rv
	return rsp, err
}

func (s *server) initWatcher() error {
	var err error
	s.broadcaster, err = NewBroadcaster(s.ctx, func(out chan<- *WrittenEvent) error {
		events, err := s.backend.WatchWriteEvents(s.ctx)
		if err != nil {
			return err
		}
		go func() {
			for v := range events {
				if v == nil {
					s.log.Error("received nil event")
					continue
				}
				// Skip events during batch updates
				if v.PreviousRV < 0 {
					continue
				}

				s.log.Debug("Server. Streaming Event", "type", v.Type, "previousRV", v.PreviousRV, "group", v.Key.Group, "namespace", v.Key.Namespace, "resource", v.Key.Resource, "name", v.Key.Name)
				s.mostRecentRV.Store(v.ResourceVersion)
				out <- v
			}
		}()
		return nil
	})
	return err
}

//nolint:gocyclo
func (s *server) Watch(req *WatchRequest, srv ResourceStore_WatchServer) error {
	ctx := srv.Context()

	user, ok := claims.AuthInfoFrom(ctx)
	if !ok || user == nil {
		return apierrors.NewUnauthorized("no user found in context")
	}

	key := req.Options.Key
	checker, err := s.access.Compile(ctx, user, claims.ListRequest{
		Group:     key.Group,
		Resource:  key.Resource,
		Namespace: key.Namespace,
		Verb:      utils.VerbGet,
	})
	if err != nil {
		return err
	}
	if checker == nil {
		return apierrors.NewUnauthorized("not allowed to list anything") // ?? or a single error?
	}

	// Start listening -- this will buffer any changes that happen while we backfill.
	// If events are generated faster than we can process them, then some events will be dropped.
	// TODO: Think of a way to allow the client to catch up.
	stream, err := s.broadcaster.Subscribe(ctx)
	if err != nil {
		return err
	}
	defer s.broadcaster.Unsubscribe(stream)

	if !req.SendInitialEvents && req.Since == 0 {
		// This is a temporary hack only relevant for tests to ensure that the first events are sent.
		// This is required because the SQL backend polls the database every 100ms.
		// TODO: Implement a getLatestResourceVersion method in the backend.
		time.Sleep(10 * time.Millisecond)
	}

	mostRecentRV := s.mostRecentRV.Load() // get the latest resource version
	var initialEventsRV int64             // resource version coming from the initial events
	if req.SendInitialEvents {
		// Backfill the stream by adding every existing entities.
		initialEventsRV, err = s.backend.ListIterator(ctx, &ListRequest{Options: req.Options}, func(iter ListIterator) error {
			for iter.Next() {
				if err := iter.Error(); err != nil {
					return err
				}
				if err := srv.Send(&WatchEvent{
					Type: WatchEvent_ADDED,
					Resource: &WatchEvent_Resource{
						Value:   iter.Value(),
						Version: iter.ResourceVersion(),
					},
				}); err != nil {
					return err
				}
			}
			return iter.Error()
		})
		if err != nil {
			return err
		}
	}
	if req.SendInitialEvents && req.AllowWatchBookmarks {
		if err := srv.Send(&WatchEvent{
			Type: WatchEvent_BOOKMARK,
			Resource: &WatchEvent_Resource{
				Version: initialEventsRV,
			},
		}); err != nil {
			return err
		}
	}

	var since int64 // resource version to start watching from
	switch {
	case req.SendInitialEvents:
		since = initialEventsRV
	case req.Since == 0:
		since = mostRecentRV
	default:
		since = req.Since
	}
	for {
		select {
		case <-ctx.Done():
			return nil

		case event, ok := <-stream:
			if !ok {
				s.log.Debug("watch events closed")
				return nil
			}
			s.log.Debug("Server Broadcasting", "type", event.Type, "rv", event.ResourceVersion, "previousRV", event.PreviousRV, "group", event.Key.Group, "namespace", event.Key.Namespace, "resource", event.Key.Resource, "name", event.Key.Name)
			if event.ResourceVersion > since && matchesQueryKey(req.Options.Key, event.Key) {
				if !checker(event.Key.Name, event.Folder) {
					continue
				}

				value := event.Value
				// remove the delete marker stored in the value for deleted objects
				if event.Type == WatchEvent_DELETED {
					value = []byte{}
				}
				resp := &WatchEvent{
					Timestamp: event.Timestamp,
					Type:      event.Type,
					Resource: &WatchEvent_Resource{
						Value:   value,
						Version: event.ResourceVersion,
					},
				}
				if event.PreviousRV > 0 {
					prevObj, err := s.Read(ctx, &ReadRequest{Key: event.Key, ResourceVersion: event.PreviousRV})
					if err != nil {
						// This scenario should never happen, but if it does, we should log it and continue
						// sending the event without the previous object. The client will decide what to do.
						s.log.Error("error reading previous object", "key", event.Key, "resource_version", event.PreviousRV, "error", prevObj.Error)
					} else {
						if prevObj.ResourceVersion != event.PreviousRV {
							s.log.Error("resource version mismatch", "key", event.Key, "resource_version", event.PreviousRV, "actual", prevObj.ResourceVersion)
							return fmt.Errorf("resource version mismatch")
						}
						resp.Previous = &WatchEvent_Resource{
							Value:   prevObj.Value,
							Version: prevObj.ResourceVersion,
						}
					}
				}
				if err := srv.Send(resp); err != nil {
					return err
				}

				if s.storageMetrics != nil {
					// record latency - resource version is a unix timestamp in microseconds so we convert to seconds
					latencySeconds := float64(time.Now().UnixMicro()-event.ResourceVersion) / 1e6
					if latencySeconds > 0 {
						s.storageMetrics.WatchEventLatency.WithLabelValues(event.Key.Resource).Observe(latencySeconds)
					}
				}
			}
		}
	}
}

func (s *server) Search(ctx context.Context, req *ResourceSearchRequest) (*ResourceSearchResponse, error) {
	if s.search == nil {
		return nil, fmt.Errorf("search index not configured")
	}

	if s.shardingEnabled {
		client := s.getClientToDistributeRequest(req.Options.Key.Namespace)
		if client != nil {
			return client.Client.Search(userutils.InjectOrgID(ctx, "1"), req)
		}
	}

	return s.search.Search(ctx, req)
}

// GetStats implements ResourceServer.
func (s *server) GetStats(ctx context.Context, req *ResourceStatsRequest) (*ResourceStatsResponse, error) {
	if err := s.Init(ctx); err != nil {
		return nil, err
	}

	if s.shardingEnabled {
		client := s.getClientToDistributeRequest(req.Namespace)
		if client != nil {
			return client.Client.GetStats(userutils.InjectOrgID(ctx, "1"), req)
		}
	}

	if s.search == nil {
		// If the backend implements "GetStats", we can use it
		srv, ok := s.backend.(ResourceIndexServer)
		if ok {
			return srv.GetStats(ctx, req)
		}
		return nil, fmt.Errorf("search index not configured")
	}
	return s.search.GetStats(ctx, req)
}

func (s *server) ListManagedObjects(ctx context.Context, req *ListManagedObjectsRequest) (*ListManagedObjectsResponse, error) {
	return s.search.ListManagedObjects(ctx, req)
}

func (s *server) CountManagedObjects(ctx context.Context, req *CountManagedObjectsRequest) (*CountManagedObjectsResponse, error) {
	return s.search.CountManagedObjects(ctx, req)
}

// IsHealthy implements ResourceServer.
func (s *server) IsHealthy(ctx context.Context, req *HealthCheckRequest) (*HealthCheckResponse, error) {
	return s.diagnostics.IsHealthy(ctx, req)
}

// GetBlob implements BlobStore.
func (s *server) PutBlob(ctx context.Context, req *PutBlobRequest) (*PutBlobResponse, error) {
	if s.blob == nil {
		return &PutBlobResponse{Error: &ErrorResult{
			Message: "blob store not configured",
			Code:    http.StatusNotImplemented,
		}}, nil
	}

	rsp, err := s.blob.PutResourceBlob(ctx, req)
	if err != nil {
		rsp.Error = AsErrorResult(err)
	}
	return rsp, nil
}

func (s *server) getPartialObject(ctx context.Context, key *ResourceKey, rv int64) (utils.GrafanaMetaAccessor, *ErrorResult) {
	if r := verifyRequestKey(key); r != nil {
		return nil, r
	}

	rsp := s.backend.ReadResource(ctx, &ReadRequest{
		Key:             key,
		ResourceVersion: rv,
	})
	if rsp.Error != nil {
		return nil, rsp.Error
	}

	partial := &metav1.PartialObjectMetadata{}
	err := json.Unmarshal(rsp.Value, partial)
	if err != nil {
		return nil, AsErrorResult(err)
	}
	obj, err := utils.MetaAccessor(partial)
	if err != nil {
		return nil, AsErrorResult(err)
	}
	return obj, nil
}

// GetBlob implements BlobStore.
func (s *server) GetBlob(ctx context.Context, req *GetBlobRequest) (*GetBlobResponse, error) {
	if s.blob == nil {
		return &GetBlobResponse{Error: &ErrorResult{
			Message: "blob store not configured",
			Code:    http.StatusNotImplemented,
		}}, nil
	}

	var info *utils.BlobInfo
	if req.Uid == "" {
		// The linked blob is stored in the resource metadata attributes
		obj, status := s.getPartialObject(ctx, req.Resource, req.ResourceVersion)
		if status != nil {
			return &GetBlobResponse{Error: status}, nil
		}

		info = obj.GetBlob()
		if info == nil || info.UID == "" {
			return &GetBlobResponse{Error: &ErrorResult{
				Message: "Resource does not have a linked blob",
				Code:    404,
			}}, nil
		}
	} else {
		info = &utils.BlobInfo{UID: req.Uid}
	}

	rsp, err := s.blob.GetResourceBlob(ctx, req.Resource, info, req.MustProxyBytes)
	if err != nil {
		rsp.Error = AsErrorResult(err)
	}
	return rsp, nil
}
