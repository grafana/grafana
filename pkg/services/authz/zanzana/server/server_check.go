package server

import (
	"context"
	"fmt"
	"strings"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"google.golang.org/protobuf/types/known/structpb"

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

	// Check if subject has access through namespace
	res, err := s.checkNamespace(ctx, r.GetSubject(), relation, r.GetGroup(), r.GetResource(), store)
	if err != nil {
		return nil, err
	}

	if res.GetAllowed() {
		return res, nil
	}

	if info, ok := common.GetTypeInfo(r.GetGroup(), r.GetResource()); ok {
		return s.checkTyped(ctx, r.GetSubject(), relation, r.GetName(), info, store)
	}
	return s.checkGeneric(ctx, r.GetSubject(), relation, r.GetGroup(), r.GetResource(), r.GetName(), r.GetFolder(), store)
}

// checkTyped performes check on the root "namespace". If subject has access through the namespace they have access to
// every resource for that "GroupResource".
func (s *Server) checkNamespace(ctx context.Context, subject, relation, group, resource string, store *storeInfo) (*authzv1.CheckResponse, error) {
	req := &openfgav1.CheckRequest{
		StoreId:              store.ID,
		AuthorizationModelId: store.ModelID,
		TupleKey: &openfgav1.CheckRequestTupleKey{
			User:     subject,
			Relation: relation,
			Object:   common.NewNamespaceResourceIdent(group, resource),
		},
	}
	if strings.HasPrefix(subject, fmt.Sprintf("%s:", common.TypeRenderService)) {
		common.AddRenderContext(req)
	}

	res, err := s.openfga.Check(ctx, req)
	if err != nil {
		return nil, err
	}

	return &authzv1.CheckResponse{Allowed: res.GetAllowed()}, nil
}

// checkTyped performes checks on our typed resources e.g. folder.
func (s *Server) checkTyped(ctx context.Context, subject, relation, name string, info common.TypeInfo, store *storeInfo) (*authzv1.CheckResponse, error) {
	// Check if subject has direct access to resource
	res, err := s.openfga.Check(ctx, &openfgav1.CheckRequest{
		StoreId:              store.ID,
		AuthorizationModelId: store.ModelID,
		TupleKey: &openfgav1.CheckRequestTupleKey{
			User:     subject,
			Relation: relation,
			Object:   common.NewTypedIdent(info.Type, name),
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

// checkGeneric check our generic "resource" type.
func (s *Server) checkGeneric(ctx context.Context, subject, relation, group, resource, name, folder string, store *storeInfo) (*authzv1.CheckResponse, error) {
	groupResource := structpb.NewStringValue(common.FormatGroupResource(group, resource))

	// Create relation can only exist on namespace or folder level.
	// So we skip direct resource access check.
	if relation != common.RelationCreate {
		// Check if subject has direct access to resource
		res, err := s.openfga.Check(ctx, &openfgav1.CheckRequest{
			StoreId:              store.ID,
			AuthorizationModelId: store.ModelID,
			TupleKey: &openfgav1.CheckRequestTupleKey{
				User:     subject,
				Relation: relation,
				Object:   common.NewResourceIdent(group, resource, name),
			},
			Context: &structpb.Struct{
				Fields: map[string]*structpb.Value{
					"requested_group": groupResource,
				},
			},
		})

		if err != nil {
			return nil, err
		}

		if res.GetAllowed() {
			return &authzv1.CheckResponse{Allowed: true}, nil
		}
	}

	if folder == "" {
		return &authzv1.CheckResponse{Allowed: false}, nil
	}

	// Check if subject has access as a sub resource for the folder
	res, err := s.openfga.Check(ctx, &openfgav1.CheckRequest{
		StoreId:              store.ID,
		AuthorizationModelId: store.ModelID,
		TupleKey: &openfgav1.CheckRequestTupleKey{
			User:     subject,
			Relation: common.FolderResourceRelation(relation),
			Object:   common.NewFolderIdent(folder),
		},
		Context: &structpb.Struct{
			Fields: map[string]*structpb.Value{
				"requested_group": groupResource,
			},
		},
	})

	if err != nil {
		return nil, err
	}

	return &authzv1.CheckResponse{Allowed: res.GetAllowed()}, nil
}
