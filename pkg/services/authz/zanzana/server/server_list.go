package server

import (
	"context"
	"fmt"
	"strings"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func (s *Server) List(ctx context.Context, r *authzv1.ListRequest) (*authzv1.ListResponse, error) {
	ctx, span := tracer.Start(ctx, "authzServer.List")
	defer span.End()

	store, err := s.getStoreInfo(ctx, r.Namespace)
	if err != nil {
		return nil, err
	}

	relation := common.VerbMapping[r.GetVerb()]
	resource := common.NewResourceInfoFromList(r)

	res, err := s.checkGroupResource(ctx, r.GetSubject(), relation, resource, store)
	if err != nil {
		return nil, err
	}

	if res.GetAllowed() {
		return &authzv1.ListResponse{All: true}, nil
	}

	if resource.IsGeneric() {
		return s.listGeneric(ctx, r.GetSubject(), relation, resource, store)
	}

	return s.listTyped(ctx, r.GetSubject(), relation, resource, store)
}

func (s *Server) listObjects(ctx context.Context, req *openfgav1.ListObjectsRequest) (*openfgav1.ListObjectsResponse, error) {
	err := s.addListAuthorizationContext(ctx, req)
	if err != nil {
		s.logger.Error("failed to add authorization context", "error", err)
	}

	if s.cfg.UseStreamedListObjects {
		return s.streamedListObjects(ctx, req)
	}
	return s.openfga.ListObjects(ctx, req)
}

func (s *Server) listTyped(ctx context.Context, subject, relation string, resource common.ResourceInfo, store *storeInfo) (*authzv1.ListResponse, error) {
	if !resource.IsValidRelation(relation) {
		return &authzv1.ListResponse{}, nil
	}

	// List all resources user has access too
	res, err := s.listObjects(ctx, &openfgav1.ListObjectsRequest{
		StoreId:              store.ID,
		AuthorizationModelId: store.ModelID,
		Type:                 resource.Type(),
		Relation:             relation,
		User:                 subject,
	})
	if err != nil {
		return nil, err
	}

	return &authzv1.ListResponse{
		Items: typedObjects(resource.Type(), res.GetObjects()),
	}, nil
}

func (s *Server) listGeneric(ctx context.Context, subject, relation string, resource common.ResourceInfo, store *storeInfo) (*authzv1.ListResponse, error) {
	var (
		folderRelation = common.FolderResourceRelation(relation)
		resourceCtx    = resource.Context()
	)

	// 1. List all folders subject has access to resource type in
	var folders []string
	if common.IsFolderResourceRelation(folderRelation) {
		res, err := s.listObjects(ctx, &openfgav1.ListObjectsRequest{
			StoreId:              store.ID,
			AuthorizationModelId: store.ModelID,
			Type:                 common.TypeFolder,
			Relation:             folderRelation,
			User:                 subject,
			Context:              resourceCtx,
		})

		if err != nil {
			return nil, err
		}

		folders = res.GetObjects()
	}

	// 2. List all resource directly assigned to subject
	var objects []string
	if resource.IsValidRelation(relation) {
		res, err := s.listObjects(ctx, &openfgav1.ListObjectsRequest{
			StoreId:              store.ID,
			AuthorizationModelId: store.ModelID,
			Type:                 common.TypeResource,
			Relation:             relation,
			User:                 subject,
			Context:              resourceCtx,
		})
		if err != nil {
			return nil, err
		}

		objects = res.GetObjects()
	}

	return &authzv1.ListResponse{
		Folders: folderObject(folders),
		Items:   directObjects(resource.GroupResource(), objects),
	}, nil
}

func typedObjects(typ string, objects []string) []string {
	prefix := fmt.Sprintf("%s:", typ)
	for i := range objects {
		objects[i] = strings.TrimPrefix(objects[i], prefix)
	}
	return objects
}

func directObjects(gr string, objects []string) []string {
	prefix := fmt.Sprintf("%s:%s/", resourceType, gr)
	for i := range objects {
		objects[i] = strings.TrimPrefix(objects[i], prefix)
	}
	return objects
}

func folderObject(objects []string) []string {
	for i := range objects {
		objects[i] = strings.TrimPrefix(objects[i], folderTypePrefix)
	}
	return objects
}
