package iam

import (
	"context"
	"strings"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	v1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

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
			User: strings.ToLower(string(p.Kind)) + ":" + p.Name,
			// "view", "edit", "admin"
			Relation: p.Verb,
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
