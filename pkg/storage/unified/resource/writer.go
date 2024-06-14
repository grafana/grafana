package resource

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/bwmarrin/snowflake"
	"github.com/prometheus/client_golang/prometheus"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"go.opentelemetry.io/otel/trace"

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

// Resource writer support
type ResourceWriter interface {
	Create(context.Context, *CreateRequest) (*CreateResponse, error)
	Update(context.Context, *UpdateRequest) (*UpdateResponse, error)
	Delete(context.Context, *DeleteRequest) (*DeleteResponse, error)
}

type WriterOptions struct {
	// OTel tracer
	Tracer trace.Tracer

	// When running in a cluster, each node should have a different ID
	// This is used for snowflake generation and log identification
	NodeID int64

	// Read an individual item
	Reader func(context.Context, *ReadRequest) (*ReadResponse, error)

	// Add a validated write event
	Appender EventAppender

	// Get the next EventID.  When not set, this will default to snowflake IDs
	NextEventID func() int64

	// Check if a user has access to write folders
	// When this is nil, no resources can have folders configured
	FolderAccess func(ctx context.Context, user identity.Requester, uid string) bool

	// When configured, this will make sure a user is allowed to save to a given origin
	OriginAccess func(ctx context.Context, user identity.Requester, origin string) bool
}

func NewResourceWriter(opts WriterOptions) (ResourceWriter, error) {
	log := slog.Default().With("logger", "resource-writer")
	if err := prometheus.Register(NewStorageMetrics()); err != nil {
		log.Warn("error registering storage server metrics", "error", err)
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
	return &writeServer{
		log:  log,
		opts: opts,
	}, nil
}

type writeServer struct {
	log  *slog.Logger
	opts WriterOptions
}

func (s *writeServer) newEvent(ctx context.Context, key *ResourceKey, value, oldValue []byte) (*WriteEvent, error) {
	var err error
	event := &WriteEvent{
		EventID: s.opts.NextEventID(),
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
		if s.opts.FolderAccess == nil {
			return nil, apierrors.NewBadRequest("folders are not supported")
		} else if !s.opts.FolderAccess(ctx, event.Requester, folder) {
			return nil, apierrors.NewBadRequest("unable to add resource to folder") // 403?
		}
	}
	origin, err := obj.GetOriginInfo()
	if err != nil {
		return nil, apierrors.NewBadRequest("invalid origin info")
	}
	if origin != nil && s.opts.OriginAccess != nil {
		if !s.opts.OriginAccess(ctx, event.Requester, origin.Name) {
			return nil, apierrors.NewBadRequest(
				fmt.Sprintf("not allowed to write resource to origin (%s)", origin.Name))
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

func (s *writeServer) Create(ctx context.Context, req *CreateRequest) (*CreateResponse, error) {
	ctx, span := s.opts.Tracer.Start(ctx, "storage_server.Create")
	defer span.End()

	if req.Key.ResourceVersion > 0 {
		return nil, apierrors.NewBadRequest("can not update a specific resource version")
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
	rsp.ResourceVersion, err = s.opts.Appender(ctx, event)
	// ?? convert the error to status?
	return rsp, err
}

func (s *writeServer) Update(ctx context.Context, req *UpdateRequest) (*UpdateResponse, error) {
	ctx, span := s.opts.Tracer.Start(ctx, "storage_server.Update")
	defer span.End()

	rsp := &UpdateResponse{}
	if req.Key.ResourceVersion < 0 {
		return nil, apierrors.NewBadRequest("update must include the previous version")
	}

	latest, err := s.opts.Reader(ctx, &ReadRequest{
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

	rsp.ResourceVersion, err = s.opts.Appender(ctx, event)

	return rsp, err
}

func (s *writeServer) Delete(ctx context.Context, req *DeleteRequest) (*DeleteResponse, error) {
	ctx, span := s.opts.Tracer.Start(ctx, "storage_server.Delete")
	defer span.End()

	rsp := &DeleteResponse{}
	if req.Key.ResourceVersion < 0 {
		return nil, apierrors.NewBadRequest("update must include the previous version")
	}

	latest, err := s.opts.Reader(ctx, &ReadRequest{
		Key: req.Key.WithoutResourceVersion(),
	})
	if err != nil {
		return nil, err
	}
	if latest.ResourceVersion != req.Key.ResourceVersion {
		return nil, ErrOptimisticLockingFailed
	}

	now := metav1.NewTime(time.Now())
	event := &WriteEvent{
		EventID:    s.opts.NextEventID(),
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

	rsp.ResourceVersion, err = s.opts.Appender(ctx, event)

	return rsp, err
}
