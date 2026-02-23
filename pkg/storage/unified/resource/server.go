package resource

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"iter"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/Masterminds/semver"
	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/authlib/authz"
	claims "github.com/grafana/authlib/types"
	"github.com/grafana/dskit/backoff"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apimachinery/validation"
	"github.com/grafana/grafana/pkg/infra/log"
	secrets "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql/rvmanager"
	"github.com/grafana/grafana/pkg/util/scheduler"
)

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/storage/unified/resource")

// ResourceServer implements all gRPC services
type ResourceServer interface {
	SearchServer
	resourcepb.ResourceStoreServer
	resourcepb.BulkStoreServer
	resourcepb.BlobStoreServer
	resourcepb.QuotasServer
	resourcepb.DiagnosticsServer
	ResourceServerStopper
}

// SearchServer implements the search-related gRPC services
type SearchServer interface {
	resourcepb.ResourceIndexServer
	resourcepb.ManagedObjectIndexServer
	resourcepb.DiagnosticsServer
	ResourceServerStopper
}

type ResourceServerStopper interface {
	Stop(ctx context.Context) error
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
	Key    *resourcepb.ResourceKey
	Folder string

	// GUID that is used internally
	GUID string
	// The new resource version
	ResourceVersion int64
	// The properties
	Value []byte
	// Error details
	Error *resourcepb.ErrorResult
}

type ResourceLastImportTime struct {
	NamespacedResource
	LastImportTime time.Time
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
	ReadResource(context.Context, *resourcepb.ReadRequest) *BackendReadResponse

	// When the ResourceServer executes a List request, this iterator will
	// query the backend for potential results.  All results will be
	// checked against the kubernetes requirements before finally returning
	// results.  The list options can be used to improve performance
	// but are the the final answer.
	ListIterator(context.Context, *resourcepb.ListRequest, func(ListIterator) error) (int64, error)

	// ListHistory is like ListIterator, but it returns the history of a resource
	ListHistory(context.Context, *resourcepb.ListRequest, func(ListIterator) error) (int64, error)

	// ListModifiedSince will return all resources that have changed since the given resource version.
	// If a resource has changes, only the latest change will be returned.
	ListModifiedSince(ctx context.Context, key NamespacedResource, sinceRv int64) (int64, iter.Seq2[*ModifiedResource, error])

	// Get all events from the store
	// For HA setups, this will be more events than the local WriteEvent above!
	WatchWriteEvents(ctx context.Context) (<-chan *WrittenEvent, error)

	// Get resource stats within the storage backend.  When namespace is empty, it will apply to all
	GetResourceStats(ctx context.Context, nsr NamespacedResource, minCount int) ([]ResourceStats, error)

	// GetResourceLastImportTimes returns import times for all namespaced resources in the backend.
	GetResourceLastImportTimes(ctx context.Context) iter.Seq2[ResourceLastImportTime, error]
}

type ModifiedResource struct {
	Action          resourcepb.WatchEvent_Type
	Key             resourcepb.ResourceKey
	Value           []byte
	ResourceVersion int64
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
	PutResourceBlob(context.Context, *resourcepb.PutBlobRequest) (*resourcepb.PutBlobResponse, error)

	// Get blob contents.  When possible, this will return a signed URL
	// For large payloads, signed URLs are required to avoid protobuf message size limits
	GetResourceBlob(ctx context.Context, resource *resourcepb.ResourceKey, info *utils.BlobInfo, mustProxy bool) (*resourcepb.GetBlobResponse, error)

	// TODO? List+Delete?  This is for admin access
}

type QOSEnqueuer interface {
	Enqueue(ctx context.Context, tenantID string, runnable func()) error
}

type QueueConfig struct {
	MaxBackoff time.Duration
	MinBackoff time.Duration
	MaxRetries int
	Timeout    time.Duration
}

type BlobConfig struct {
	// The CDK configuration URL
	URL string

	// Directly implemented blob support
	Backend BlobSupport
}

// Passed as input to the constructor
type SearchOptions struct {
	// The raw index backend (eg, bleve, frames, parquet, etc)
	Backend SearchBackend

	// The supported resource types
	Resources DocumentBuilderSupplier

	// How many threads should build indexes
	InitWorkerThreads int

	// Skip building index on startup for small indexes
	InitMinCount int

	// How often to rebuild dashboard index. 0 disables periodic rebuilds.
	DashboardIndexMaxAge time.Duration

	// Maximum age of file-based index that can be reused. Ignored if zero.
	MaxIndexAge time.Duration

	// Minimum build version for reusing file-based indexes. Ignored if nil.
	MinBuildVersion *semver.Version

	// Number of workers to use for index rebuilds.
	IndexRebuildWorkers int

	// Minimum time between index updates. This is also used as a delay after a successful write operation, to guarantee
	// that subsequent search will observe the effect of the writing.
	IndexMinUpdateInterval time.Duration
}

type ResourceServerOptions struct {
	// Real storage backend
	Backend StorageBackend

	// The blob configuration
	Blob BlobConfig

	// Search options
	Search SearchOptions

	// Search client for the storage api
	SearchClient resourcepb.ResourceIndexClient

	// Quota service
	OverridesService *OverridesService

	// Diagnostics
	Diagnostics resourcepb.DiagnosticsServer

	// Check if a user has access to write folders
	// When this is nil, no resources can have folders configured
	WriteHooks WriteAccessHooks

	// Link RBAC
	AccessClient claims.AccessClient

	// Manage secure values
	SecureValues secrets.InlineSecureValueSupport

	// Callbacks for startup and shutdown
	// Get the current time in unix millis
	Now func() int64

	// Registerer to register prometheus Metrics for the Resource server
	Reg prometheus.Registerer

	StorageMetrics *StorageMetrics

	IndexMetrics *BleveIndexMetrics

	// MaxPageSizeBytes is the maximum size of a page in bytes.
	MaxPageSizeBytes int

	// QOSQueue is the quality of service queue used to enqueue
	QOSQueue  QOSEnqueuer
	QOSConfig QueueConfig

	OwnsIndexFn func(key NamespacedResource) (bool, error)

	QuotasConfig QuotasConfig
}

