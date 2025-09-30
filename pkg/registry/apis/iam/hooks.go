package iam

import (
	"context"
	"strings"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"google.golang.org/protobuf/types/known/structpb"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	v1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

func toZanzanaSubject(kind iamv0.ResourcePermissionSpecPermissionKind, uid string) string {
	switch kind {
	case iamv0.ResourcePermissionSpecPermissionKindUser:
		return zanzana.NewTupleEntry(zanzana.TypeUser, uid, "")
	case iamv0.ResourcePermissionSpecPermissionKindServiceAccount:
		return zanzana.NewTupleEntry(zanzana.TypeServiceAccount, uid, "")
	case iamv0.ResourcePermissionSpecPermissionKindTeam:
		return zanzana.NewTupleEntry(zanzana.TypeTeam, uid, "")
	case iamv0.ResourcePermissionSpecPermissionKindBasicRole:
		// e.g role:basic_viewer#assignee
		return zanzana.NewTupleEntry(
			zanzana.TypeRole,
			zanzana.TranslateBasicRole(uid),
			zanzana.RelationAssignee,
		)
	}
	// should not happen since we are after create
	// validation webhook should have caught invalid kinds
	return ""
}

func NewResourceTuple(resource iamv0.ResourcePermissionspecResource, perm iamv0.ResourcePermissionspecPermission) *v1.TupleKey {
	key := &v1.TupleKey{
		// e.g. "user:{uid}", "serviceaccount:{uid}", "team:{uid}", "basicrole:{viewer|editor|admin}"
		User: toZanzanaSubject(perm.Kind, perm.Name),
		// "view", "edit", "admin"
		Relation: strings.ToLower(perm.Verb),
	}

	if resource.ApiGroup == "folder.grafana.app" {
		key.Object = zanzana.NewObjectEntry(zanzana.TypeFolder, "", "", "", resource.Name)
	} else {
		key.Object = zanzana.NewObjectEntry(
			zanzana.TypeFolder, resource.ApiGroup, resource.Resource, "", resource.Name,
		)
		// TODO Understand the with group_filter condition
		key.Condition = &v1.RelationshipCondition{
			Name: "group_filter",
			Context: &structpb.Struct{
				Fields: map[string]*structpb.Value{
					"group_resource": structpb.NewStringValue(
						resource.ApiGroup + "/" + resource.Resource,
					),
				},
			},
		}
	}

	return key
}

func (b *IdentityAccessManagementAPIBuilder) AfterResourcePermissionCreate(obj runtime.Object, options *metav1.CreateOptions) {
	if b.zClient == nil {
		return
	}

	rp, ok := obj.(*iamv0.ResourcePermission)
	if !ok {
		return
	}

	resource := rp.Spec.Resource
	permissions := rp.Spec.Permissions

	tuples := make([]*v1.TupleKey, 0, len(permissions))
	for _, p := range permissions {
		tuples = append(tuples, NewResourceTuple(resource, p))
	}

	b.logger.Debug("writing resource permission to zanzana",
		"namespace", rp.Namespace,
		"resource", resource.ApiGroup+":"+resource.Resource+":"+resource.Name,
		"tuplesCnt", len(tuples),
	)

	err := b.zClient.Write(context.Background(), &v1.WriteRequest{
		Namespace: rp.Namespace,
		Writes: &v1.WriteRequestWrites{
			TupleKeys: tuples,
		},
	})
	if err != nil {
		b.logger.Error("failed to write resource permission to zanzana", "err", err)
	}
}
