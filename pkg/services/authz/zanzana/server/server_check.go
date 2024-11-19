package server

import (
	"context"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"google.golang.org/protobuf/types/known/structpb"

	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func (s *Server) Check(ctx context.Context, r *authzv1.CheckRequest) (*authzv1.CheckResponse, error) {
	ctx, span := tracer.Start(ctx, "authzServer.Check")
	defer span.End()

	// Check if subject has access through namespace
	store, err := s.getStoreInfo(ctx, r.GetNamespace())
	if err != nil {
		return nil, err
	}

	relation := common.VerbMapping[r.GetVerb()]

	res, err := s.checkNamespace(ctx, r, store, relation)
	if err != nil {
		return nil, err
	}

	if res.GetAllowed() {
		return res, nil
	}

	if info, ok := common.GetTypeInfo(r.GetGroup(), r.GetResource()); ok {
		return s.checkTyped(ctx, r, info, store, relation)
	}
	return s.checkGeneric(ctx, r, store, relation)
}

// checkNamespace checks if subject has access through namespace
func (s *Server) checkNamespace(ctx context.Context, r *authzv1.CheckRequest, store *storeInfo, relation string) (*authzv1.CheckResponse, error) {
	res, err := s.openfga.Check(ctx, &openfgav1.CheckRequest{
		StoreId:              store.ID,
		AuthorizationModelId: store.ModelID,
		TupleKey: &openfgav1.CheckRequestTupleKey{
			User:     r.GetSubject(),
			Relation: relation,
			Object:   common.NewNamespaceResourceIdent(r.GetGroup(), r.GetResource()),
		},
	})
	if err != nil {
		return nil, err
	}

	return &authzv1.CheckResponse{Allowed: res.GetAllowed()}, nil
}

func (s *Server) checkTyped(ctx context.Context, r *authzv1.CheckRequest, info common.TypeInfo, store *storeInfo, relation string) (*authzv1.CheckResponse, error) {
	// Check if subject has direct access to resource
	res, err := s.openfga.Check(ctx, &openfgav1.CheckRequest{
		StoreId:              store.ID,
		AuthorizationModelId: store.ModelID,
		TupleKey: &openfgav1.CheckRequestTupleKey{
			User:     r.GetSubject(),
			Relation: relation,
			Object:   common.NewTypedIdent(info.Type, r.GetName()),
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

func (s *Server) checkGeneric(ctx context.Context, r *authzv1.CheckRequest, store *storeInfo, relation string) (*authzv1.CheckResponse, error) {

	// Check if subject has direct access to resource
	res, err := s.openfga.Check(ctx, &openfgav1.CheckRequest{
		StoreId:              store.ID,
		AuthorizationModelId: store.ModelID,
		TupleKey: &openfgav1.CheckRequestTupleKey{
			User:     r.GetSubject(),
			Relation: relation,
			Object:   common.NewResourceIdent(r.GetGroup(), r.GetResource(), r.GetName()),
		},
		Context: &structpb.Struct{
			Fields: map[string]*structpb.Value{
				"requested_group": structpb.NewStringValue(common.FormatGroupResource(r.GetGroup(), r.GetResource())),
			},
		},
	})

	if err != nil {
		return nil, err
	}

	if res.GetAllowed() {
		return &authzv1.CheckResponse{Allowed: true}, nil
	}

	if r.Folder == "" {
		return &authzv1.CheckResponse{Allowed: false}, nil
	}

	// Check if subject has access as a sub resource for the folder
	res, err = s.openfga.Check(ctx, &openfgav1.CheckRequest{
		StoreId:              store.ID,
		AuthorizationModelId: store.ModelID,
		TupleKey: &openfgav1.CheckRequestTupleKey{
			User:     r.GetSubject(),
			Relation: common.FolderResourceRelation(relation),
			Object:   common.NewFolderIdent(r.GetFolder()),
		},
		Context: &structpb.Struct{
			Fields: map[string]*structpb.Value{
				"requested_group": structpb.NewStringValue(common.FormatGroupResource(r.GetGroup(), r.GetResource())),
			},
		},
	})

	if err != nil {
		return nil, err
	}

	return &authzv1.CheckResponse{Allowed: res.GetAllowed()}, nil
}