// NewSearchServer creates a standalone search server.
func NewSearchServer(opts ResourceServerOptions) (SearchServer, error) {
	if opts.Backend == nil {
		return nil, fmt.Errorf("missing backend implementation")
	}
	if opts.Diagnostics == nil {
		opts.Diagnostics = &noopService{}
	}

	// Initialize the blob storage
	blobstore, err := initializeBlobStorage(opts)
	if err != nil {
		return nil, err
	}

	// Create the search server using the search.go factory
	searchServer, err := newSearchServer(opts.Search, opts.Backend, opts.AccessClient, blobstore, opts.IndexMetrics, opts.OwnsIndexFn)
	if err != nil || searchServer == nil {
		return nil, fmt.Errorf("search server could not be created: %w", err)
	}
	searchServer.backendDiagnostics = opts.Diagnostics

	// Initialize the search server
	ctx := context.Background()
	if err := searchServer.Init(ctx); err != nil {
		return nil, fmt.Errorf("failed to initialize search server: %w", err)
	}

	return searchServer, nil
}

func NewResourceServer(opts ResourceServerOptions) (*server, error) {
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

	if opts.MaxPageSizeBytes <= 0 {
		// By default, we use 2MB for the page size.
		opts.MaxPageSizeBytes = 1024 * 1024 * 2
	}

	if opts.QOSQueue == nil {
		opts.QOSQueue = scheduler.NewNoopQueue()
	}

	if opts.QOSConfig.Timeout == 0 {
		opts.QOSConfig.Timeout = 30 * time.Second
	}
	if opts.QOSConfig.MaxBackoff == 0 {
		opts.QOSConfig.MaxBackoff = 1 * time.Second
	}
	if opts.QOSConfig.MinBackoff == 0 {
		opts.QOSConfig.MinBackoff = 100 * time.Millisecond
	}
	if opts.QOSConfig.MaxRetries == 0 {
		opts.QOSConfig.MaxRetries = 3
	}

	// Initialize the blob storage
	blobstore, err := initializeBlobStorage(opts)
	if err != nil {
		return nil, err
	}

	logger := log.New("resource-server")

	// Make this cancelable
	ctx, cancel := context.WithCancel(context.Background())
	s := &server{
		log:                            logger,
		backend:                        opts.Backend,
		blob:                           blobstore,
		diagnostics:                    opts.Diagnostics,
		access:                         opts.AccessClient,
		secure:                         opts.SecureValues,
		writeHooks:                     opts.WriteHooks,
		now:                            opts.Now,
		ctx:                            ctx,
		cancel:                         cancel,
		storageMetrics:                 opts.StorageMetrics,
		maxPageSizeBytes:               opts.MaxPageSizeBytes,
		reg:                            opts.Reg,
		queue:                          opts.QOSQueue,
		queueConfig:                    opts.QOSConfig,
		overridesService:               opts.OverridesService,
		storageEnabled:                 true,
		searchClient:                   opts.SearchClient,
		quotasConfig:                   opts.QuotasConfig,
		artificialSuccessfulWriteDelay: opts.Search.IndexMinUpdateInterval,
	}

	if opts.Search.Resources != nil {
		var err error
		s.search, err = newSearchServer(opts.Search, s.backend, s.access, s.blob, opts.IndexMetrics, opts.OwnsIndexFn)
		if err != nil {
			return nil, err
		}
	}

	err = s.Init(ctx)
	if err != nil {
		s.log.Error("resource server init failed", "error", err)
		return nil, err
	}

	return s, nil
}

// initializeBlobStorage initializes blob storage from the provided options.
func initializeBlobStorage(opts ResourceServerOptions) (BlobSupport, error) {
	if opts.Blob.Backend != nil {
		return opts.Blob.Backend, nil
	}

	if opts.Blob.URL != "" {
		ctx := context.Background()
		bucket, err := OpenBlobBucket(ctx, opts.Blob.URL)
		if err != nil {
			return nil, err
		}

		return NewCDKBlobSupport(ctx, CDKBlobSupportOptions{
			Bucket: NewInstrumentedBucket(bucket, opts.Reg),
		})
	}

	// Check if the backend supports blob storage
	blobstore, _ := opts.Backend.(BlobSupport)
	return blobstore, nil
}

var _ ResourceServer = &server{}

type server struct {
	log              log.Logger
	backend          StorageBackend
	blob             BlobSupport
	secure           secrets.InlineSecureValueSupport
	search           *searchServer
	searchClient     resourcepb.ResourceIndexClient
	diagnostics      resourcepb.DiagnosticsServer
	access           claims.AccessClient
	writeHooks       WriteAccessHooks
	now              func() int64
	mostRecentRV     atomic.Int64 // The most recent resource version seen by the server
	storageMetrics   *StorageMetrics
	overridesService *OverridesService
	quotasConfig     QuotasConfig

	// Background watch task -- this has permissions for everything
	ctx         context.Context
	cancel      context.CancelFunc
	broadcaster Broadcaster[*WrittenEvent]

	// init checking
	once    sync.Once
	initErr error

	maxPageSizeBytes int
	reg              prometheus.Registerer
	queue            QOSEnqueuer
	queueConfig      QueueConfig

	// This value is used by storage server to artificially delay returning response after successful
	// write operations to make sure that subsequent search by the same client will return up-to-date results.
	// Set from SearchOptions.IndexMinUpdateInterval.
	artificialSuccessfulWriteDelay time.Duration
	storageEnabled                 bool
}

// Init implements ResourceServer.
func (s *server) Init(ctx context.Context) error {
	s.once.Do(func() {
		// initialize tenant overrides service
		if s.initErr == nil && s.overridesService != nil {
			s.initErr = s.overridesService.init(ctx)
		}

		// initialize the search index
		if s.initErr == nil && s.search != nil {
			s.initErr = s.search.init(ctx)
		}

		// Start watching for changes
		if s.initErr == nil && s.storageEnabled {
			s.initErr = s.initWatcher()
		}

		if s.initErr != nil {
			s.log.Error("error running resource server init", "error", s.initErr)
		}
	})
	return s.initErr
}

