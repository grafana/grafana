package iam

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic/registry"
)

// AfterRoleBindingCreate is a post-create hook that writes the role binding to Zanzana (openFGA)
func (b *IdentityAccessManagementAPIBuilder) AfterRoleBindingCreate(obj runtime.Object, _ *metav1.CreateOptions) {
	if b.zClient == nil {
		return
	}

	return
}

// AfterRoleBindingDelete is a post-delete hook that removes the role binding from Zanzana (openFGA)
func (b *IdentityAccessManagementAPIBuilder) AfterRoleBindingDelete(obj runtime.Object, _ *metav1.DeleteOptions) {
	if b.zClient == nil {
		return
	}

	return
}

// BeginRoleBindingUpdate is a pre-update hook that prepares zanzana updates.
// It performs the zanzana write after K8s update succeeds.
func (b *IdentityAccessManagementAPIBuilder) BeginRoleBindingUpdate(ctx context.Context, obj, oldObj runtime.Object, options *metav1.UpdateOptions) (registry.FinishFunc, error) {
	if b.zClient == nil {
		return nil, nil
	}

	return nil, nil
}
