package server

import (
	"context"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func (s *Server) Check(ctx context.Context, r *authzv1.CheckRequest) (*authzv1.CheckResponse, error) {
	ctx, span := s.tracer.Start(ctx, "server.Check")
	defer span.End()

	if err := authorize(ctx, r.GetNamespace()); err != nil {
		return nil, err
	}

	store, err := s.getStoreInfo(ctx, r.GetNamespace())
	if err != nil {
		return nil, err
	}

	relation := common.VerbMapping[r.GetVerb()]

	contextuals, err := s.getContextuals(r.GetSubject())
	if err != nil {
		return nil, err
	}

	resource := common.NewResourceInfoFromCheck(r)
	res, err := s.checkGroupResource(ctx, r.GetSubject(), relation, resource, contextuals, store)
	if err != nil {
		return nil, err
	}

	if res.GetAllowed() {
		return res, nil
	}

	if resource.IsGeneric() {
		return s.checkGeneric(ctx, r.GetSubject(), relation, resource, contextuals, store)
	}

	return s.checkTyped(ctx, r.GetSubject(), relation, resource, contextuals, store)
}

// checkGroupResource check if subject has access to the full "GroupResource", if they do they can access every object
// within it.
func (s *Server) checkGroupResource(ctx context.Context, subject, relation string, resource common.ResourceInfo, contextuals *openfgav1.ContextualTupleKeys, store *storeInfo) (*authzv1.CheckResponse, error) {
	if !common.IsGroupResourceRelation(relation) {
		return &authzv1.CheckResponse{Allowed: false}, nil
	}

	res, err := s.openfga.Check(ctx, &openfgav1.CheckRequest{
		StoreId:              store.ID,
		AuthorizationModelId: store.ModelID,
		TupleKey: &openfgav1.CheckRequestTupleKey{
			User:     subject,
			Relation: relation,
			Object:   resource.GroupResourceIdent(),
		},
		ContextualTuples: contextuals,
	})
	if err != nil {
		return nil, err
	}

	return &authzv1.CheckResponse{Allowed: res.GetAllowed()}, nil
}

// checkTyped checks on our typed resources e.g. folder.
func (s *Server) checkTyped(ctx context.Context, subject, relation string, resource common.ResourceInfo, contextuals *openfgav1.ContextualTupleKeys, store *storeInfo) (*authzv1.CheckResponse, error) {
	if !resource.IsValidRelation(relation) {
		return &authzv1.CheckResponse{Allowed: false}, nil
	}

	// Check if subject has direct access to resource
	res, err := s.openfga.Check(ctx, &openfgav1.CheckRequest{
		StoreId:              store.ID,
		AuthorizationModelId: store.ModelID,
		TupleKey: &openfgav1.CheckRequestTupleKey{
			User:     subject,
			Relation: relation,
			Object:   resource.ResourceIdent(),
		},
		ContextualTuples: contextuals,
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
func (s *Server) checkGeneric(ctx context.Context, subject, relation string, resource common.ResourceInfo, contextuals *openfgav1.ContextualTupleKeys, store *storeInfo) (*authzv1.CheckResponse, error) {
	var (
		folderIdent    = resource.FolderIdent()
		resourceCtx    = resource.Context()
		folderRelation = common.FolderResourceRelation(relation)
	)

	if folderIdent != "" && common.IsFolderResourceRelation(folderRelation) {
		// Check if subject has access as a sub resource for the folder
		res, err := s.openfga.Check(ctx, &openfgav1.CheckRequest{
			StoreId:              store.ID,
			AuthorizationModelId: store.ModelID,
			TupleKey: &openfgav1.CheckRequestTupleKey{
				User:     subject,
				Relation: folderRelation,
				Object:   folderIdent,
			},
			Context:          resourceCtx,
			ContextualTuples: contextuals,
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
	res, err := s.openfga.Check(ctx, &openfgav1.CheckRequest{
		StoreId:              store.ID,
		AuthorizationModelId: store.ModelID,
		TupleKey: &openfgav1.CheckRequestTupleKey{
			User:     subject,
			Relation: relation,
			Object:   resourceIdent,
		},
		Context:          resourceCtx,
		ContextualTuples: contextuals,
	})

	if err != nil {
		return nil, err
	}

	return &authzv1.CheckResponse{Allowed: res.GetAllowed()}, nil
}
