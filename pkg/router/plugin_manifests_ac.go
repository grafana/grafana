package router

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
)

// This is an access control implementaiton that always says yes if you have access to an app
type pluginManifestAccessControl struct{}

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
