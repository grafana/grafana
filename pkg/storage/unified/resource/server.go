package resource

import (
	context "context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// Package-level errors.
var (
	ErrNotFound                 = errors.New("resource not found")
	ErrOptimisticLockingFailed  = errors.New("optimistic locking failed")
	ErrUserNotFoundInContext    = errors.New("user not found in context")
	ErrUnableToReadResourceJSON = errors.New("unable to read resource json")
	ErrNotImplementedYet        = errors.New("not implemented yet")
)

// ResourceServer implements all services
type ResourceServer interface {
	ResourceStoreServer
	ResourceIndexServer
	BlobStoreServer
	DiagnosticsServer
	LifecycleHooks
}

// The StorageBackend is an internal abstraction that supports interacting with
// the underlying raw storage medium.  This interface is never exposed directly,
// it is provided by concrete instances that actually write values.
type StorageBackend interface {
	// Write a Create/Update/Delete,
	// NOTE: the contents of WriteEvent have been validated
	// Return the revisionVersion for this event or error
	WriteEvent(context.Context, WriteEvent) (int64, error)

	// Read a value from storage optionally at an explicit version
	Read(context.Context, *ReadRequest) (*ReadResponse, error)

	// When the ResourceServer executes a List request, it will first
	// query the backend for potential results.  All results will be
	// checked against the kubernetes requirements before finally returning
	// results.  The list options can be used to improve performance
	// but are the the final answer.
	PrepareList(context.Context, *ListRequest) (*ListResponse, error)

	// Get all events from the store
	// For HA setups, this will be more events than the local WriteEvent above!
	WatchWriteEvents(ctx context.Context) (<-chan *WrittenEvent, error)
}

// This interface is not exposed to end users directly
// Access to this interface is already gated by access control
type BlobStore interface {
	// Indicates if storage layer supports signed urls
	SupportsSignedURLs() bool

	// Get the raw blob bytes and metadata -- limited to protobuf message size
	// For larger payloads, we should use presigned URLs to upload from the client
	PutBlob(context.Context, *PutBlobRequest) (*PutBlobResponse, error)

	// Get blob contents.  When possible, this will return a signed URL
	// For large payloads, signed URLs are required to avoid protobuf message size limits
	GetBlob(ctx context.Context, resource *ResourceKey, info *utils.BlobInfo, mustProxy bool) (*GetBlobResponse, error)

	// TODO? List+Delete?  This is for admin access
}

type ResourceServerOptions struct {
	// OTel tracer
	Tracer trace.Tracer

	// Real storage backend
	Backend StorageBackend

	// The blob storage engine
	Blob BlobStore

	// Real storage backend
	Search ResourceIndexServer

	// Diagnostics
	Diagnostics DiagnosticsServer

	// Check if a user has access to write folders
	// When this is nil, no resources can have folders configured
	WriteAccess WriteAccessHooks

	// Callbacks for startup and shutdown
	Lifecycle LifecycleHooks

	// Get the current time in unix millis
	Now func() int64
}

func NewResourceServer(opts ResourceServerOptions) (ResourceServer, error) {
	if opts.Tracer == nil {
		opts.Tracer = noop.NewTracerProvider().Tracer("resource-server")
	}

	if opts.Backend == nil {
		return nil, fmt.Errorf("missing Backend implementation")
	}
	if opts.Search == nil {
		opts.Search = &noopService{}
	}
	if opts.Blob == nil {
		opts.Blob = &noopService{}
	}
	if opts.Diagnostics == nil {
		opts.Diagnostics = &noopService{}
	}
	if opts.Now == nil {
		opts.Now = func() int64 {
			return time.Now().UnixMilli()
		}
	}

	// Make this cancelable
	ctx, cancel := context.WithCancel(identity.WithRequester(context.Background(),
		&identity.StaticRequester{
			Namespace:      identity.NamespaceServiceAccount,
			Login:          "watcher", // admin user for watch
			UserID:         1,
			IsGrafanaAdmin: true,
		}))
	return &server{
		tracer:      opts.Tracer,
		log:         slog.Default().With("logger", "resource-server"),
		backend:     opts.Backend,
		search:      opts.Search,
		diagnostics: opts.Diagnostics,
		access:      opts.WriteAccess,
		lifecycle:   opts.Lifecycle,
		now:         opts.Now,
		ctx:         ctx,
		cancel:      cancel,
	}, nil
}

var _ ResourceServer = &server{}

type server struct {
	tracer      trace.Tracer
	log         *slog.Logger
	backend     StorageBackend
	search      ResourceIndexServer
	blob        BlobStore
	diagnostics DiagnosticsServer
	access      WriteAccessHooks
	lifecycle   LifecycleHooks
	now         func() int64

	// Background watch task -- this has permissions for everything
	ctx         context.Context
	cancel      context.CancelFunc
	broadcaster Broadcaster[*WrittenEvent]

	// init checking
	once    sync.Once
	initErr error
}

// Init implements ResourceServer.
func (s *server) Init() error {
	s.once.Do(func() {
		// Call lifecycle hooks
		if s.lifecycle != nil {
			err := s.lifecycle.Init()
			if err != nil {
				s.initErr = fmt.Errorf("initialize Resource Server: %w", err)
			}
		}

		// Start watching for changes
		if s.initErr == nil {
			s.initErr = s.initWatcher()
		}

		if s.initErr != nil {
			s.log.Error("error initializing resource server", "error", s.initErr)
		}
	})
	return s.initErr
}

func (s *server) Stop() {
	s.initErr = fmt.Errorf("service is stopping")

	if s.lifecycle != nil {
		s.lifecycle.Stop()
	}

	// Stops the streaming
	s.cancel()

	// mark the value as done
	s.initErr = fmt.Errorf("service is stopped")
}

// Old value indicates an update -- otherwise a create
func (s *server) newEventBuilder(ctx context.Context, key *ResourceKey, value, oldValue []byte) (*writeEventBuilder, error) {
	event, err := newEventFromBytes(value, oldValue)
	if err != nil {
		return nil, err
	}
	event.Key = key
	event.Requester, err = identity.GetRequester(ctx)
	if err != nil {
		return nil, ErrUserNotFoundInContext
	}

	obj := event.Meta
	if key.Namespace != obj.GetNamespace() {
		return nil, apierrors.NewBadRequest("key/namespace do not match")
	}

	gvk := obj.GetGroupVersionKind()
	if gvk.Kind == "" {
		return nil, apierrors.NewBadRequest("expecting resources with a kind in the body")
	}
	if gvk.Version == "" {
		return nil, apierrors.NewBadRequest("expecting resources with an apiVersion")
	}
	if gvk.Group != "" && gvk.Group != key.Group {
		return nil, apierrors.NewBadRequest(
			fmt.Sprintf("group in key does not match group in the body (%s != %s)", key.Group, gvk.Group),
		)
	}

	// This needs to be a create function
	if key.Name == "" {
		if obj.GetName() == "" {
			return nil, apierrors.NewBadRequest("missing name")
		}
		key.Name = obj.GetName()
	} else if key.Name != obj.GetName() {
		return nil, apierrors.NewBadRequest(
			fmt.Sprintf("key/name do not match (key: %s, name: %s)", key.Name, obj.GetName()))
	}
	obj.SetGenerateName("")
	err = validateName(obj.GetName())
	if err != nil {
		return nil, err
	}

	folder := obj.GetFolder()
	if folder != "" {
		err = s.access.CanWriteFolder(ctx, event.Requester, folder)
		if err != nil {
			return nil, err
		}
	}
	origin, err := obj.GetOriginInfo()
	if err != nil {
		return nil, apierrors.NewBadRequest("invalid origin info")
	}
	if origin != nil {
		err = s.access.CanWriteOrigin(ctx, event.Requester, origin.Name)
		if err != nil {
			return nil, err
		}
	}
	obj.SetOriginInfo(origin)

	// Make sure old values do not mutate things they should not
	if event.OldMeta != nil {
		old := event.OldMeta

		if obj.GetUID() != event.OldMeta.GetUID() {
			return nil, apierrors.NewBadRequest(
				fmt.Sprintf("UIDs do not match (old: %s, new: %s)", old.GetUID(), obj.GetUID()))
		}

		// Can not change creation timestamps+user
		if obj.GetCreatedBy() != event.OldMeta.GetCreatedBy() {
			return nil, apierrors.NewBadRequest(
				fmt.Sprintf("created by changed (old: %s, new: %s)", old.GetCreatedBy(), obj.GetCreatedBy()))
		}
		if obj.GetCreationTimestamp() != event.OldMeta.GetCreationTimestamp() {
			return nil, apierrors.NewBadRequest(
				fmt.Sprintf("creation timestamp changed (old:%v, new:%v)", old.GetCreationTimestamp(), obj.GetCreationTimestamp()))
		}
	}
	return event, nil
}

func (s *server) Create(ctx context.Context, req *CreateRequest) (*CreateResponse, error) {
	ctx, span := s.tracer.Start(ctx, "storage_server.Create")
	defer span.End()

	if err := s.Init(); err != nil {
		return nil, err
	}

	rsp := &CreateResponse{}
	builder, err := s.newEventBuilder(ctx, req.Key, req.Value, nil)
	if err != nil {
		rsp.Status, err = errToStatus(err)
		return rsp, err
	}

	obj := builder.Meta
	obj.SetCreatedBy(builder.Requester.GetUID().String())
	obj.SetUpdatedBy("")
	obj.SetUpdatedTimestamp(nil)
	obj.SetCreationTimestamp(metav1.NewTime(time.UnixMilli(s.now())))
	obj.SetUID(types.UID(uuid.New().String()))

	event, err := builder.toEvent()
	if err != nil {
		rsp.Status, err = errToStatus(err)
		return rsp, err
	}

	rsp.ResourceVersion, err = s.backend.WriteEvent(ctx, event)
	if err == nil {
		rsp.Value = event.Value // with mutated fields
	} else {
		rsp.Status, err = errToStatus(err)
	}
	return rsp, err
}

// Convert golang errors to status result errors that can be returned to a client
func errToStatus(err error) (*StatusResult, error) {
	if err != nil {
		apistatus, ok := err.(apierrors.APIStatus)
		if ok {
			s := apistatus.Status()
			return &StatusResult{
				Status:  s.Status,
				Message: s.Message,
				Reason:  string(s.Reason),
				Code:    s.Code,
			}, nil
		}

		// TODO... better conversion!!!
		return &StatusResult{
			Status:  "Failure",
			Message: err.Error(),
			Code:    500,
		}, nil
	}
	return nil, err
}

func (s *server) Update(ctx context.Context, req *UpdateRequest) (*UpdateResponse, error) {
	ctx, span := s.tracer.Start(ctx, "storage_server.Update")
	defer span.End()

	if err := s.Init(); err != nil {
		return nil, err
	}

	rsp := &UpdateResponse{}
	if req.ResourceVersion < 0 {
		rsp.Status, _ = errToStatus(apierrors.NewBadRequest("update must include the previous version"))
		return rsp, nil
	}

	latest, err := s.backend.Read(ctx, &ReadRequest{
		Key: req.Key,
	})
	if err != nil {
		return nil, err
	}
	if latest.Value == nil {
		return nil, apierrors.NewBadRequest("current value does not exist")
	}

	builder, err := s.newEventBuilder(ctx, req.Key, req.Value, latest.Value)
	if err != nil {
		rsp.Status, err = errToStatus(err)
		return rsp, err
	}

	obj := builder.Meta
	obj.SetUpdatedBy(builder.Requester.GetUID().String())
	obj.SetUpdatedTimestampMillis(time.Now().UnixMilli())

	event, err := builder.toEvent()
	if err != nil {
		rsp.Status, err = errToStatus(err)
		return rsp, err
	}

	event.Type = WatchEvent_MODIFIED
	event.PreviousRV = latest.ResourceVersion

	rsp.ResourceVersion, err = s.backend.WriteEvent(ctx, event)
	rsp.Status, err = errToStatus(err)
	if err == nil {
		rsp.Value = event.Value // with mutated fields
	} else {
		rsp.Status, err = errToStatus(err)
	}
	return rsp, err
}

func (s *server) Delete(ctx context.Context, req *DeleteRequest) (*DeleteResponse, error) {
	ctx, span := s.tracer.Start(ctx, "storage_server.Delete")
	defer span.End()

	if err := s.Init(); err != nil {
		return nil, err
	}

	rsp := &DeleteResponse{}
	if req.ResourceVersion < 0 {
		return nil, apierrors.NewBadRequest("update must include the previous version")
	}

	latest, err := s.backend.Read(ctx, &ReadRequest{
		Key: req.Key,
	})
	if err != nil {
		return nil, err
	}
	if latest.ResourceVersion != req.ResourceVersion {
		return nil, ErrOptimisticLockingFailed
	}

	now := metav1.NewTime(time.UnixMilli(s.now()))
	event := WriteEvent{
		Key:        req.Key,
		Type:       WatchEvent_DELETED,
		PreviousRV: latest.ResourceVersion,
	}
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, apierrors.NewBadRequest("unable to get user")
	}
	marker := &DeletedMarker{}
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
	obj.SetUpdatedBy(requester.GetUID().String())
	marker.TypeMeta = metav1.TypeMeta{
		Kind:       "DeletedMarker",
		APIVersion: "common.grafana.app/v0alpha1", // ?? or can we stick this in common?
	}
	marker.Annotations["RestoreResourceVersion"] = fmt.Sprintf("%d", event.PreviousRV)
	event.Value, err = json.Marshal(marker)
	if err != nil {
		return nil, apierrors.NewBadRequest(
			fmt.Sprintf("unable creating deletion marker, %v", err))
	}

	rsp.ResourceVersion, err = s.backend.WriteEvent(ctx, event)
	rsp.Status, err = errToStatus(err)
	return rsp, err
}

