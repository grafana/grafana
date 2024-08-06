package resource

import (
	context "context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// ResourceServer implements all gRPC services
type ResourceServer interface {
	ResourceStoreServer
	ResourceIndexServer
	DiagnosticsServer
	LifecycleHooks
}

type ListIterator interface {
	Next() bool // sql.Rows

	// Iterator error (if exts)
	Error() error

	// The token that can be used to start iterating *after* this item
	ContinueToken() string

	// ResourceVersion of the current item
	ResourceVersion() int64

	// Namespace of the current item
	// Used for fast(er) authz filtering
	Namespace() string

	// Name of the current item
	// Used for fast(er) authz filtering
	Name() string

	// Value for the current item
	Value() []byte
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
	ReadResource(context.Context, *ReadRequest) *ReadResponse

	// When the ResourceServer executes a List request, this iterator will
	// query the backend for potential results.  All results will be
	// checked against the kubernetes requirements before finally returning
	// results.  The list options can be used to improve performance
	// but are the the final answer.
	ListIterator(context.Context, *ListRequest, func(ListIterator) error) (int64, error)

	// Get all events from the store
	// For HA setups, this will be more events than the local WriteEvent above!
	WatchWriteEvents(ctx context.Context) (<-chan *WrittenEvent, error)
}

type ResourceServerOptions struct {
	// OTel tracer
	Tracer trace.Tracer

	// Real storage backend
	Backend StorageBackend

	// Requests based on a search index
	Index ResourceIndexServer

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
	if opts.Index == nil {
		opts.Index = &noopService{}
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
			Type:           identity.TypeServiceAccount,
			Login:          "watcher", // admin user for watch
			UserID:         1,
			IsGrafanaAdmin: true,
		}))
	return &server{
		tracer:      opts.Tracer,
		log:         slog.Default().With("logger", "resource-server"),
		backend:     opts.Backend,
		index:       opts.Index,
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
	index       ResourceIndexServer
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
func (s *server) Init(ctx context.Context) error {
	s.once.Do(func() {
		// Call lifecycle hooks
		if s.lifecycle != nil {
			err := s.lifecycle.Init(ctx)
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
func (s *server) newEvent(ctx context.Context, user identity.Requester, key *ResourceKey, value, oldValue []byte) (*WriteEvent, *ErrorResult) {
	tmp := &unstructured.Unstructured{}
	err := tmp.UnmarshalJSON(value)
	if err != nil {
		return nil, AsErrorResult(err)
	}
	obj, err := utils.MetaAccessor(tmp)
	if err != nil {
		return nil, AsErrorResult(err)
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

	folder := obj.GetFolder()
	if folder != "" {
		err = s.access.CanWriteFolder(ctx, user, folder)
		if err != nil {
			return nil, AsErrorResult(err)
		}
	}
	origin, err := obj.GetOriginInfo()
	if err != nil {
		return nil, NewBadRequestError("invalid origin info")
	}
	if origin != nil {
		err = s.access.CanWriteOrigin(ctx, user, origin.Name)
		if err != nil {
			return nil, AsErrorResult(err)
		}
	}
	return event, nil
}

func (s *server) Create(ctx context.Context, req *CreateRequest) (*CreateResponse, error) {
	ctx, span := s.tracer.Start(ctx, "storage_server.Create")
	defer span.End()

	if err := s.Init(ctx); err != nil {
		return nil, err
	}

	rsp := &CreateResponse{}
	user, err := identity.GetRequester(ctx)
	if err != nil || user == nil {
		rsp.Error = &ErrorResult{
			Message: "no user found in context",
			Code:    http.StatusUnauthorized,
		}
		return rsp, nil
	}

	found := s.backend.ReadResource(ctx, &ReadRequest{Key: req.Key})
	if found != nil && len(found.Value) > 0 {
		rsp.Error = &ErrorResult{
			Code:    http.StatusConflict,
			Message: "key already exists",
		}
		return rsp, nil
	}

	event, e := s.newEvent(ctx, user, req.Key, req.Value, nil)
	if e != nil {
		rsp.Error = e
		return rsp, nil
	}

	rsp.ResourceVersion, err = s.backend.WriteEvent(ctx, *event)
	if err != nil {
		rsp.Error = AsErrorResult(err)
	}
	return rsp, nil
}

func (s *server) Update(ctx context.Context, req *UpdateRequest) (*UpdateResponse, error) {
	ctx, span := s.tracer.Start(ctx, "storage_server.Update")
	defer span.End()

	if err := s.Init(ctx); err != nil {
		return nil, err
	}

	rsp := &UpdateResponse{}
	user, err := identity.GetRequester(ctx)
	if err != nil || user == nil {
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
		return rsp, err
	}

	event.Type = WatchEvent_MODIFIED
	event.PreviousRV = latest.ResourceVersion

	rsp.ResourceVersion, err = s.backend.WriteEvent(ctx, *event)
	if err != nil {
		rsp.Error = AsErrorResult(err)
	}
	return rsp, nil
}

func (s *server) Delete(ctx context.Context, req *DeleteRequest) (*DeleteResponse, error) {
	ctx, span := s.tracer.Start(ctx, "storage_server.Delete")
	defer span.End()

	if err := s.Init(ctx); err != nil {
		return nil, err
	}

	rsp := &DeleteResponse{}
	if req.ResourceVersion < 0 {
		return nil, apierrors.NewBadRequest("update must include the previous version")
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
	obj.SetUpdatedBy(requester.GetUID())
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
	if err != nil {
		rsp.Error = AsErrorResult(err)
	}
	return rsp, nil
}

func (s *server) Read(ctx context.Context, req *ReadRequest) (*ReadResponse, error) {
	if err := s.Init(ctx); err != nil {
		return nil, err
	}

	// if req.Key.Group == "" {
	// 	status, _ := AsErrorResult(apierrors.NewBadRequest("missing group"))
	// 	return &ReadResponse{Status: status}, nil
	// }
	if req.Key.Resource == "" {
		return &ReadResponse{Error: NewBadRequestError("missing resource")}, nil
	}

	rsp := s.backend.ReadResource(ctx, req)
	// TODO, check folder permissions etc
	return rsp, nil
}

func (s *server) List(ctx context.Context, req *ListRequest) (*ListResponse, error) {
	if err := s.Init(ctx); err != nil {
		return nil, err
	}
	if req.Limit < 1 {
		req.Limit = 50 // default max 50 items in a page
	}
	maxPageBytes := 1024 * 1024 * 2 // 2mb/page
	pageBytes := 0
	rsp := &ListResponse{}
	rv, err := s.backend.ListIterator(ctx, req, func(iter ListIterator) error {
		for iter.Next() {
			if err := iter.Error(); err != nil {
				return err
			}

			// TODO: add authz filters

			item := &ResourceWrapper{
				ResourceVersion: iter.ResourceVersion(),
				Value:           iter.Value(),
			}

			pageBytes += len(item.Value)
			rsp.Items = append(rsp.Items, item)
			if len(rsp.Items) >= int(req.Limit) || pageBytes >= maxPageBytes {
				t := iter.ContinueToken()
				if iter.Next() {
					rsp.NextPageToken = t
				}
				break
			}
		}
		return nil
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
	ctx := srv.Context()

	if err := s.Init(ctx); err != nil {
		return err
	}

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

				if err := srv.Send(&WatchEvent{
					Timestamp: event.Timestamp,
					Type:      event.Type,
					Resource: &WatchEvent_Resource{
						Value:   event.Value,
						Version: event.ResourceVersion,
					},
					// TODO... previous???
				}); err != nil {
					return err
				}
			}
		}
	}
}

// History implements ResourceServer.
func (s *server) History(ctx context.Context, req *HistoryRequest) (*HistoryResponse, error) {
	if err := s.Init(ctx); err != nil {
		return nil, err
	}
	return s.index.History(ctx, req)
}

// Origin implements ResourceServer.
func (s *server) Origin(ctx context.Context, req *OriginRequest) (*OriginResponse, error) {
	if err := s.Init(ctx); err != nil {
		return nil, err
	}
	return s.index.Origin(ctx, req)
}

// IsHealthy implements ResourceServer.
func (s *server) IsHealthy(ctx context.Context, req *HealthCheckRequest) (*HealthCheckResponse, error) {
	if err := s.Init(ctx); err != nil {
		return nil, err
	}
	return s.diagnostics.IsHealthy(ctx, req)
}
