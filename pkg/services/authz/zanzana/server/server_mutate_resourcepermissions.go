package server

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"google.golang.org/protobuf/types/known/structpb"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	zanzana "github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

var (
	errEmptyName        = errors.New("name cannot be empty")
	errInvalidBasicRole = errors.New("invalid basic role")
	errUnknownKind      = errors.New("unknown permission kind")
)

func (s *Server) mutateResourcePermissions(ctx context.Context, store *storeInfo, operations []*authzextv1.MutateOperation) error {
	ctx, span := s.tracer.Start(ctx, "server.mutateResourcePermissions")
	defer span.End()

	writeTuples := make([]*openfgav1.TupleKey, 0)
	deleteTuples := make([]*openfgav1.TupleKeyWithoutCondition, 0)

	for _, operation := range operations {
		switch op := operation.Operation.(type) {
		case *authzextv1.MutateOperation_AddPermission:
			tuple, err := s.getPermissionWriteTuple(ctx, op.AddPermission)
			if err != nil {
				return err
			}
			writeTuples = append(writeTuples, tuple)
		case *authzextv1.MutateOperation_DeletePermission:
			tuple, err := s.getPermissionDeleteTuple(ctx, op.DeletePermission)
			if err != nil {
				return err
			}
			deleteTuples = append(deleteTuples, tuple)
		}
	}

	_, err := s.openfga.Write(ctx, &openfgav1.WriteRequest{
		StoreId:              store.ID,
		AuthorizationModelId: store.ModelID,
		Writes: &openfgav1.WriteRequestWrites{
			TupleKeys:   writeTuples,
			OnDuplicate: "ignore",
		},
		Deletes: &openfgav1.WriteRequestDeletes{
			TupleKeys: deleteTuples,
			OnMissing: "ignore",
		},
	})
	if err != nil {
		s.logger.Error("failed to write resource permission tuples", "error", err)
		return err
	}

	return nil
}

func (s *Server) getPermissionWriteTuple(ctx context.Context, req *authzextv1.CreatePermissionOperation) (*openfgav1.TupleKey, error) {
	resource := req.GetResource()
	permission := req.GetPermission()
	object := zanzana.NewObjectEntry(toZanzanaType(resource.GetGroup()), resource.GetGroup(), resource.GetResource(), "", resource.GetName())
	tuple, err := NewResourceTuple(object, resource, permission)
	if err != nil {
		return nil, err
	}

	return tuple, nil
}

func (s *Server) getPermissionDeleteTuple(ctx context.Context, req *authzextv1.DeletePermissionOperation) (*openfgav1.TupleKeyWithoutCondition, error) {
	resource := req.GetResource()
	permission := req.GetPermission()
	object := zanzana.NewObjectEntry(toZanzanaType(resource.GetGroup()), resource.GetGroup(), resource.GetResource(), "", resource.GetName())
	tuple, err := NewResourceTuple(object, resource, permission)
	if err != nil {
		return nil, err
	}

	return &openfgav1.TupleKeyWithoutCondition{
		User:     tuple.GetUser(),
		Relation: tuple.GetRelation(),
		Object:   tuple.GetObject(),
	}, nil
}

func (s *Server) createPermission(ctx context.Context, store *storeInfo, req *authzextv1.CreatePermissionOperation) error {
	ctx, span := s.tracer.Start(ctx, "server.createPermission")
	defer span.End()

	tuple, err := s.getPermissionWriteTuple(ctx, req)
	if err != nil {
		return err
	}

	_, err = s.openfga.Write(ctx, &openfgav1.WriteRequest{
		StoreId:              store.ID,
		AuthorizationModelId: store.ModelID,
		Writes: &openfgav1.WriteRequestWrites{
			TupleKeys:   []*openfgav1.TupleKey{tuple},
			OnDuplicate: "ignore",
		},
	})
	if err != nil {
		s.logger.Error("failed to create resource permission tuple", "error", err, "resource", tuple.GetObject(), "permission", req.GetPermission())
		return err
	}

	return nil
}

func (s *Server) deletePermission(ctx context.Context, store *storeInfo, req *authzextv1.DeletePermissionOperation) error {
	ctx, span := s.tracer.Start(ctx, "server.deletePermission")
	defer span.End()

	tuple, err := s.getPermissionDeleteTuple(ctx, req)
	if err != nil {
		return err
	}

	_, err = s.openfga.Write(ctx, &openfgav1.WriteRequest{
		StoreId:              store.ID,
		AuthorizationModelId: store.ModelID,
		Deletes: &openfgav1.WriteRequestDeletes{
			TupleKeys: []*openfgav1.TupleKeyWithoutCondition{tuple},
			OnMissing: "ignore",
		},
	})
	if err != nil {
		s.logger.Error("failed to delete resource permission tuple", "error", err, "resource", tuple.GetObject(), "permission", req.GetPermission())
		return err
	}

	return nil
}

func toZanzanaType(apiGroup string) string {
	if apiGroup == "folder.grafana.app" {
		return zanzana.TypeFolder
	}
	return zanzana.TypeResource
}

func NewResourceTuple(object string, resource *authzextv1.Resource, perm *authzextv1.Permission) (*openfgav1.TupleKey, error) {
	// Typ is "folder" or "resource"
	typ := toZanzanaType(resource.Group)

	// subject
	subject, err := toZanzanaSubject(perm.GetKind(), perm.GetName())
	if err != nil {
		return nil, err
	}

	key := &openfgav1.TupleKey{
		// e.g. "user:{uid}", "serviceaccount:{uid}", "team:{uid}", "basicrole:{viewer|editor|admin}"
		User: subject,
		// "view", "edit", "admin"
		Relation: strings.ToLower(perm.Verb),
		// e.g. "folder:{name}" or "resource:{apiGroup}/{resource}/{name}"
		Object: object,
	}

	// For resources we add a condition to filter by apiGroup/resource
	// e.g "group_filter": {"group_resource": "dashboards.grafana.app/dashboards"}
	if typ == zanzana.TypeResource {
		key.Condition = &openfgav1.RelationshipCondition{
			Name: "group_filter",
			Context: &structpb.Struct{
				Fields: map[string]*structpb.Value{
					"group_resource": structpb.NewStringValue(
						resource.GetGroup() + "/" + resource.GetResource(),
					),
				},
			},
		}
	}

	return key, nil
}

func toZanzanaSubject(kind string, name string) (string, error) {
	if name == "" {
		return "", errEmptyName
	}
	iamKind := iamv0.ResourcePermissionSpecPermissionKind(kind)
	switch iamKind {
	case iamv0.ResourcePermissionSpecPermissionKindUser:
		return zanzana.NewTupleEntry(zanzana.TypeUser, name, ""), nil
	case iamv0.ResourcePermissionSpecPermissionKindServiceAccount:
		return zanzana.NewTupleEntry(zanzana.TypeServiceAccount, name, ""), nil
	case iamv0.ResourcePermissionSpecPermissionKindTeam:
		return zanzana.NewTupleEntry(zanzana.TypeTeam, name, ""), nil
	case iamv0.ResourcePermissionSpecPermissionKindBasicRole:
		basicRole := zanzana.TranslateBasicRole(name)
		if basicRole == "" {
			return "", fmt.Errorf("%w: %s", errInvalidBasicRole, name)
		}

		// e.g role:basic_viewer#assignee
		return zanzana.NewTupleEntry(zanzana.TypeRole, basicRole, zanzana.RelationAssignee), nil
	}

	// should not happen since we are after create
	// validation webhook should have caught invalid kinds
	return "", errUnknownKind
}
