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

	if info, ok := common.GetTypeInfo(r.GetGroup(), r.GetResource()); ok {
		return s.listTyped(ctx, r, info)
	}

	return s.listGeneric(ctx, r)
}

func (s *Server) listTyped(ctx context.Context, r *authzextv1.ListRequest, info common.TypeInfo) (*authzextv1.ListResponse, error) {
	storeInf, err := s.getNamespaceStore(ctx, r.Namespace)
	if err != nil {
		return nil, err
	}

	relation := common.VerbMapping[r.GetVerb()]

	// 1. check if subject has access through namespace because then they can read all of them
	res, err := s.openfga.Check(ctx, &openfgav1.CheckRequest{
		StoreId:              storeInf.Id,
		AuthorizationModelId: storeInf.AuthorizationModelId,
		TupleKey: &openfgav1.CheckRequestTupleKey{
			User:     r.GetSubject(),
			Relation: relation,
			Object:   common.NewNamespaceResourceIdent(r.GetGroup(), r.GetResource()),
		},
	})
	if err != nil {
		return nil, err
	}

	if res.GetAllowed() {
		return &authzextv1.ListResponse{All: true}, nil
	}

	// 2. List all resources user has access too
	listRes, err := s.openfga.ListObjects(ctx, &openfgav1.ListObjectsRequest{
		StoreId:              storeInf.Id,
		AuthorizationModelId: storeInf.AuthorizationModelId,
		Type:                 info.Type,
		Relation:             relation,
		User:                 r.GetSubject(),
	})
	if err != nil {
		return nil, err
	}

	return &authzextv1.ListResponse{
		Items: typedObjects(info.Type, listRes.GetObjects()),
	}, nil
}

func (s *Server) listGeneric(ctx context.Context, r *authzextv1.ListRequest) (*authzextv1.ListResponse, error) {
	storeInf, err := s.getNamespaceStore(ctx, r.Namespace)
	if err != nil {
		return nil, err
	}

	relation := common.VerbMapping[r.GetVerb()]

	// 1. check if subject has access through namespace because then they can read all of them
	res, err := s.openfga.Check(ctx, &openfgav1.CheckRequest{
		StoreId:              storeInf.Id,
		AuthorizationModelId: storeInf.AuthorizationModelId,
		TupleKey: &openfgav1.CheckRequestTupleKey{
			User:     r.GetSubject(),
			Relation: relation,
			Object:   common.NewNamespaceResourceIdent(r.GetGroup(), r.GetResource()),
		},
	})
	if err != nil {
		return nil, err
	}

	if res.Allowed {
		return &authzextv1.ListResponse{All: true}, nil
	}

	// 2. List all folders subject has access to resource type in
	folders, err := s.openfga.ListObjects(ctx, &openfgav1.ListObjectsRequest{
		StoreId:              storeInf.Id,
		AuthorizationModelId: storeInf.AuthorizationModelId,
		Type:                 common.TypeFolder,
		Relation:             common.FolderResourceRelation(relation),
		User:                 r.GetSubject(),
		Context: &structpb.Struct{
			Fields: map[string]*structpb.Value{
				"requested_group": structpb.NewStringValue(common.FormatGroupResource(r.GetGroup(), r.GetResource())),
			},
		},
	})
	if err != nil {
		return nil, err
	}

	// 3. List all resource directly assigned to subject
	direct, err := s.openfga.ListObjects(ctx, &openfgav1.ListObjectsRequest{
		StoreId:              storeInf.Id,
		AuthorizationModelId: storeInf.AuthorizationModelId,
		Type:                 common.TypeResource,
		Relation:             relation,
		User:                 r.GetSubject(),
		Context: &structpb.Struct{
			Fields: map[string]*structpb.Value{
				"requested_group": structpb.NewStringValue(common.FormatGroupResource(r.GetGroup(), r.GetResource())),
			},
		},
	})
	if err != nil {
		return nil, err
	}

	return &authzextv1.ListResponse{
		Folders: folderObject(folders.GetObjects()),
		Items:   directObjects(r.GetGroup(), r.GetResource(), direct.GetObjects()),
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