func (s *server) Stop(ctx context.Context) error {
	s.initErr = fmt.Errorf("service is stopping")

	var stopFailed bool

	if s.search != nil {
		s.search.stop()
	}

	if s.overridesService != nil {
		if err := s.overridesService.stop(ctx); err != nil {
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
//
//nolint:gocyclo
func (s *server) newEvent(ctx context.Context, user claims.AuthInfo, key *resourcepb.ResourceKey, value, oldValue []byte) (*WriteEvent, *resourcepb.ErrorResult) {
	tmp := &unstructured.Unstructured{}
	err := tmp.UnmarshalJSON(value)
	if err != nil {
		return nil, AsErrorResult(err)
	}
	obj, err := utils.MetaAccessor(tmp)
	if err != nil {
		return nil, AsErrorResult(err)
	}

	l := s.log.FromContext(ctx)
	if obj.GetUID() == "" {
		// TODO! once https://github.com/grafana/grafana/pull/96086 is deployed everywhere
		// return nil, NewBadRequestError("object is missing UID")
		l.Error("object is missing UID", "key", key)
	}

	if obj.GetResourceVersion() != "" {
		l.Error("object must not include a resource version", "key", key)
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
		GUID:   uuid.New().String(),
	}

	if oldValue == nil {
		event.Type = resourcepb.WatchEvent_ADDED
	} else {
		event.Type = resourcepb.WatchEvent_MODIFIED

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

	// Verify that this resource can reference secure values
	if err := canReferenceSecureValues(ctx, obj, event.ObjectOld, s.secure); err != nil {
		return nil, err
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
	if errs := validation.IsValidGrafanaName(obj.GetName()); errs != nil {
		return nil, NewBadRequestError(errs[0])
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

		if event.Type == resourcepb.WatchEvent_MODIFIED {
			check.Verb = utils.VerbUpdate
			check.Name = key.Name
		}

		a, err := s.access.Check(ctx, user, check, obj.GetFolder())
		if err != nil {
			return nil, AsErrorResult(err)
		}
		if !a.Allowed {
			return nil, &resourcepb.ErrorResult{
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
	return event.Type == resourcepb.WatchEvent_MODIFIED &&
		event.ObjectOld != nil &&
		event.ObjectOld.GetFolder() != event.Object.GetFolder()
}

// checkFolderMovePermissions handles permission checks when a resource is being moved between folders
func (s *server) checkFolderMovePermissions(ctx context.Context, user claims.AuthInfo, key *resourcepb.ResourceKey, oldFolder, newFolder string) *resourcepb.ErrorResult {
	// First check if user can update the resource in the original folder
	updateCheck := claims.CheckRequest{
		Verb:      utils.VerbUpdate,
		Group:     key.Group,
		Resource:  key.Resource,
		Namespace: key.Namespace,
		Name:      key.Name,
	}

	a, err := s.access.Check(ctx, user, updateCheck, oldFolder)
	if err != nil {
		return AsErrorResult(err)
	}
	if !a.Allowed {
		return &resourcepb.ErrorResult{
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
		Name:      key.Name,
	}

	a, err = s.access.Check(ctx, user, createCheck, newFolder)
	if err != nil {
		return AsErrorResult(err)
	}
	if !a.Allowed {
		return &resourcepb.ErrorResult{
			Code:    http.StatusForbidden,
			Message: "not allowed to create resource in the destination folder",
		}
	}

	return nil
}

func (s *server) Create(ctx context.Context, req *resourcepb.CreateRequest) (*resourcepb.CreateResponse, error) {
	ctx, span := tracer.Start(ctx, "resource.server.Create")
	defer span.End()

	err := s.checkQuota(ctx, NamespacedResource{
		Namespace: req.Key.Namespace,
		Group:     req.Key.Group,
		Resource:  req.Key.Resource,
	})

	if err != nil {
		var quotaErr QuotaExceededError
		msg := err.Error()
		if errors.As(err, &quotaErr) {
			msg = quotaErr.Message()
		}
		return &resourcepb.CreateResponse{
			Error: &resourcepb.ErrorResult{
				Message: msg,
				Code:    http.StatusForbidden,
			},
		}, nil
	}

	if r := verifyRequestKey(req.Key); r != nil {
		return nil, fmt.Errorf("invalid request key: %s", r.Message)
	}

	rsp := &resourcepb.CreateResponse{}
	user, ok := claims.AuthInfoFrom(ctx)
	if !ok || user == nil {
		rsp.Error = &resourcepb.ErrorResult{
			Message: "no user found in context",
			Code:    http.StatusUnauthorized,
		}
		return rsp, nil
	}

	var res *resourcepb.CreateResponse
	runErr := s.runInQueue(ctx, req.Key.Namespace, func(queueCtx context.Context) {
		res, err = s.create(queueCtx, user, req)
	})
	if runErr != nil {
		return HandleQueueError(runErr, func(e *resourcepb.ErrorResult) *resourcepb.CreateResponse {
			return &resourcepb.CreateResponse{Error: e}
		})
	}

	s.sleepAfterSuccessfulWriteOperation("Create", req.Key, res, err)

	return res, err
}

func (s *server) create(ctx context.Context, user claims.AuthInfo, req *resourcepb.CreateRequest) (*resourcepb.CreateResponse, error) {
	rsp := &resourcepb.CreateResponse{}

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
	s.log.FromContext(ctx).Debug("server.WriteEvent", "type", event.Type, "rv", rsp.ResourceVersion, "previousRV", event.PreviousRV, "group", event.Key.Group, "namespace", event.Key.Namespace, "name", event.Key.Name, "resource", event.Key.Resource)
	return rsp, nil
}

type responseWithErrorResult interface {
	GetError() *resourcepb.ErrorResult
}

// sleepAfterSuccessfulWriteOperation will sleep for a specified time if the operation was successful.
// Returns boolean indicating whether the sleep was performed or not (used in testing).
//
// This sleep is performed to guarantee search-after-write consistency, when rate-limiting updates to search index.
func (s *server) sleepAfterSuccessfulWriteOperation(operation string, key *resourcepb.ResourceKey, res responseWithErrorResult, err error) bool {
	if s.artificialSuccessfulWriteDelay <= 0 {
		return false
	}

	if err != nil {
		// No sleep necessary if operation failed.
		return false
	}

	// We expect that non-nil interface values with typed nils can still handle GetError() call.
	if res != nil {
		errRes := res.GetError()
		if errRes != nil {
			// No sleep necessary if operation failed.
			return false
		}
	}

	s.log.Debug("sleeping after successful write operation",
		"operation", operation,
		"delay", s.artificialSuccessfulWriteDelay,
		"group", key.Group,
		"resource", key.Resource,
		"namespace", key.Namespace,
		"name", key.Name)

	time.Sleep(s.artificialSuccessfulWriteDelay)
	return true
}

func (s *server) Update(ctx context.Context, req *resourcepb.UpdateRequest) (*resourcepb.UpdateResponse, error) {
	ctx, span := tracer.Start(ctx, "resource.server.Update")
	defer span.End()

	rsp := &resourcepb.UpdateResponse{}
	user, ok := claims.AuthInfoFrom(ctx)
	if !ok || user == nil {
		rsp.Error = &resourcepb.ErrorResult{
			Message: "no user found in context",
			Code:    http.StatusUnauthorized,
		}
		return rsp, nil
	}
	if req.ResourceVersion < 0 {
		rsp.Error = AsErrorResult(apierrors.NewBadRequest("update must include the previous version"))
		return rsp, nil
	}

	var (
		res *resourcepb.UpdateResponse
		err error
	)
	runErr := s.runInQueue(ctx, req.Key.Namespace, func(queueCtx context.Context) {
		res, err = s.update(queueCtx, user, req)
	})
	if runErr != nil {
		return HandleQueueError(runErr, func(e *resourcepb.ErrorResult) *resourcepb.UpdateResponse {
			return &resourcepb.UpdateResponse{Error: e}
		})
	}

	s.sleepAfterSuccessfulWriteOperation("Update", req.Key, res, err)

	return res, err
}

func (s *server) update(ctx context.Context, user claims.AuthInfo, req *resourcepb.UpdateRequest) (*resourcepb.UpdateResponse, error) {
	rsp := &resourcepb.UpdateResponse{}
	latest := s.backend.ReadResource(ctx, &resourcepb.ReadRequest{
		Key: req.Key,
	})
	if latest.Error != nil {
		return rsp, nil
	}
	if latest.Value == nil {
		rsp.Error = NewBadRequestError("current value does not exist")
		return rsp, nil
	}

	// TODO: once we know the client is always sending the RV, require ResourceVersion > 0
	// See: https://github.com/grafana/grafana/pull/111866
	if req.ResourceVersion > 0 && !rvmanager.IsRvEqual(latest.ResourceVersion, req.ResourceVersion) {
		return &resourcepb.UpdateResponse{
			Error: &ErrOptimisticLockingFailed,
		}, nil
	}

	event, e := s.newEvent(ctx, user, req.Key, req.Value, latest.Value)
	if e != nil {
		rsp.Error = e
		return rsp, nil
	}

	event.Type = resourcepb.WatchEvent_MODIFIED
	event.PreviousRV = latest.ResourceVersion

	var err error
	rsp.ResourceVersion, err = s.backend.WriteEvent(ctx, *event)
	if err != nil {
		rsp.Error = AsErrorResult(err)
	}
	return rsp, nil
}

func (s *server) Delete(ctx context.Context, req *resourcepb.DeleteRequest) (*resourcepb.DeleteResponse, error) {
	ctx, span := tracer.Start(ctx, "resource.server.Delete")
	defer span.End()

	rsp := &resourcepb.DeleteResponse{}
	if req.ResourceVersion < 0 {
		return nil, apierrors.NewBadRequest("update must include the previous version")
	}
	user, ok := claims.AuthInfoFrom(ctx)
	if !ok || user == nil {
		rsp.Error = &resourcepb.ErrorResult{
			Message: "no user found in context",
			Code:    http.StatusUnauthorized,
		}
		return rsp, nil
	}

	var (
		res *resourcepb.DeleteResponse
		err error
	)

	runErr := s.runInQueue(ctx, req.Key.Namespace, func(queueCtx context.Context) {
		res, err = s.delete(queueCtx, user, req)
	})
	if runErr != nil {
		return HandleQueueError(runErr, func(e *resourcepb.ErrorResult) *resourcepb.DeleteResponse {
			return &resourcepb.DeleteResponse{Error: e}
		})
	}

	s.sleepAfterSuccessfulWriteOperation("Delete", req.Key, res, err)

	return res, err
}

func (s *server) delete(ctx context.Context, user claims.AuthInfo, req *resourcepb.DeleteRequest) (*resourcepb.DeleteResponse, error) {
	rsp := &resourcepb.DeleteResponse{}
	latest := s.backend.ReadResource(ctx, &resourcepb.ReadRequest{
		Key: req.Key,
	})
	if latest.Error != nil {
		rsp.Error = latest.Error
		return rsp, nil
	}
	if req.ResourceVersion > 0 && !rvmanager.IsRvEqual(latest.ResourceVersion, req.ResourceVersion) {
		rsp.Error = &ErrOptimisticLockingFailed
		return rsp, nil
	}

	access, err := s.access.Check(ctx, user, claims.CheckRequest{
		Verb:      "delete",
		Group:     req.Key.Group,
		Resource:  req.Key.Resource,
		Namespace: req.Key.Namespace,
		Name:      req.Key.Name,
	}, latest.Folder)
	if err != nil {
		rsp.Error = AsErrorResult(err)
		return rsp, nil
	}
	if !access.Allowed {
		rsp.Error = &resourcepb.ErrorResult{
			Code: http.StatusForbidden,
		}
		return rsp, nil
	}

	now := metav1.NewTime(time.UnixMilli(s.now()))
	event := WriteEvent{
		Key:        req.Key,
		Type:       resourcepb.WatchEvent_DELETED,
		PreviousRV: latest.ResourceVersion,
		GUID:       uuid.New().String(),
	}
	marker := &unstructured.Unstructured{}
	err = json.Unmarshal(latest.Value, marker)
	if err != nil {
		return nil, apierrors.NewBadRequest(
			fmt.Sprintf("unable to read previous object, %v", err))
	}
	oldObj, err := utils.MetaAccessor(marker)
	if err != nil {
		return nil, err
	}

	obj, err := utils.MetaAccessor(marker)
	if err != nil {
		return nil, err
	}
	obj.SetDeletionTimestamp(&now)
	obj.SetUpdatedTimestamp(&now.Time)
	obj.SetManagedFields(nil)
	obj.SetFinalizers(nil)
	obj.SetUpdatedBy(user.GetUID())
	obj.SetGeneration(utils.DeletedGeneration)
	obj.SetAnnotation(utils.AnnoKeyKubectlLastAppliedConfig, "") // clears it
	event.ObjectOld = oldObj
	event.Object = obj
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

func (s *server) Read(ctx context.Context, req *resourcepb.ReadRequest) (*resourcepb.ReadResponse, error) {
	user, ok := claims.AuthInfoFrom(ctx)
	if !ok || user == nil {
		return &resourcepb.ReadResponse{
			Error: &resourcepb.ErrorResult{
				Message: "no user found in context",
				Code:    http.StatusUnauthorized,
			}}, nil
	}

	if req.Key.Resource == "" {
		return &resourcepb.ReadResponse{Error: NewBadRequestError("missing resource")}, nil
	}

	var (
		res *resourcepb.ReadResponse
		err error
	)
	runErr := s.runInQueue(ctx, req.Key.Namespace, func(queueCtx context.Context) {
		res, err = s.read(queueCtx, user, req)
	})
	if runErr != nil {
		return HandleQueueError(runErr, func(e *resourcepb.ErrorResult) *resourcepb.ReadResponse {
			return &resourcepb.ReadResponse{Error: e}
		})
	}

	return res, err
}

func (s *server) read(ctx context.Context, user claims.AuthInfo, req *resourcepb.ReadRequest) (*resourcepb.ReadResponse, error) {
	rsp := s.backend.ReadResource(ctx, req)
	if rsp.Error != nil && rsp.Error.Code == http.StatusNotFound {
		return &resourcepb.ReadResponse{Error: rsp.Error}, nil
	}

	a, err := s.access.Check(ctx, user, claims.CheckRequest{
		Verb:      "get",
		Group:     req.Key.Group,
		Resource:  req.Key.Resource,
		Namespace: req.Key.Namespace,
		Name:      req.Key.Name,
	}, rsp.Folder)
	if err != nil {
		return &resourcepb.ReadResponse{Error: AsErrorResult(err)}, nil
	}
	if !a.Allowed {
		return &resourcepb.ReadResponse{
			Error: &resourcepb.ErrorResult{
				Code: http.StatusForbidden,
			}}, nil
	}
	return &resourcepb.ReadResponse{
		ResourceVersion: rsp.ResourceVersion,
		Value:           rsp.Value,
		Error:           rsp.Error,
	}, nil
}

func (s *server) List(ctx context.Context, req *resourcepb.ListRequest) (*resourcepb.ListResponse, error) {
	ctx, span := tracer.Start(ctx, "resource.server.List")
	span.SetAttributes(attribute.String("group", req.Options.Key.Group), attribute.String("resource", req.Options.Key.Resource))
	defer span.End()

	// The history + trash queries do not yet support additional filters
	if req.Source != resourcepb.ListRequest_STORE {
		if len(req.Options.Fields) > 0 || len(req.Options.Labels) > 0 {
			return &resourcepb.ListResponse{
				Error: NewBadRequestError("unexpected field/label selector for history query"),
			}, nil
		}
	}

	if _, ok := claims.AuthInfoFrom(ctx); !ok {
		return &resourcepb.ListResponse{
			Error: &resourcepb.ErrorResult{
				Message: "no user found in context",
				Code:    http.StatusUnauthorized,
			}}, nil
	}

	// Do not allow label query for trash/history
	for _, v := range req.Options.Labels {
		if v.Key == utils.LabelKeyGetHistory || v.Key == utils.LabelKeyGetTrash {
			return &resourcepb.ListResponse{Error: NewBadRequestError("history and trash must be requested as source")}, nil
		}
	}

	// Fast path for getting single value in a list
	if rsp := s.tryFieldSelector(ctx, req); rsp != nil {
		return rsp, nil
	}

	if req.Limit < 1 {
		req.Limit = 500 // default max 500 items in a page
	}

	req = filterFieldSelectors(req)
	if s.useFieldSelectorSearch(req) {
		// If we get here, we're doing list with selectable fields. Let's do search instead, since
		// we index all selectable fields, and fetch resulting documents one by one.
		gr := req.Options.Key.Group + "/" + req.Options.Key.Resource
		if s.storageMetrics != nil {
			s.storageMetrics.ListWithFieldSelectors.WithLabelValues(gr, "search").Inc()
		}
		return s.listWithFieldSelectors(ctx, req)
	}

	switch req.Source {
	case resourcepb.ListRequest_STORE:
		return s.listAuthorized(ctx, req, s.backend.ListIterator)
	case resourcepb.ListRequest_HISTORY:
		return s.listAuthorized(ctx, req, s.backend.ListHistory)
	case resourcepb.ListRequest_TRASH:
		return s.listFromTrash(ctx, req)
	default:
		return nil, apierrors.NewBadRequest(fmt.Sprintf("invalid list source: %v", req.Source))
	}
}

// listBackendFunc is the signature shared by ListIterator and ListHistory.
type listBackendFunc func(context.Context, *resourcepb.ListRequest, func(ListIterator) error) (int64, error)

// listAuthorized lists resources using batch authorization via FilterAuthorized.
// The backendList parameter selects the backend method (ListIterator or ListHistory).
func (s *server) listAuthorized(ctx context.Context, req *resourcepb.ListRequest, backendList listBackendFunc) (*resourcepb.ListResponse, error) {
	// candidateItem holds metadata from the ListIterator for batch authorization.
	type candidateItem struct {
		name            string
		folder          string
		resourceVersion int64
		value           []byte
		continueToken   string
	}

	key := req.Options.Key
	rsp := &resourcepb.ListResponse{}
	var (
		pageBytes int
		nextToken string
	)
	maxPageBytes := s.maxPageSizeBytes

	rv, err := backendList(ctx, req, func(iter ListIterator) error {
		// Convert ListIterator to iter.Seq for FilterAuthorized
		candidates := func(yield func(candidateItem) bool) {
			for iter.Next() {
				if err := iter.Error(); err != nil {
					return
				}
				if !yield(candidateItem{
					name:            iter.Name(),
					folder:          iter.Folder(),
					resourceVersion: iter.ResourceVersion(),
					value:           iter.Value(),
					continueToken:   iter.ContinueToken(),
				}) {
					return
				}
			}
		}

		extractFn := func(c candidateItem) authz.BatchCheckItem {
			return authz.BatchCheckItem{
				Name:               c.name,
				Folder:             c.folder,
				Verb:               utils.VerbGet,
				Group:              key.Group,
				Resource:           key.Resource,
				Namespace:          key.Namespace,
				FreshnessTimestamp: resourceVersionTime(c.resourceVersion),
			}
		}

		var lastContinueToken string
		for item, err := range authz.FilterAuthorized(ctx, s.access, candidates, extractFn, authz.WithTracer(tracer)) {
			if err != nil {
				return err
			}

			// If the page is already full, this extra authorized item confirms
			// there are more results. Set the continue token and stop.
			if (req.Limit > 0 && len(rsp.Items) >= int(req.Limit)) || pageBytes >= maxPageBytes {
				nextToken = lastContinueToken
				break
			}

			rsp.Items = append(rsp.Items, &resourcepb.ResourceWrapper{
				ResourceVersion: item.resourceVersion,
				Value:           item.value,
			})
			pageBytes += len(item.value)
			lastContinueToken = item.continueToken
		}

		return iter.Error()
	})

	return s.finalizeListResponse(rsp, rv, err, nextToken, req.Options.Key)
}

// listFromTrash lists deleted resources. Trash uses a different authorization
// model: the user must be admin OR the user who deleted the object.
func (s *server) listFromTrash(ctx context.Context, req *resourcepb.ListRequest) (*resourcepb.ListResponse, error) {
	user, ok := claims.AuthInfoFrom(ctx)
	if !ok || user == nil {
		return &resourcepb.ListResponse{
			Error: &resourcepb.ErrorResult{
				Message: "no user found in context",
				Code:    http.StatusUnauthorized,
			}}, nil
	}

	key := req.Options.Key

	rsp := &resourcepb.ListResponse{}
	var (
		pageBytes int
		nextToken string
	)
	maxPageBytes := s.maxPageSizeBytes

	// Cache admin check results per folder to avoid redundant Check calls
	// for items in the same folder.
	folderAdminCache := make(map[string]bool)

	rv, err := s.backend.ListHistory(ctx, req, func(iter ListIterator) error {
		for iter.Next() {
			if err := iter.Error(); err != nil {
				return err
			}

			// Parse item metadata — needed for both provisioned and authorization checks.
			obj, err := parseTrashItem(iter.Value())
			if err != nil {
				continue
			}

			// Provisioned objects should never be retrievable from trash.
			if obj.GetAnnotation(utils.AnnoKeyManagerKind) != "" {
				continue
			}

			// Check if user is admin in this folder (cached) or the user who deleted the item.
			if !s.checkFolderAdmin(ctx, user, iter.Folder(), key, folderAdminCache) {
				if obj.GetUpdatedBy() != user.GetUID() {
					continue
				}
			}

			item := &resourcepb.ResourceWrapper{
				ResourceVersion: iter.ResourceVersion(),
				Value:           iter.Value(),
			}

			pageBytes += len(item.Value)
			rsp.Items = append(rsp.Items, item)
			if (req.Limit > 0 && len(rsp.Items) >= int(req.Limit)) || pageBytes >= maxPageBytes {
				t := iter.ContinueToken()
				if iter.Next() {
					nextToken = t
				}
				return iter.Error()
			}
		}
		return iter.Error()
	})

	return s.finalizeListResponse(rsp, rv, err, nextToken, req.Options.Key)
}

// finalizeListResponse validates the resource version, sets pagination token,
// and records metrics. Shared by listFromStore, listFromHistory, and listFromTrash.
func (s *server) finalizeListResponse(rsp *resourcepb.ListResponse, rv int64, err error, nextToken string, key *resourcepb.ResourceKey) (*resourcepb.ListResponse, error) {
	if err != nil {
		rsp.Error = AsErrorResult(err)
		return rsp, nil
	}

	if rv < 1 {
		rsp.Error = &resourcepb.ErrorResult{
			Code:    http.StatusInternalServerError,
			Message: fmt.Sprintf("invalid resource version for list: %v", rv),
		}
		return rsp, nil
	}

	rsp.ResourceVersion = rv
	rsp.NextPageToken = nextToken
	gr := key.Group + "/" + key.Resource
	if s.storageMetrics != nil {
		s.storageMetrics.ListWithFieldSelectors.WithLabelValues(gr, "storage").Inc()
	}
	return rsp, nil
}

// checkFolderAdmin checks whether the user has admin permission (VerbSetPermissions) in the given
// folder. Results are cached per folder to avoid redundant Check calls.
func (s *server) checkFolderAdmin(ctx context.Context, user claims.AuthInfo, folder string, key *resourcepb.ResourceKey, cache map[string]bool) bool {
	if isAdmin, ok := cache[folder]; ok {
		return isAdmin
	}
	resp, err := s.access.Check(ctx, user, claims.CheckRequest{
		Verb:      utils.VerbSetPermissions,
		Group:     key.Group,
		Resource:  key.Resource,
		Namespace: key.Namespace,
	}, folder)
	isAdmin := err == nil && resp.Allowed
	cache[folder] = isAdmin
	return isAdmin
}

// parseTrashItem unmarshals the raw value into a GrafanaMetaAccessor.
func parseTrashItem(value []byte) (utils.GrafanaMetaAccessor, error) {
	partial := &metav1.PartialObjectMetadata{}
	if err := json.Unmarshal(value, partial); err != nil {
		return nil, err
	}
	return utils.MetaAccessor(partial)
}

// Start the server.broadcaster (requires that the backend storage services are enabled)
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
func (s *server) Watch(req *resourcepb.WatchRequest, srv resourcepb.ResourceStore_WatchServer) error {
	ctx := srv.Context()

	user, ok := claims.AuthInfoFrom(ctx)
	if !ok || user == nil {
		return apierrors.NewUnauthorized("no user found in context")
	}

	key := req.Options.Key
	//nolint:staticcheck // SA1019: Compile is deprecated but BatchCheck is not yet fully implemented
	checker, _, err := s.access.Compile(ctx, user, claims.ListRequest{
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

	// Determine a safe starting resource-version for the watch.
	// When the client requests SendInitialEvents we will use the resource-version
	// of the last object returned from the initial list (handled below).
	// When the client supplies an explicit `since` we honour that.
	// In the remaining case (SendInitialEvents == false && since == 0) we need
	// a high-water-mark representing the current state of storage so that we
	// donʼt replay events that happened before the watch was established. Using
	// `mostRecentRV` – which is updated asynchronously by the broadcaster – is
	// subject to races because the broadcaster may not yet have observed the
	// latest committed writes. Instead we ask the backend directly for the
	// current resource-version.
	var mostRecentRV int64
	if !req.SendInitialEvents && req.Since == 0 {
		// We only need the current RV. A cheap way to obtain it is to issue a
		// List with a very small limit and read the listRV returned by the
		// iterator. The callback is a no-op so we avoid materialising any
		// items.
		listReq := &resourcepb.ListRequest{
			Options: req.Options,
			// This has right now no effect, as the list request only uses the limit if it lists from history or trash.
			// It might be worth adding it in a subsequent PR. We only list once during setup of the watch, so it's
			// fine for now.
			Limit: 1,
		}

		rv, err := s.backend.ListIterator(ctx, listReq, func(ListIterator) error { return nil })
		if err != nil {
			// Fallback to the broadcasterʼs view if the backend lookup fails.
			// This preserves previous behaviour while still eliminating the
			// common race in the majority of cases.
			s.log.Warn("watch: failed to fetch current RV from backend, falling back to broadcaster", "err", err)
			mostRecentRV = s.mostRecentRV.Load()
		} else {
			mostRecentRV = rv
		}
	} else {
		// For all other code-paths we either already have an explicit RV or we
		// will derive it from the initial list below.
		mostRecentRV = s.mostRecentRV.Load()
	}

	var initialEventsRV int64 // resource version coming from the initial events
	if req.SendInitialEvents {
		// Backfill the stream by adding every existing entities.
		initialEventsRV, err = s.backend.ListIterator(ctx, &resourcepb.ListRequest{Options: req.Options}, func(iter ListIterator) error {
			for iter.Next() {
				if err := iter.Error(); err != nil {
					return err
				}
				if err := srv.Send(&resourcepb.WatchEvent{
					Type: resourcepb.WatchEvent_ADDED,
					Resource: &resourcepb.WatchEvent_Resource{
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
		if err := srv.Send(&resourcepb.WatchEvent{
			Type: resourcepb.WatchEvent_BOOKMARK,
			Resource: &resourcepb.WatchEvent_Resource{
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
				if event.Type == resourcepb.WatchEvent_DELETED {
					value = []byte{}
				}
				resp := &resourcepb.WatchEvent{
					Timestamp: event.Timestamp,
					Type:      event.Type,
					Resource: &resourcepb.WatchEvent_Resource{
						Value:   value,
						Version: event.ResourceVersion,
					},
				}
				if event.PreviousRV > 0 {
					prevObj, err := s.Read(ctx, &resourcepb.ReadRequest{Key: event.Key, ResourceVersion: event.PreviousRV})
					if err != nil {
						// This scenario should never happen, but if it does, we should log it and continue
						// sending the event without the previous object. The client will decide what to do.
						s.log.Error("error reading previous object", "key", event.Key, "resource_version", event.PreviousRV, "error", prevObj.Error)
					} else {
						if prevObj.ResourceVersion != event.PreviousRV {
							s.log.Error("resource version mismatch", "key", event.Key, "resource_version", event.PreviousRV, "actual", prevObj.ResourceVersion)
							return fmt.Errorf("resource version mismatch")
						}
						resp.Previous = &resourcepb.WatchEvent_Resource{
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

func (s *server) Search(ctx context.Context, req *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
	if s.search == nil {
		return nil, fmt.Errorf("search index not configured")
	}

	return s.search.Search(ctx, req)
}

// StatsGetter provides resource statistics (via search index or backend).
type StatsGetter interface {
	GetStats(ctx context.Context, req *resourcepb.ResourceStatsRequest) (*resourcepb.ResourceStatsResponse, error)
}

// GetStats implements ResourceServer.
func (s *server) GetStats(ctx context.Context, req *resourcepb.ResourceStatsRequest) (*resourcepb.ResourceStatsResponse, error) {
	if err := s.Init(ctx); err != nil {
		return nil, err
	}

	if s.search == nil {
		// If the backend implements "GetStats", we can use it
		srv, ok := s.backend.(StatsGetter)
		if ok {
			return srv.GetStats(ctx, req)
		}
		return nil, fmt.Errorf("search index not configured")
	}
	return s.search.GetStats(ctx, req)
}

func (s *server) ListManagedObjects(ctx context.Context, req *resourcepb.ListManagedObjectsRequest) (*resourcepb.ListManagedObjectsResponse, error) {
	if s.search == nil {
		return nil, fmt.Errorf("search index not configured")
	}

	return s.search.ListManagedObjects(ctx, req)
}

func (s *server) CountManagedObjects(ctx context.Context, req *resourcepb.CountManagedObjectsRequest) (*resourcepb.CountManagedObjectsResponse, error) {
	if s.search == nil {
		return nil, fmt.Errorf("search index not configured")
	}

	return s.search.CountManagedObjects(ctx, req)
}

// IsHealthy implements ResourceServer.
func (s *server) IsHealthy(ctx context.Context, req *resourcepb.HealthCheckRequest) (*resourcepb.HealthCheckResponse, error) {
	return s.diagnostics.IsHealthy(ctx, req)
}

// GetBlob implements BlobStore.
func (s *server) PutBlob(ctx context.Context, req *resourcepb.PutBlobRequest) (*resourcepb.PutBlobResponse, error) {
	if s.blob == nil {
		return &resourcepb.PutBlobResponse{Error: &resourcepb.ErrorResult{
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

func (s *server) GetQuotaUsage(ctx context.Context, req *resourcepb.QuotaUsageRequest) (*resourcepb.QuotaUsageResponse, error) {
	if s.overridesService == nil {
		return &resourcepb.QuotaUsageResponse{Error: &resourcepb.ErrorResult{
			Message: "overrides service not configured on resource server",
			Code:    http.StatusNotImplemented,
		}}, nil
	}
	nsr := NamespacedResource{
		Namespace: req.Key.Namespace,
		Group:     req.Key.Group,
		Resource:  req.Key.Resource,
	}
	usage, err := s.backend.GetResourceStats(ctx, nsr, 0)
	if err != nil {
		return &resourcepb.QuotaUsageResponse{Error: AsErrorResult(err)}, nil
	}
	limit, err := s.overridesService.GetQuota(ctx, nsr)
	if err != nil {
		return &resourcepb.QuotaUsageResponse{Error: AsErrorResult(err)}, nil
	}

	// handle case where no resources exist yet - very unlikely but possible
	rsp := &resourcepb.QuotaUsageResponse{Limit: int64(limit.Limit)}
	if len(usage) <= 0 {
		rsp.Usage = 0
	} else {
		rsp.Usage = usage[0].Count
	}

	return rsp, nil
}

func (s *server) getPartialObject(ctx context.Context, key *resourcepb.ResourceKey, rv int64) (utils.GrafanaMetaAccessor, *resourcepb.ErrorResult) {
	if r := verifyRequestKey(key); r != nil {
		return nil, r
	}

	rsp := s.backend.ReadResource(ctx, &resourcepb.ReadRequest{
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
func (s *server) GetBlob(ctx context.Context, req *resourcepb.GetBlobRequest) (*resourcepb.GetBlobResponse, error) {
	if s.blob == nil {
		return &resourcepb.GetBlobResponse{Error: &resourcepb.ErrorResult{
			Message: "blob store not configured",
			Code:    http.StatusNotImplemented,
		}}, nil
	}

	var info *utils.BlobInfo
	if req.Uid == "" {
		// The linked blob is stored in the resource metadata attributes
		obj, status := s.getPartialObject(ctx, req.Resource, req.ResourceVersion)
		if status != nil {
			return &resourcepb.GetBlobResponse{Error: status}, nil
		}

		info = obj.GetBlob()
		if info == nil || info.UID == "" {
			return &resourcepb.GetBlobResponse{Error: &resourcepb.ErrorResult{
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

func (s *server) runInQueue(ctx context.Context, tenantID string, runnable func(ctx context.Context)) error {
	// Enforce a timeout for the entire operation, including queueing and execution.
	queueCtx, cancel := context.WithTimeout(ctx, s.queueConfig.Timeout)
	defer cancel()

	done := make(chan struct{})
	wrappedRunnable := func() {
		defer close(done)
		runnable(queueCtx)
	}

	// Retry enqueueing with backoff, respecting the timeout context.
	boff := backoff.New(queueCtx, backoff.Config{
		MinBackoff: s.queueConfig.MinBackoff,
		MaxBackoff: s.queueConfig.MaxBackoff,
		MaxRetries: s.queueConfig.MaxRetries,
	})

	for {
		err := s.queue.Enqueue(queueCtx, tenantID, wrappedRunnable)
		if err == nil {
			// Successfully enqueued.
			break
		}

		s.log.Warn("failed to enqueue runnable, retrying", "tenantID", tenantID, "error", err)
		if !boff.Ongoing() {
			// Backoff finished (retries exhausted or context canceled).
			return fmt.Errorf("failed to enqueue for tenant %s: %w", tenantID, err)
		}
		boff.Wait()
	}

	// Wait for the runnable to complete or for the context to be done.
	select {
	case <-done:
		return nil // Completed successfully.
	case <-queueCtx.Done():
		return queueCtx.Err() // Timed out or canceled while waiting for execution.
	}
}

func (s *server) RebuildIndexes(ctx context.Context, req *resourcepb.RebuildIndexesRequest) (*resourcepb.RebuildIndexesResponse, error) {
	if s.search == nil {
		return nil, fmt.Errorf("search index not configured")
	}

	return s.search.RebuildIndexes(ctx, req)
}

func (s *server) checkQuota(ctx context.Context, nsr NamespacedResource) error {
	span := trace.SpanFromContext(ctx)
	span.AddEvent("checkQuota", trace.WithAttributes(
		attribute.String("namespace", nsr.Namespace),
		attribute.String("group", nsr.Group),
		attribute.String("resource", nsr.Resource),
	))

	if s.overridesService == nil {
		s.log.FromContext(ctx).Debug("overrides service not configured, skipping quota check", "namespace", nsr.Namespace, "group", nsr.Group, "resource", nsr.Resource)
		return nil
	}

	quota, err := s.overridesService.GetQuota(ctx, nsr)
	if err != nil {
		s.log.FromContext(ctx).Error("failed to get quota for resource", "namespace", nsr.Namespace, "group", nsr.Group, "resource", nsr.Resource, "error", err)
		return nil
	}

	stats, err := s.backend.GetResourceStats(ctx, nsr, 0)
	if err != nil {
		s.log.FromContext(ctx).Error("failed to get resource stats for quota checking", "namespace", nsr.Namespace, "group", nsr.Group, "resource", nsr.Resource, "error", err)
		return nil
	}
	if len(stats) > 0 {
		s.log.FromContext(ctx).Debug("stats found", "namespace", nsr.Namespace, "group", nsr.Group, "resource", nsr.Resource, "count", stats[0].Count)
	} else {
		s.log.FromContext(ctx).Debug("no stats found for resource", "namespace", nsr.Namespace, "group", nsr.Group, "resource", nsr.Resource)
	}

	if len(stats) > 0 && stats[0].Count >= int64(quota.Limit) {
		s.log.FromContext(ctx).Info("Quota exceeded on create", "namespace", nsr.Namespace, "group", nsr.Group, "resource", nsr.Resource, "quota", quota.Limit, "count", stats[0].Count, "stats_resource", stats[0].Resource)
		if s.quotasConfig.EnforceQuotas {
			return QuotaExceededError{
				Resource:       nsr.Resource,
				Used:           stats[0].Count,
				Limit:          quota.Limit,
				SupportMessage: s.quotasConfig.SupportMessage,
			}
		}
	}

	return nil
}

// resourceVersionTime extracts the timestamp embedded in a resource version.
// Resource versions can be either snowflake IDs (KV backend) or microsecond
// Unix timestamps (SQL backend).
func resourceVersionTime(rv int64) time.Time {
	micro := rv
	if isSnowflake(rv) {
		micro = rvmanager.RVFromSnowflake(rv)
	}
	return time.UnixMicro(micro)
}
