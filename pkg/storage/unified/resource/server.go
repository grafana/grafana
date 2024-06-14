package resource

import (
	context "context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/bwmarrin/snowflake"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// Package-level errors.
var (
	ErrNotFound                  = errors.New("entity not found")
	ErrOptimisticLockingFailed   = errors.New("optimistic locking failed")
	ErrUserNotFoundInContext     = errors.New("user not found in context")
	ErrUnableToReadResourceJSON  = errors.New("unable to read resource json")
	ErrNextPageTokenNotSupported = errors.New("nextPageToken not yet supported")
	ErrLimitNotSupported         = errors.New("limit not yet supported")
	ErrNotImplementedYet         = errors.New("not implemented yet")
)

// ResourceServer implements all services
type ResourceServer interface {
	ResourceStoreServer
	ResourceSearchServer
	DiagnosticsServer
	LifecycleHooks
}

type AppendingStore interface {
	// Write a Create/Update/Delete,
	// NOTE: the contents of WriteEvent have been validated
	// Return the revisionVersion for this event or error
	WriteEvent(context.Context, *WriteEvent) (int64, error)

	// Read a value from storage
	Read(context.Context, *ReadRequest) (*ReadResponse, error)

	// Implement List -- this expects the read after write semantics
	List(context.Context, *ListRequest) (*ListResponse, error)

	// Watch for events
	Watch(context.Context, *WatchRequest) (chan *WatchResponse, error)
}

type ResourceServerOptions struct {
	// OTel tracer
	Tracer trace.Tracer

	// When running in a cluster, each node should have a different ID
	// This is used for snowflake generation and log identification
	NodeID int64

	// Get the next EventID.  When not set, this will default to snowflake IDs
	NextEventID func() int64

	// Real storage backend
	Store AppendingStore

	// Real storage backend
	Search ResourceSearchServer

	// Diagnostics
	Diagnostics DiagnosticsServer

	// Check if a user has access to write folders
	// When this is nil, no resources can have folders configured
	WriteAccess WriteAccessHooks

	// Callbacks for startup and shutdown
	Lifecycle LifecycleHooks
}

func NewResourceServer(opts ResourceServerOptions) (ResourceServer, error) {
	if opts.Tracer == nil {
		opts.Tracer = noop.NewTracerProvider().Tracer("resource-server")
	}

	if opts.NextEventID == nil {
		eventNode, err := snowflake.NewNode(opts.NodeID)
		if err != nil {
			return nil, apierrors.NewInternalError(
				fmt.Errorf("error initializing snowflake id generator :: %w", err))
		}
		opts.NextEventID = func() int64 {
			return eventNode.Generate().Int64()
		}
	}

	if opts.Store == nil {
		return nil, fmt.Errorf("missing AppendingStore implementation")
	}
	if opts.Search == nil {
		opts.Search = &NoopServer{}
	}
	if opts.Diagnostics == nil {
		opts.Search = &NoopServer{}
	}

	return &server{
		tracer:      opts.Tracer,
		nextEventID: opts.NextEventID,
		store:       opts.Store,
		search:      opts.Search,
		diagnostics: opts.Diagnostics,
		access:      opts.WriteAccess,
		lifecycle:   opts.Lifecycle,
	}, nil
}

var _ ResourceServer = &server{}

type server struct {
	tracer      trace.Tracer
	nextEventID func() int64
	store       AppendingStore
	search      ResourceSearchServer
	diagnostics DiagnosticsServer
	access      WriteAccessHooks
	lifecycle   LifecycleHooks

	// init checking
	once    sync.Once
	initErr error
}

// Init implements ResourceServer.
func (s *server) Init() error {
	s.once.Do(func() {
		// TODO, setup a broadcaster for watch

		// Call lifecycle hooks
		if s.lifecycle != nil {
			err := s.lifecycle.Init()
			if err != nil {
				s.initErr = fmt.Errorf("initialize Resource Server: %w", err)
			}
		}
	})
	return s.initErr
}

func (s *server) Stop() {
	s.initErr = fmt.Errorf("service is stopping")
	if s.lifecycle != nil {
		s.lifecycle.Stop()
	}
	s.initErr = fmt.Errorf("service is stopped")
}

func (s *server) newEvent(ctx context.Context, key *ResourceKey, value, oldValue []byte) (*WriteEvent, error) {
	var err error
	event := &WriteEvent{
		EventID: s.nextEventID(),
		Key:     key,
		Value:   value,
	}
	event.Requester, err = identity.GetRequester(ctx)
	if err != nil {
		return nil, ErrUserNotFoundInContext
	}

	dummy := &metav1.PartialObjectMetadata{}
	err = json.Unmarshal(value, dummy)
	if err != nil {
		return nil, ErrUnableToReadResourceJSON
	}

	obj, err := utils.MetaAccessor(dummy)
	if err != nil {
		return nil, apierrors.NewBadRequest("invalid object in json")
	}
	if obj.GetUID() == "" {
		return nil, apierrors.NewBadRequest("the UID must be set")
	}
	if obj.GetGenerateName() != "" {
		return nil, apierrors.NewBadRequest("can not save value with generate name")
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
	if obj.GetName() != key.Name {
		return nil, apierrors.NewBadRequest("key name does not match the name in the body")
	}
	if obj.GetNamespace() != key.Namespace {
		return nil, apierrors.NewBadRequest("key namespace does not match the namespace in the body")
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
	event.Object = obj

	// This is an update
	if oldValue != nil {
		dummy := &metav1.PartialObjectMetadata{}
		err = json.Unmarshal(oldValue, dummy)
		if err != nil {
			return nil, apierrors.NewBadRequest("error reading old json value")
		}
		old, err := utils.MetaAccessor(dummy)
		if err != nil {
			return nil, apierrors.NewBadRequest("invalid object inside old json")
		}
		if key.Name != old.GetName() {
			return nil, apierrors.NewBadRequest(
				fmt.Sprintf("the old value has a different name (%s != %s)", key.Name, old.GetName()))
		}

		// Can not change creation timestamps+user
		if obj.GetCreatedBy() != old.GetCreatedBy() {
			return nil, apierrors.NewBadRequest(
				fmt.Sprintf("can not change the created by metadata (%s != %s)", obj.GetCreatedBy(), old.GetCreatedBy()))
		}
		if obj.GetCreationTimestamp() != old.GetCreationTimestamp() {
			return nil, apierrors.NewBadRequest(
				fmt.Sprintf("can not change the CreationTimestamp metadata (%v != %v)", obj.GetCreationTimestamp(), old.GetCreationTimestamp()))
		}

		oldFolder := obj.GetFolder()
		if oldFolder != folder {
			event.FolderChanged = true
		}
		event.OldObject = old
	} else if folder != "" {
		event.FolderChanged = true
	}
	return event, nil
}

func (s *server) Create(ctx context.Context, req *CreateRequest) (*CreateResponse, error) {
	ctx, span := s.tracer.Start(ctx, "storage_server.Create")
	defer span.End()

	if err := s.Init(); err != nil {
		return nil, err
	}

	event, err := s.newEvent(ctx, req.Key, req.Value, nil)
	if err != nil {
		return nil, err
	}
	event.Operation = ResourceOperation_CREATED
	event.Blob = req.Blob
	event.Message = req.Message

	rsp := &CreateResponse{}
	// Make sure the created by user is accurate
	//----------------------------------------
	val := event.Object.GetCreatedBy()
	if val != "" && val != event.Requester.GetUID().String() {
		return nil, apierrors.NewBadRequest("created by annotation does not match: metadata.annotations#" + utils.AnnoKeyCreatedBy)
	}

	// Create can not have updated properties
	//----------------------------------------
	if event.Object.GetUpdatedBy() != "" {
		return nil, apierrors.NewBadRequest("unexpected metadata.annotations#" + utils.AnnoKeyCreatedBy)
	}

	ts, err := event.Object.GetUpdatedTimestamp()
	if err != nil {
		return nil, apierrors.NewBadRequest(fmt.Sprintf("invalid timestamp: %s", err))
	}
	if ts != nil {
		return nil, apierrors.NewBadRequest("unexpected metadata.annotations#" + utils.AnnoKeyUpdatedTimestamp)
	}

	// Append and set the resource version
	rsp.ResourceVersion, err = s.store.WriteEvent(ctx, event)
	rsp.Status, err = errToStatus(err)
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

	latest, err := s.store.Read(ctx, &ReadRequest{
		Key: req.Key.WithoutResourceVersion(),
	})
	if err != nil {
		return nil, err
	}
	if latest.Value == nil {
		return nil, apierrors.NewBadRequest("current value does not exist")
	}

	event, err := s.newEvent(ctx, req.Key, req.Value, latest.Value)
	if err != nil {
		return nil, err
	}
	event.Operation = ResourceOperation_UPDATED
	event.PreviousRV = latest.ResourceVersion
	event.Message = req.Message

	// Make sure the update user is accurate
	//----------------------------------------
	val := event.Object.GetUpdatedBy()
	if val != "" && val != event.Requester.GetUID().String() {
		return nil, apierrors.NewBadRequest("updated by annotation does not match: metadata.annotations#" + utils.AnnoKeyUpdatedBy)
	}

	rsp.ResourceVersion, err = s.store.WriteEvent(ctx, event)
	rsp.Status, err = errToStatus(err)
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

	latest, err := s.store.Read(ctx, &ReadRequest{
		Key: req.Key.WithoutResourceVersion(),
	})
	if err != nil {
		return nil, err
	}
	if latest.ResourceVersion != req.ResourceVersion {
		return nil, ErrOptimisticLockingFailed
	}

	now := metav1.NewTime(time.Now())
	event := &WriteEvent{
		EventID:    s.nextEventID(),
		Key:        req.Key,
		Operation:  ResourceOperation_DELETED,
		PreviousRV: latest.ResourceVersion,
	}
	event.Requester, err = identity.GetRequester(ctx)
	if err != nil {
		return nil, apierrors.NewBadRequest("unable to get user")
	}
	marker := &DeletedMarker{}
	err = json.Unmarshal(latest.Value, marker)
	if err != nil {
		return nil, apierrors.NewBadRequest(
			fmt.Sprintf("unable to read previous object, %v", err))
	}
	event.Object, err = utils.MetaAccessor(marker)
	if err != nil {
		return nil, err
	}
	event.Object.SetDeletionTimestamp(&now)
	event.Object.SetUpdatedTimestamp(&now.Time)
	event.Object.SetManagedFields(nil)
	event.Object.SetFinalizers(nil)
	event.Object.SetUpdatedBy(event.Requester.GetUID().String())
	marker.TypeMeta = metav1.TypeMeta{
		Kind:       "DeletedMarker",
		APIVersion: "storage.grafana.app/v0alpha1", // ?? or can we stick this in common?
	}
	marker.Annotations["RestoreResourceVersion"] = fmt.Sprintf("%d", event.PreviousRV)
	event.Value, err = json.Marshal(marker)
	if err != nil {
		return nil, apierrors.NewBadRequest(
			fmt.Sprintf("unable creating deletion marker, %v", err))
	}

	rsp.ResourceVersion, err = s.store.WriteEvent(ctx, event)
	rsp.Status, err = errToStatus(err)
	return rsp, err
}

func (s *server) Read(ctx context.Context, req *ReadRequest) (*ReadResponse, error) {
	if err := s.Init(); err != nil {
		return nil, err
	}

	rsp, err := s.store.Read(ctx, req)
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

	rsp, err := s.store.List(ctx, req)
	// Status???
	return rsp, err
}

func (s *server) Watch(req *WatchRequest, srv ResourceStore_WatchServer) error {
	if err := s.Init(); err != nil {
		return err
	}

	// TODO??? can we move any of the common processing here?
	stream, err := s.store.Watch(srv.Context(), req)
	if err != nil {
		return err
	}
	for event := range stream {
		srv.Send(event)
	}
	return nil
}

// GetBlob implements ResourceServer.
func (s *server) GetBlob(ctx context.Context, req *GetBlobRequest) (*GetBlobResponse, error) {
	if err := s.Init(); err != nil {
		return nil, err
	}
	rsp, err := s.search.GetBlob(ctx, req)
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