func (s *server) Read(ctx context.Context, req *ReadRequest) (*ReadResponse, error) {
	if err := s.Init(); err != nil {
		return nil, err
	}

	if req.Key.Group == "" {
		status, _ := errToStatus(apierrors.NewBadRequest("missing group"))
		return &ReadResponse{Status: status}, nil
	}
	if req.Key.Resource == "" {
		status, _ := errToStatus(apierrors.NewBadRequest("missing resource"))
		return &ReadResponse{Status: status}, nil
	}

	// TODO: shall we also check for the namespace and Name ? Or is that a backend concern?

	rsp, err := s.backend.Read(ctx, req)
	if err != nil {
		if rsp == nil {
			rsp = &ReadResponse{}
		}
		rsp.Status, err = errToStatus(err)
	}
	return rsp, err
}

func (s *server) List(ctx context.Context, req *ListRequest) (*ListResponse, error) {
	if err := s.Init(); err != nil {
		return nil, err
	}

	rsp, err := s.backend.PrepareList(ctx, req)
	// Status???
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
			for {
				// pipe all events
				v := <-events
				out <- v
			}
		}()
		return nil
	})
	return err
}

func (s *server) Watch(req *WatchRequest, srv ResourceStore_WatchServer) error {
	if err := s.Init(); err != nil {
		return err
	}

	fmt.Printf("WATCH %v\n", req.Options.Key)

	ctx := srv.Context()

	// Start listening -- this will buffer any changes that happen while we backfill
	stream, err := s.broadcaster.Subscribe(ctx)
	if err != nil {
		return err
	}
	defer s.broadcaster.Unsubscribe(stream)

	since := req.Since
	if req.SendInitialEvents {
		fmt.Printf("TODO... query\n")
		// All initial events are CREATE

		if req.AllowWatchBookmarks {
			fmt.Printf("TODO... send bookmark\n")
		}
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

			if event.ResourceVersion > since && matchesQueryKey(req.Options.Key, event.Key) {
				// Currently sending *every* event
				// if req.Options.Labels != nil {
				// 	// match *either* the old or new object
				// }
				// TODO: return values that match either the old or the new

				srv.Send(&WatchEvent{
					Timestamp: event.Timestamp,
					Type:      event.Type,
					Resource: &WatchEvent_Resource{
						Value:   event.Value,
						Version: event.ResourceVersion,
					},
					// TODO... previous???
				})
			}
		}
	}
}

