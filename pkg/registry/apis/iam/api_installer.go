package iam

import (
	"context"
	"fmt"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/server"
	k8scommon "k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/iam/noopstorage"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/util/errhttp"
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

	// MutateOnCreate mutates the object on creation.
	MutateOnCreate(ctx context.Context, obj T) error

	// MutateOnUpdate mutates the object on update.
	MutateOnUpdate(ctx context.Context, oldObj, newObj T) error

	// MutateOnDelete mutates the object on deletion.
	MutateOnDelete(ctx context.Context, obj T) error

	// MutateOnConnect mutates the object on connect.
	MutateOnConnect(ctx context.Context, obj T) error
}

// RoleApiInstaller provides Role-specific API registration and validation.
// This interface allows enterprise implementations to provide custom role handling
// while keeping the core IAM registration logic in OSS.
type RoleApiInstaller ApiInstaller[*iamv0.Role]

// RoleBindingApiInstaller provides RoleBinding-specific API registration and validation.
type RoleBindingApiInstaller ApiInstaller[*iamv0.RoleBinding]

// GlobalRoleApiInstaller provides GlobalRole-specific API registration and validation.
type GlobalRoleApiInstaller ApiInstaller[*iamv0.GlobalRole]

// TeamLBACApiInstaller provides TeamLBACRule-specific API registration and validation.
type TeamLBACApiInstaller interface {
	ApiInstaller[*iamv0.TeamLBACRule]

	// GetRulesForSubjectGetter returns the mode-aware storage used internally by
	// the for-subject subresource. It intentionally excludes the datasource CRUD
	// authorization wrapper because the subresource has its own service-only
	// authorization contract.
	GetRulesForSubjectGetter() rest.Getter

	// GetTeamLBACUsageRoutes returns the TeamLBAC usage route, denying access when unavailable.
	GetTeamLBACUsageRoutes(defs map[string]k8scommon.OpenAPIDefinition) *builder.APIRoutes

	// GetTeamLBACUsageAuthorizer returns the usage route authorizer, denying access when unavailable.
	GetTeamLBACUsageAuthorizer() authorizer.Authorizer
}

// ExternalGroupMappingApiInstaller provides ExternalGroupMapping-specific API registration and validation.
type ExternalGroupMappingApiInstaller ApiInstaller[*iamv0.ExternalGroupMapping]

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

func (n *NoopApiInstaller[T]) GetRulesForSubjectGetter() rest.Getter {
	return &noopstorage.NoopREST{ResourceInfo: n.ResourceInfo}
}

func (n *NoopApiInstaller[T]) GetTeamLBACUsageRoutes(defs map[string]k8scommon.OpenAPIDefinition) *builder.APIRoutes {
	// Keep the discoverable API contract consistent across editions even though
	// OSS cannot serve usage data.
	response := defs[iamv0.GetTeamLBACUsageResponse{}.OpenAPIModelName()].Schema
	return &builder.APIRoutes{Namespace: []builder.APIRouteHandler{{
		Path: "teamlbacusage",
		Spec: &spec3.PathProps{Get: &spec3.Operation{OperationProps: spec3.OperationProps{
			Tags:        []string{"TeamLBACRule"},
			Description: "Service-only aggregate counts of stored TeamLBAC rules",
			Parameters: []*spec3.Parameter{{ParameterProps: spec3.ParameterProps{
				Name: "namespace", In: "path", Required: true, Schema: spec.StringProperty(),
			}}},
			Responses: &spec3.Responses{ResponsesProps: spec3.ResponsesProps{StatusCodeResponses: map[int]*spec3.Response{
				200: {ResponseProps: spec3.ResponseProps{Content: map[string]*spec3.MediaType{
					"application/json": {MediaTypeProps: spec3.MediaTypeProps{Schema: &response}},
				}}},
			}}},
		}}},
		Handler: func(w http.ResponseWriter, r *http.Request) {
			errhttp.Write(r.Context(), apierrors.NewForbidden(iamv0.TeamLBACRuleInfo.GroupResource(), "", fmt.Errorf("functionality not available")), w)
		},
	}}}
}

func (n *NoopApiInstaller[T]) GetTeamLBACUsageAuthorizer() authorizer.Authorizer {
	return n.GetAuthorizer()
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

func (n *NoopApiInstaller[T]) MutateOnCreate(ctx context.Context, obj T) error {
	// No mutation needed in OSS
	return nil
}

func (n *NoopApiInstaller[T]) MutateOnUpdate(ctx context.Context, oldObj, newObj T) error {
	// No mutation needed in OSS
	return nil
}

func (n *NoopApiInstaller[T]) MutateOnDelete(ctx context.Context, obj T) error {
	// No mutation needed in OSS
	return nil
}

func (n *NoopApiInstaller[T]) MutateOnConnect(ctx context.Context, obj T) error {
	// No mutation needed in OSS
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

// ProvideNoopExternalGroupMappingApiInstaller provides a no-op ExternalGroupMapping installer.
func ProvideNoopExternalGroupMappingApiInstaller() ExternalGroupMappingApiInstaller {
	return &NoopApiInstaller[*iamv0.ExternalGroupMapping]{
		ResourceInfo: iamv0.ExternalGroupMappingResourceInfo,
	}
}

// ProvideNoopRoleBindingApiInstaller provides a no-op RoleBinding installer.
func ProvideNoopRoleBindingApiInstaller() RoleBindingApiInstaller {
	return &NoopApiInstaller[*iamv0.RoleBinding]{
		ResourceInfo: iamv0.RoleBindingInfo,
	}
}
