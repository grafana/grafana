package server

import (
	"context"
	"errors"
	"fmt"
	"time"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"go.opentelemetry.io/otel/attribute"
	"google.golang.org/protobuf/types/known/structpb"

	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func (s *Server) Check(ctx context.Context, r *authzv1.CheckRequest) (*authzv1.CheckResponse, error) {
	ctx, span := s.tracer.Start(ctx, "server.Check")
	defer span.End()
	span.SetAttributes(attribute.String("namespace", r.GetNamespace()))

	defer func(t time.Time) {
		s.metrics.requestDurationSeconds.WithLabelValues("server.Check", r.GetNamespace()).Observe(time.Since(t).Seconds())
	}(time.Now())

	res, err := s.check(ctx, r)
	if err != nil {
		s.logger.Error("failed to perform check request", "error", err, "namespace", r.GetNamespace())
		return nil, errors.New("failed to perform check request")
	}

	return res, nil
}

func (s *Server) check(ctx context.Context, r *authzv1.CheckRequest) (*authzv1.CheckResponse, error) {
	if err := authorize(ctx, r.GetNamespace(), s.cfg); err != nil {
		return nil, err
	}

	store, err := s.getStoreInfo(ctx, r.GetNamespace())
	if err != nil {
		return nil, fmt.Errorf("failed to get openfga store: %w", err)
	}

	relation := common.VerbMapping[r.GetVerb()]

	contextuals, err := s.getContextuals(r.GetSubject())
	if err != nil {
		return nil, fmt.Errorf("failed to get contextual tuples: %w", err)
	}

	resource := common.NewResourceInfoFromCheck(r)
	res, err := s.checkGroupResource(ctx, r.GetSubject(), relation, resource, contextuals, store)
	if err != nil {
		return nil, fmt.Errorf("failed to check group resource: %w", err)
	}

	if res.GetAllowed() {
		return res, nil
	}

	if resource.IsGeneric() {
		res, err = s.checkGeneric(ctx, r.GetSubject(), relation, resource, contextuals, store)
		if err != nil {
			return nil, fmt.Errorf("failed to check generic resource: %w", err)
		}
		return res, nil
	}

	res, err = s.checkTyped(ctx, r.GetSubject(), relation, resource, contextuals, store)
	if err != nil {
		return nil, fmt.Errorf("failed to check typed resource: %w", err)
	}
	return res, nil
}

// checkGroupResource check if subject has access to the full "GroupResource", if they do they can access every object
// within it.
func (s *Server) checkGroupResource(ctx context.Context, subject, relation string, resource common.ResourceInfo, contextuals *openfgav1.ContextualTupleKeys, store *storeInfo) (*authzv1.CheckResponse, error) {
	ctx, span := s.tracer.Start(ctx, "server.checkGroupResource")
	defer span.End()

	if !common.IsGroupResourceRelation(relation) {
		return &authzv1.CheckResponse{Allowed: false}, nil
	}

	res, err := s.openfgaCheck(ctx, store, subject, relation, resource.GroupResourceIdent(), contextuals, nil)
	if err != nil {
		return nil, err
	}

	return &authzv1.CheckResponse{Allowed: res.GetAllowed()}, nil
}

// checkTyped checks on our typed resources e.g. folder.
func (s *Server) checkTyped(ctx context.Context, subject, relation string, resource common.ResourceInfo, contextuals *openfgav1.ContextualTupleKeys, store *storeInfo) (*authzv1.CheckResponse, error) {
	ctx, span := s.tracer.Start(ctx, "server.checkTyped")
	defer span.End()

	if !resource.IsValidRelation(relation) {
		return &authzv1.CheckResponse{Allowed: false}, nil
	}

	var (
		resourceIdent       = resource.ResourceIdent()
		resourceCtx         = resource.Context()
		subresourceRelation = common.SubresourceRelation(relation)
	)

	if resource.HasSubresource() {
		// Check if subject has access as a subresource
		res, err := s.openfgaCheck(ctx, store, subject, subresourceRelation, resourceIdent, contextuals, resourceCtx)
		if err != nil {
			return nil, err
		}

		if res.GetAllowed() {
			return &authzv1.CheckResponse{Allowed: res.GetAllowed()}, nil
		}
	}

	if resourceIdent == "" {
		return &authzv1.CheckResponse{Allowed: false}, nil
	}

	// Check if subject has direct access to resource
	res, err := s.openfgaCheck(ctx, store, subject, relation, resourceIdent, contextuals, nil)
	if err != nil {
		return nil, err
	}

	return &authzv1.CheckResponse{Allowed: res.GetAllowed()}, nil
}

// checkGeneric check our generic "resource" type. It checks:
// 1. If subject has access as a sub resource for a folder.
// 2. If subject has direct access to resource.
func (s *Server) checkGeneric(ctx context.Context, subject, relation string, resource common.ResourceInfo, contextuals *openfgav1.ContextualTupleKeys, store *storeInfo) (*authzv1.CheckResponse, error) {
	ctx, span := s.tracer.Start(ctx, "server.checkGeneric")
	defer span.End()

	var (
		folderIdent    = resource.FolderIdent()
		resourceCtx    = resource.Context()
		folderRelation = common.SubresourceRelation(relation)
	)

	if folderIdent != "" && common.IsSubresourceRelation(folderRelation) {
		// Check if subject has access as a sub resource for the folder
		res, err := s.openfgaCheck(ctx, store, subject, folderRelation, folderIdent, contextuals, resourceCtx)
		if err != nil {
			return nil, err
		}

		if res.GetAllowed() {
			return &authzv1.CheckResponse{Allowed: res.GetAllowed()}, nil
		}
	}

	resourceIdent := resource.ResourceIdent()
	if !resource.IsValidRelation(relation) || resourceIdent == "" {
		return &authzv1.CheckResponse{Allowed: false}, nil
	}

	// Check if subject has direct access to resource
	res, err := s.openfgaCheck(ctx, store, subject, relation, resourceIdent, contextuals, resourceCtx)
	if err != nil {
		return nil, err
	}

	return &authzv1.CheckResponse{Allowed: res.GetAllowed()}, nil
}

func (s *Server) openfgaCheck(ctx context.Context, store *storeInfo, subject, relation, object string, contextuals *openfgav1.ContextualTupleKeys, resourceCtx *structpb.Struct) (*openfgav1.CheckResponse, error) {
	res, err := s.openfga.Check(ctx, &openfgav1.CheckRequest{
		StoreId:              store.ID,
		AuthorizationModelId: store.ModelID,
		TupleKey: &openfgav1.CheckRequestTupleKey{
			User:     subject,
			Relation: relation,
			Object:   object,
		},
		Context:          resourceCtx,
		ContextualTuples: contextuals,
	})

	if err != nil {
		// error is decorated by openfga with a public-facing error message, so we need to unwrap it to get the actual error and log it server-side,
		// but we want to return wrapped error to the client to prevent leaking internal error details
		s.logger.Error("failed to perform check", "error", errors.Unwrap(err), "subject", subject, "relation", relation, "object", object)
		return nil, fmt.Errorf("failed to perform openfga Check request: %w", err)
	}

	return res, nil
}
