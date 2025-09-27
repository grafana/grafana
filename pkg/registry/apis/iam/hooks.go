package iam

import (
	"context"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	v1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
)

func toZanzanaType(kind iamv0.ResourcePermissionSpecPermissionKind) string {
	switch kind {
	case iamv0.ResourcePermissionSpecPermissionKindUser:
		return zanzana.TypeUser
	case iamv0.ResourcePermissionSpecPermissionKindServiceAccount:
		return zanzana.TypeServiceAccount
	case iamv0.ResourcePermissionSpecPermissionKindTeam:
		return zanzana.TypeTeam
	case iamv0.ResourcePermissionSpecPermissionKindBasicRole:
		return zanzana.TypeRole
	}
	// should not happen since we are after create
	// validation webhook should have caught invalid kinds
	return ""
}

func toZanzanaRelation(verb string) string {
	switch verb {
	case "view":
		return zanzana.RelationSetView
	case "edit":
		return zanzana.RelationSetEdit
	case "admin":
		return zanzana.RelationSetAdmin
	}
	// should not happen since we are after create
	// validation webhook should have caught invalid verbs
	return ""
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
		tuples = append(tuples, &v1.TupleKey{
			// e.g. "user:{uid}", "serviceaccount:{uid}", "team:{uid}", "basicrole:{viewer|editor|admin}"
			User: toZanzanaType(p.Kind) + ":" + p.Name,
			// "view", "edit", "admin"
			Relation: toZanzanaRelation(p.Verb),
			// e.g. "folder.grafana.app:folders:fold1"
			Object: resource.ApiGroup + ":" + resource.Resource + ":" + resource.Name,
		})
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
