package iam

import (
	"context"

	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/kube-openapi/pkg/common"

	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

// LegacyRoleReconcileAPI provides the internal legacy role reconciliation operation.
// It is not an end-user API. Enterprise supplies the implementation.
type LegacyRoleReconcileAPI interface {
	GetAPIRoutes(map[string]common.OpenAPIDefinition) *builder.APIRoutes
	GetAuthorizer() authorizer.Authorizer
}

type NoopLegacyRoleReconcileAPI struct{}

func (NoopLegacyRoleReconcileAPI) GetAPIRoutes(map[string]common.OpenAPIDefinition) *builder.APIRoutes {
	return &builder.APIRoutes{}
}

func (NoopLegacyRoleReconcileAPI) GetAuthorizer() authorizer.Authorizer {
	return authorizer.AuthorizerFunc(func(context.Context, authorizer.Attributes) (authorizer.Decision, string, error) {
		return authorizer.DecisionDeny, "legacy role reconciliation is unavailable", nil
	})
}

type apiServiceConfig struct{ legacyRoleReconcileAPI LegacyRoleReconcileAPI }
type APIServiceOption func(*apiServiceConfig)

func WithLegacyRoleReconcileAPI(api LegacyRoleReconcileAPI) APIServiceOption {
	return func(config *apiServiceConfig) {
		if api != nil {
			config.legacyRoleReconcileAPI = api
		}
	}
}
