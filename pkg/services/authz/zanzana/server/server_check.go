package server

import (
	"context"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"google.golang.org/protobuf/types/known/structpb"
)

func (s *Server) Check(ctx context.Context, r *authzv1.CheckRequest) (*authzv1.CheckResponse, error) {
	ctx, span := tracer.Start(ctx, "authzServer.Check")
	defer span.End()

	if info, ok := typeInfo(r.GetGroup(), r.GetResource()); ok {
		return s.checkTyped(ctx, r, info)
	}
	return s.checkGeneric(ctx, r)
}

func (s *Server) checkTyped(ctx context.Context, r *authzv1.CheckRequest, info TypeInfo) (*authzv1.CheckResponse, error) {
	relation := mapping[r.GetVerb()]

	// 1. check if subject has direct access to resource
	res, err := s.openfga.Check(ctx, &openfgav1.CheckRequest{
		StoreId:              s.storeID,
		AuthorizationModelId: s.modelID,
		TupleKey: &openfgav1.CheckRequestTupleKey{
			User:     r.GetSubject(),
			Relation: relation,
			Object:   newTypedIdent(info.typ, r.GetName()),
		},
	})
	if err != nil {
		return nil, err
	}

	if res.GetAllowed() {
		return &authzv1.CheckResponse{Allowed: true}, nil
	}

	// 2. check if subject has access through namespace
	res, err = s.openfga.Check(ctx, &openfgav1.CheckRequest{
		StoreId:              s.storeID,
		AuthorizationModelId: s.modelID,
		TupleKey: &openfgav1.CheckRequestTupleKey{
			User:     r.GetSubject(),
			Relation: relation,
			Object:   newNamespaceResourceIdent(r.GetGroup(), r.GetResource()),
		},
	})
	if err != nil {
		return nil, err
	}

	return &authzv1.CheckResponse{Allowed: res.GetAllowed()}, nil
}

func (s *Server) checkGeneric(ctx context.Context, r *authzv1.CheckRequest) (*authzv1.CheckResponse, error) {
	relation := mapping[r.GetVerb()]
	// 1. check if subject has direct access to resource
	res, err := s.openfga.Check(ctx, &openfgav1.CheckRequest{
		StoreId:              s.storeID,
		AuthorizationModelId: s.modelID,
		TupleKey: &openfgav1.CheckRequestTupleKey{
			User:     r.GetSubject(),
			Relation: relation,
			Object:   newResourceIdent(r.GetGroup(), r.GetResource(), r.GetName()),
		},
		Context: &structpb.Struct{
			Fields: map[string]*structpb.Value{
				"requested_group": structpb.NewStringValue(formatGroupResource(r.GetGroup(), r.GetResource())),
			},
		},
	})

	if err != nil {
		// FIXME: wrap error
		return nil, err
	}

	if res.GetAllowed() {
		return &authzv1.CheckResponse{Allowed: true}, nil
	}

	// 2. check if subject has access through namespace
	res, err = s.openfga.Check(ctx, &openfgav1.CheckRequest{
		StoreId:              s.storeID,
		AuthorizationModelId: s.modelID,
		TupleKey: &openfgav1.CheckRequestTupleKey{
			User:     r.GetSubject(),
			Relation: relation,
			Object:   newNamespaceResourceIdent(r.GetGroup(), r.GetResource()),
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

	// 3. check if subject has access as a sub resource for the folder
	res, err = s.openfga.Check(ctx, &openfgav1.CheckRequest{
		StoreId:              s.storeID,
		AuthorizationModelId: s.modelID,
		TupleKey: &openfgav1.CheckRequestTupleKey{
			User:     r.GetSubject(),
			Relation: relation,
			Object:   newFolderResourceIdent(r.GetGroup(), r.GetResource(), r.GetFolder()),
		},
		Context: &structpb.Struct{
			Fields: map[string]*structpb.Value{
				"requested_group": structpb.NewStringValue(formatGroupResource(r.GetGroup(), r.GetResource())),
			},
		},
	})

	if err != nil {
		return nil, err
	}

	return &authzv1.CheckResponse{Allowed: res.GetAllowed()}, nil
}
