package iam

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/server"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/iam/noopstorage"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

// ApiInstaller is a generic interface for installing API resources.
// This allows different implementations (OSS noop, Enterprise with features)
// to provide their own resource registration and validation logic.
type ApiInstaller[T runtime.Object] interface {
	// GetAuthorizer returns the authorizer for the API group.
	GetAuthorizer() authorizer.Authorizer

	// RegisterStorage registers storage and hooks with the API group.
	RegisterStorage(apiGroupInfo *server.APIGroupInfo, opts *builder.APIGroupOptions, storage map[string]rest.Storage) error

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

// GlobalRoleApiInstaller provides GlobalRole-specific API registration and validation.
type GlobalRoleApiInstaller ApiInstaller[*iamv0.GlobalRole]

// TeamLBACApiInstaller provides TeamLBACRule-specific API registration and validation.
type TeamLBACApiInstaller ApiInstaller[*iamv0.TeamLBACRule]

// NoopApiInstaller is a no-op implementation for when roles are not available (OSS).
type NoopApiInstaller[T runtime.Object] struct {
	ResourceInfo utils.ResourceInfo
}

func (n *NoopApiInstaller[T]) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
		return authorizer.DecisionDeny, "Unavailable functionality", nil
	})
}

func (n *NoopApiInstaller[T]) RegisterStorage(apiGroupInfo *server.APIGroupInfo, opts *builder.APIGroupOptions, storage map[string]rest.Storage) error {
	storage[n.ResourceInfo.StoragePath()] = &noopstorage.NoopREST{ResourceInfo: n.ResourceInfo}
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
	return &NoopApiInstaller[*iamv0.Role]{
		ResourceInfo: iamv0.RoleInfo,
	}
}

// ProvideNoopGlobalRoleApiInstaller provides a no-op global role installer specifically for GlobalRole types.
func ProvideNoopGlobalRoleApiInstaller() GlobalRoleApiInstaller {
	return &NoopApiInstaller[*iamv0.GlobalRole]{
		ResourceInfo: iamv0.GlobalRoleInfo,
	}
}

// ProvideNoopTeamLBACApiInstaller provides a no-op TeamLBACRule installer specifically for TeamLBACRule types.
func ProvideNoopTeamLBACApiInstaller() TeamLBACApiInstaller {
	return &NoopApiInstaller[*iamv0.TeamLBACRule]{
		ResourceInfo: iamv0.TeamLBACRuleInfo,
	}
}
