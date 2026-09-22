package router

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
)

// Remote deployments bypass the legacy app-access permission check because local
// plugin settings are unavailable. Authentication remains in authenticatingWrapper;
// this implementation grants app access regardless of the requester or scope.
type pluginManifestAccessControl struct{}

var _ accesscontrol.AccessControl = pluginManifestAccessControl{}

func (pluginManifestAccessControl) Evaluate(_ context.Context, _ identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
	return evaluator.EvaluateCustom(func(action string, _ ...string) (bool, error) {
		return action == pluginaccesscontrol.ActionAppAccess, nil
	})
}

func (pluginManifestAccessControl) RegisterScopeAttributeResolver(string, accesscontrol.ScopeAttributeResolver) {
}

func (a pluginManifestAccessControl) WithoutResolvers() accesscontrol.AccessControl {
	return a
}

func (pluginManifestAccessControl) InvalidateResolverCache(int64, string) {}
