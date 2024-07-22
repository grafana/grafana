package resource

import (
	context "context"
	"encoding/json"
	"errors"
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
			Namespace:      identity.NamespaceServiceAccount,
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
func (s *server) newEvent(ctx context.Context, key *ResourceKey, value, oldValue []byte) (*WriteEvent, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, ErrUserNotFoundInContext
	}
	tmp := &unstructured.Unstructured{}
	err = tmp.UnmarshalJSON(value)
	if err != nil {
		return nil, err
	}
	obj, err := utils.MetaAccessor(tmp)
	if err != nil {
		return nil, err
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
			return nil, err
		}
		event.ObjectOld, err = utils.MetaAccessor(temp)
		if err != nil {
			return nil, err
		}
	}

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
	err = validateName(obj.GetName())
	if err != nil {
		return nil, err
	}

	folder := obj.GetFolder()
	if folder != "" {
		err = s.access.CanWriteFolder(ctx, user, folder)
		if err != nil {
			return nil, err
		}
	}
	origin, err := obj.GetOriginInfo()
	if err != nil {
		return nil, apierrors.NewBadRequest("invalid origin info")
	}
	if origin != nil {
		err = s.access.CanWriteOrigin(ctx, user, origin.Name)
		if err != nil {
			return nil, err
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
	found, _ := s.backend.Read(ctx, &ReadRequest{Key: req.Key})
	if found != nil && len(found.Value) > 0 {
		rsp.Error = &ErrorResult{
			Code:    http.StatusConflict,
			Message: "key already exists",
		}
		return rsp, nil
	}

	event, err := s.newEvent(ctx, req.Key, req.Value, nil)
	if err != nil {
		rsp.Error, err = errToStatus(err)
		return rsp, err
	}

	rsp.ResourceVersion, err = s.backend.WriteEvent(ctx, *event)
	if err != nil {
		rsp.Error, err = errToStatus(err)
	}
	return rsp, err
}

// Convert golang errors to status result errors that can be returned to a client
func errToStatus(err error) (*ErrorResult, error) {
	if err != nil {
		apistatus, ok := err.(apierrors.APIStatus)
		if ok {
			s := apistatus.Status()
			res := &ErrorResult{
				Message: s.Message,
				Reason:  string(s.Reason),
				Code:    s.Code,
			}
			if s.Details != nil {
				res.Details = &ErrorDetails{
					Group:             s.Details.Group,
					Kind:              s.Details.Kind,
					Name:              s.Details.Name,
					Uid:               string(s.Details.UID),
					RetryAfterSeconds: s.Details.RetryAfterSeconds,
				}
				for _, c := range s.Details.Causes {
					res.Details.Causes = append(res.Details.Causes, &ErrorCause{
						Reason:  string(c.Type),
						Message: c.Message,
						Field:   c.Field,
					})
				}
			}
			return res, nil
		}

		// TODO... better conversion??
		return &ErrorResult{
			Message: err.Error(),
			Code:    500,
		}, nil
	}
	return nil, err
}

func (s *server) Update(ctx context.Context, req *UpdateRequest) (*UpdateResponse, error) {
	ctx, span := s.tracer.Start(ctx, "storage_server.Update")
	defer span.End()

	if err := s.Init(ctx); err != nil {
		return nil, err
	}

	rsp := &UpdateResponse{}
	if req.ResourceVersion < 0 {
		rsp.Error, _ = errToStatus(apierrors.NewBadRequest("update must include the previous version"))
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

	if req.ResourceVersion > 0 && latest.ResourceVersion != req.ResourceVersion {
		return nil, ErrOptimisticLockingFailed
	}

	event, err := s.newEvent(ctx, req.Key, req.Value, latest.Value)
	if err != nil {
		rsp.Error, err = errToStatus(err)
		return rsp, err
	}

	event.Type = WatchEvent_MODIFIED
	event.PreviousRV = latest.ResourceVersion

	rsp.ResourceVersion, err = s.backend.WriteEvent(ctx, *event)
	rsp.Error, err = errToStatus(err)
	if err != nil {
		rsp.Error, err = errToStatus(err)
	}
	return rsp, err
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

	latest, err := s.backend.Read(ctx, &ReadRequest{
		Key: req.Key,
	})
	if err != nil {
		return nil, err
	}
	if req.ResourceVersion > 0 && latest.ResourceVersion != req.ResourceVersion {
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
	rsp.Error, err = errToStatus(err)
	return rsp, err
}

func (s *server) Read(ctx context.Context, req *ReadRequest) (*ReadResponse, error) {
	if err := s.Init(ctx); err != nil {
		return nil, err
	}

	// if req.Key.Group == "" {
	// 	status, _ := errToStatus(apierrors.NewBadRequest("missing group"))
	// 	return &ReadResponse{Status: status}, nil
	// }
	if req.Key.Resource == "" {
		status, _ := errToStatus(apierrors.NewBadRequest("missing resource"))
		return &ReadResponse{Error: status}, nil
	}

	rsp, err := s.backend.Read(ctx, req)
	if err != nil {
		if rsp == nil {
			rsp = &ReadResponse{}
		}
		rsp.Error, err = errToStatus(err)
	}
	return rsp, err
}

func (s *server) List(ctx context.Context, req *ListRequest) (*ListResponse, error) {
	if err := s.Init(ctx); err != nil {
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
