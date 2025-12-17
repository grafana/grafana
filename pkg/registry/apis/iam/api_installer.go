package iam

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/server"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

// ApiInstaller is a generic interface for installing API resources.
// This allows different implementations (OSS noop, Enterprise with features)
// to provide their own resource registration and validation logic.
type ApiInstaller[T runtime.Object] interface {
	// UpdateAPIGroupInfo registers storage and hooks with the API group.
	UpdateAPIGroupInfo(apiGroupInfo *server.APIGroupInfo, opts *builder.APIGroupOptions, storage map[string]rest.Storage) error

	// ValidateOnCreate validates object creation.
	ValidateOnCreate(ctx context.Context, obj T) error

	// ValidateOnUpdate validates object updates.
	ValidateOnUpdate(ctx context.Context, oldObj, newObj T) error

	// ValidateOnDelete validates object deletion.
	ValidateOnDelete(ctx context.Context, obj T) error
}

// RoleApiInstaller provides Role-specific API registration and validation.
// This interface allows enterprise implementations to provide custom role handling
// while keeping the core IAM registration logic in OSS.
type RoleApiInstaller ApiInstaller[*iamv0.Role]

// NoopApiInstaller is a no-op implementation for when roles are not available (OSS).
type NoopApiInstaller[T runtime.Object] struct{}

func (n *NoopApiInstaller[T]) UpdateAPIGroupInfo(apiGroupInfo *server.APIGroupInfo, opts *builder.APIGroupOptions, storage map[string]rest.Storage) error {
	// TODO: Register a noop storage backend?
	// No registration needed in OSS
	return nil
}

func (n *NoopApiInstaller[T]) ValidateOnCreate(ctx context.Context, obj T) error {
	// No validation needed in OSS
	return nil
}

func (n *NoopApiInstaller[T]) ValidateOnUpdate(ctx context.Context, oldObj, newObj T) error {
	// No validation needed in OSS
	return nil
}

func (n *NoopApiInstaller[T]) ValidateOnDelete(ctx context.Context, obj T) error {
	// No validation needed in OSS
	return nil
}

// ProvideNoopRoleApiInstaller provides a no-op role installer specifically for Role types.
// This is needed for Wire dependency injection which doesn't handle generic functions well.
func ProvideNoopRoleApiInstaller() RoleApiInstaller {
	return &NoopApiInstaller[*iamv0.Role]{}
}