// GetBlob implements ResourceServer.
func (s *server) PutBlob(ctx context.Context, req *PutBlobRequest) (*PutBlobResponse, error) {
	if err := s.Init(); err != nil {
		return nil, err
	}
	rsp, err := s.blob.PutBlob(ctx, req)
	rsp.Status, err = errToStatus(err)
	return rsp, err
}

func (s *server) getPartialObject(ctx context.Context, key *ResourceKey, rv int64) (utils.GrafanaMetaAccessor, *StatusResult) {
	rsp, err := s.backend.Read(ctx, &ReadRequest{
		Key:             key,
		ResourceVersion: rv,
	})
	if err != nil {
		rsp.Status, _ = errToStatus(err)
	}
	if rsp.Status != nil {
		return nil, rsp.Status
	}

	partial := &metav1.PartialObjectMetadata{}
	err = json.Unmarshal(rsp.Value, partial)
	if err != nil {
		rsp.Status, _ = errToStatus(fmt.Errorf("error reading body %w", err))
		return nil, rsp.Status
	}
	obj, err := utils.MetaAccessor(partial)
	if err != nil {
		rsp.Status, _ = errToStatus(fmt.Errorf("error getting accessor %w", err))
		return nil, rsp.Status
	}
	return obj, nil
}

// GetBlob implements ResourceServer.
func (s *server) GetBlob(ctx context.Context, req *GetBlobRequest) (*GetBlobResponse, error) {
	if err := s.Init(); err != nil {
		return nil, err
	}

	// NOTE: in SQL... this could be simple select rather than a full fetch and extract
	obj, status := s.getPartialObject(ctx, req.Resource, req.ResourceVersion)
	if status != nil {
		return &GetBlobResponse{Status: status}, nil
	}

	info := obj.GetBlob()
	if info == nil || info.UID == "" {
		return &GetBlobResponse{Status: &StatusResult{
			Status:  "Failure",
			Message: "Resource does not have a linked blob",
			Code:    404,
		}}, nil
	}

	rsp, err := s.blob.GetBlob(ctx, req.Resource, info, req.MustProxyBytes)
	rsp.Status, err = errToStatus(err)
	return rsp, err
}

// History implements ResourceServer.
func (s *server) History(ctx context.Context, req *HistoryRequest) (*HistoryResponse, error) {
	if err := s.Init(); err != nil {
		return nil, err
	}
	return s.search.History(ctx, req)
}

// IsHealthy implements ResourceServer.
func (s *server) IsHealthy(ctx context.Context, req *HealthCheckRequest) (*HealthCheckResponse, error) {
	if err := s.Init(); err != nil {
		return nil, err
	}
	return s.diagnostics.IsHealthy(ctx, req)
}

// Origin implements ResourceServer.
func (s *server) Origin(ctx context.Context, req *OriginRequest) (*OriginResponse, error) {
	if err := s.Init(); err != nil {
		return nil, err
	}
	return s.search.Origin(ctx, req)
}
