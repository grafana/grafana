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
	v1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

var (
	errEmptyName        = errors.New("name cannot be empty")
	errInvalidBasicRole = errors.New("invalid basic role")
	errUnknownKind      = errors.New("unknown permission kind")
)

func (s *Server) createPermission(ctx context.Context, store *storeInfo, req *authzextv1.CreatePermissionOperation) error {
	ctx, span := s.tracer.Start(ctx, "server.createPermission")
	defer span.End()

	resource := req.GetResource()
	permission := req.GetPermission()
	object := zanzana.NewObjectEntry(toZanzanaType(resource.GetGroup()), resource.GetGroup(), resource.GetResource(), "", resource.GetName())
	tuple, err := NewResourceTuple(object, resource, permission)
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
		s.logger.Error("failed to create resource permission tuple", "error", err, "resource", object, "permission", permission)
		return err
	}

	return nil
}

func (s *Server) deletePermission(ctx context.Context, store *storeInfo, req *authzextv1.DeletePermissionOperation) error {
	ctx, span := s.tracer.Start(ctx, "server.deletePermission")
	defer span.End()

	resource := req.GetResource()
	permission := req.GetPermission()
	object := zanzana.NewObjectEntry(toZanzanaType(resource.GetGroup()), resource.GetGroup(), resource.GetResource(), "", resource.GetName())
	tuple, err := NewResourceTuple(object, resource, permission)
	if err != nil {
		return err
	}

	_, err = s.openfga.Write(ctx, &openfgav1.WriteRequest{
		StoreId:              store.ID,
		AuthorizationModelId: store.ModelID,
		Deletes: &openfgav1.WriteRequestDeletes{
			TupleKeys: []*openfgav1.TupleKeyWithoutCondition{&openfgav1.TupleKeyWithoutCondition{
				User:     tuple.GetUser(),
				Relation: tuple.GetRelation(),
				Object:   tuple.GetObject(),
			}},
			OnMissing: "ignore",
		},
	})
	if err != nil {
		s.logger.Error("failed to delete resource permission tuple", "error", err, "resource", object, "permission", permission)
		return err
	}

	return nil
}

func toZanzanaType(apiGroup string) string {
	if apiGroup == "folder.grafana.app" {
		return common.TypeFolder
	}
	return common.TypeResource
}

func NewResourceTuple(object string, resource *v1.Resource, perm *v1.Permission) (*openfgav1.TupleKey, error) {
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
