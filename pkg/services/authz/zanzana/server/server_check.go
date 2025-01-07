package server

import (
	"context"
	"fmt"
	"strings"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func (s *Server) Check(ctx context.Context, r *authzv1.CheckRequest) (*authzv1.CheckResponse, error) {
	ctx, span := tracer.Start(ctx, "authzServer.Check")
	defer span.End()

	store, err := s.getStoreInfo(ctx, r.GetNamespace())
	if err != nil {
		return nil, err
	}

	relation := common.VerbMapping[r.GetVerb()]

	resource := common.NewResourceInfoFromCheck(r)
	res, err := s.checkGroupResource(ctx, r.GetSubject(), relation, resource, store)
	if err != nil {
		return nil, err
	}

	if res.GetAllowed() {
		return res, nil
	}

	if resource.IsGeneric() {
		return s.checkGeneric(ctx, r.GetSubject(), relation, resource, store)
	}

	return s.checkTyped(ctx, r.GetSubject(), relation, resource, store)
}

// checkGroupResource check if subject has access to the full "GroupResource", if they do they can access every object
// within it.
func (s *Server) checkGroupResource(ctx context.Context, subject, relation string, resource common.ResourceInfo, store *storeInfo) (*authzv1.CheckResponse, error) {
	if !common.IsGroupResourceRelation(relation) {
		return &authzv1.CheckResponse{Allowed: false}, nil
	}

	req := &openfgav1.CheckRequest{
		StoreId:              store.ID,
		AuthorizationModelId: store.ModelID,
		TupleKey: &openfgav1.CheckRequestTupleKey{
			User:     subject,
			Relation: relation,
			Object:   resource.GroupResourceIdent(),
		},
	}

	if strings.HasPrefix(subject, fmt.Sprintf("%s:", common.TypeRenderService)) {
		common.AddRenderContext(req)
	}

	res, err := s.check(ctx, req)
	if err != nil {
		return nil, err
	}

	return &authzv1.CheckResponse{Allowed: res.GetAllowed()}, nil
}

// checkTyped checks on our typed resources e.g. folder.
func (s *Server) checkTyped(ctx context.Context, subject, relation string, resource common.ResourceInfo, store *storeInfo) (*authzv1.CheckResponse, error) {
	if !resource.IsValidRelation(relation) {
		return &authzv1.CheckResponse{Allowed: false}, nil
	}

	// Check if subject has direct access to resource
	res, err := s.check(ctx, &openfgav1.CheckRequest{
		StoreId:              store.ID,
		AuthorizationModelId: store.ModelID,
		TupleKey: &openfgav1.CheckRequestTupleKey{
			User:     subject,
			Relation: relation,
			Object:   resource.ResourceIdent(),
		},
	})
	if err != nil {
		return nil, err
	}

	if res.GetAllowed() {
		return &authzv1.CheckResponse{Allowed: true}, nil
	}

	return &authzv1.CheckResponse{Allowed: false}, nil
}

// checkGeneric check our generic "resource" type. It checks:
// 1. If subject has access as a sub resource for a folder.
// 2. If subject has direct access to resource.
func (s *Server) checkGeneric(ctx context.Context, subject, relation string, resource common.ResourceInfo, store *storeInfo) (*authzv1.CheckResponse, error) {
	var (
		folderIdent    = resource.FolderIdent()
		resourceCtx    = resource.Context()
		folderRelation = common.FolderResourceRelation(relation)
	)

	if folderIdent != "" && common.IsFolderResourceRelation(folderRelation) {
		// Check if subject has access as a sub resource for the folder
		res, err := s.check(ctx, &openfgav1.CheckRequest{
			StoreId:              store.ID,
			AuthorizationModelId: store.ModelID,
			TupleKey: &openfgav1.CheckRequestTupleKey{
				User:     subject,
				Relation: folderRelation,
				Object:   folderIdent,
			},
			Context: resourceCtx,
		})

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
	res, err := s.check(ctx, &openfgav1.CheckRequest{
		StoreId:              store.ID,
		AuthorizationModelId: store.ModelID,
		TupleKey: &openfgav1.CheckRequestTupleKey{
			User:     subject,
			Relation: relation,
			Object:   resourceIdent,
		},
		Context: resourceCtx,
	})

	if err != nil {
		return nil, err
	}

	return &authzv1.CheckResponse{Allowed: res.GetAllowed()}, nil
}

func (s *Server) check(ctx context.Context, req *openfgav1.CheckRequest) (*openfgav1.CheckResponse, error) {
	err := s.addCheckAuthorizationContext(ctx, req)
	if err != nil {
		s.logger.Error("failed to add authorization context", "error", err)
	}

	return s.openfga.Check(ctx, req)
}
