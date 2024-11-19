package server

import (
	"context"
	"fmt"
	"strings"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"google.golang.org/protobuf/types/known/structpb"

	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func (s *Server) List(ctx context.Context, r *authzextv1.ListRequest) (*authzextv1.ListResponse, error) {
	ctx, span := tracer.Start(ctx, "authzServer.List")
	defer span.End()

	store, err := s.getStoreInfo(ctx, r.Namespace)
	if err != nil {
		return nil, err
	}

	relation := common.VerbMapping[r.GetVerb()]

	res, err := s.checkNamespace(
		ctx,
		r.GetSubject(),
		relation,
		r.GetGroup(),
		r.GetResource(),
		store,
	)

	if err != nil {
		return nil, err
	}

	if res.GetAllowed() {
		return &authzextv1.ListResponse{All: true}, nil
	}

	if info, ok := common.GetTypeInfo(r.GetGroup(), r.GetResource()); ok {
		return s.listTyped(ctx, r.GetSubject(), relation, info, store)
	}

	return s.listGeneric(ctx, r.GetSubject(), relation, r.GetGroup(), r.GetResource(), store)
}

func (s *Server) listTyped(ctx context.Context, subject, relation string, info common.TypeInfo, store *storeInfo) (*authzextv1.ListResponse, error) {
	// List all resources user has access too
	listRes, err := s.openfga.ListObjects(ctx, &openfgav1.ListObjectsRequest{
		StoreId:              store.ID,
		AuthorizationModelId: store.ModelID,
		Type:                 info.Type,
		Relation:             relation,
		User:                 subject,
	})
	if err != nil {
		return nil, err
	}

	return &authzextv1.ListResponse{
		Items: typedObjects(info.Type, listRes.GetObjects()),
	}, nil
}

func (s *Server) listGeneric(ctx context.Context, subject, relation, group, resource string, store *storeInfo) (*authzextv1.ListResponse, error) {
	groupResource := structpb.NewStringValue(common.FormatGroupResource(group, resource))

	// 1. List all folders subject has access to resource type in
	folders, err := s.openfga.ListObjects(ctx, &openfgav1.ListObjectsRequest{
		StoreId:              store.ID,
		AuthorizationModelId: store.ModelID,
		Type:                 common.TypeFolder,
		Relation:             common.FolderResourceRelation(relation),
		User:                 subject,
		Context: &structpb.Struct{
			Fields: map[string]*structpb.Value{
				"requested_group": groupResource,
			},
		},
	})
	if err != nil {
		return nil, err
	}

	// 2. List all resource directly assigned to subject
	direct, err := s.openfga.ListObjects(ctx, &openfgav1.ListObjectsRequest{
		StoreId:              store.ID,
		AuthorizationModelId: store.ModelID,
		Type:                 common.TypeResource,
		Relation:             relation,
		User:                 subject,
		Context: &structpb.Struct{
			Fields: map[string]*structpb.Value{
				"requested_group": groupResource,
			},
		},
	})
	if err != nil {
		return nil, err
	}

	return &authzextv1.ListResponse{
		Folders: folderObject(folders.GetObjects()),
		Items:   directObjects(group, resource, direct.GetObjects()),
	}, nil
}

func typedObjects(typ string, objects []string) []string {
	prefix := fmt.Sprintf("%s:", typ)
	for i := range objects {
		objects[i] = strings.TrimPrefix(objects[i], prefix)
	}
	return objects
}

func directObjects(group, resource string, objects []string) []string {
	prefix := fmt.Sprintf("%s:%s/%s/", resourceType, group, resource)
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
