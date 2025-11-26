package storewrapper

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime"
)

type ResourcePermissionsAuthorizer struct {
}

func NewResourcePermissionsAuthorizer() *ResourcePermissionsAuthorizer {
	return &ResourcePermissionsAuthorizer{}
}

// AfterGet implements ResourceStorageAuthorizer.
func (r *ResourcePermissionsAuthorizer) AfterGet(ctx context.Context, obj runtime.Object) error {
	panic("unimplemented")
}

// BeforeCreate implements ResourceStorageAuthorizer.
func (r *ResourcePermissionsAuthorizer) BeforeCreate(ctx context.Context, obj runtime.Object) error {
	panic("unimplemented")
}

// BeforeDelete implements ResourceStorageAuthorizer.
func (r *ResourcePermissionsAuthorizer) BeforeDelete(ctx context.Context, obj runtime.Object) error {
	panic("unimplemented")
}

// BeforeUpdate implements ResourceStorageAuthorizer.
func (r *ResourcePermissionsAuthorizer) BeforeUpdate(ctx context.Context, obj runtime.Object) error {
	panic("unimplemented")
}

// FilterList implements ResourceStorageAuthorizer.
func (r *ResourcePermissionsAuthorizer) FilterList(ctx context.Context, list runtime.Object) (runtime.Object, error) {
	panic("unimplemented")
}

var _ ResourceStorageAuthorizer = (*ResourcePermissionsAuthorizer)(nil)
