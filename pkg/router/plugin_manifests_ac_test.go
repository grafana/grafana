package router

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/appplugin"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
)

func TestPluginManifestAccessControl(t *testing.T) {
	appAccess := accesscontrol.EvalPermission(pluginaccesscontrol.ActionAppAccess, "plugins:id:test-app")
	otherPermission := accesscontrol.EvalPermission("plugins:write", "plugins:id:test-app")
	for _, tc := range []struct {
		name      string
		evaluator accesscontrol.Evaluator
		allowed   bool
	}{
		{name: "app access", evaluator: appAccess, allowed: true},
		{name: "another app", evaluator: accesscontrol.EvalPermission(pluginaccesscontrol.ActionAppAccess, "plugins:id:another-app"), allowed: true},
		{name: "unscoped app access", evaluator: accesscontrol.EvalPermission(pluginaccesscontrol.ActionAppAccess), allowed: true},
		{name: "empty scope", evaluator: accesscontrol.EvalPermission(pluginaccesscontrol.ActionAppAccess, ""), allowed: true},
		{name: "non-plugin scope", evaluator: accesscontrol.EvalPermission(pluginaccesscontrol.ActionAppAccess, "folders:uid:test-folder"), allowed: true},
		{name: "multiple scopes", evaluator: accesscontrol.EvalPermission(pluginaccesscontrol.ActionAppAccess, "plugins:id:test-app", "plugins:id:another-app"), allowed: true},
		{name: "unrelated action", evaluator: otherPermission},
		{name: "empty action", evaluator: accesscontrol.EvalPermission("")},
		{name: "all requires unrelated permission", evaluator: accesscontrol.EvalAll(appAccess, otherPermission)},
		{name: "any accepts app access", evaluator: accesscontrol.EvalAny(otherPermission, appAccess), allowed: true},
		{name: "all accepts app access", evaluator: accesscontrol.EvalAll(appAccess, appAccess), allowed: true},
		{name: "any denies unrelated permission", evaluator: accesscontrol.EvalAny(otherPermission)},
		{name: "nested evaluators", evaluator: accesscontrol.EvalAll(appAccess, accesscontrol.EvalAny(otherPermission, appAccess)), allowed: true},
		{name: "empty all", evaluator: accesscontrol.EvalAll(), allowed: true},
		{name: "empty any", evaluator: accesscontrol.EvalAny()},
	} {
		t.Run(tc.name, func(t *testing.T) {
			for _, ac := range []accesscontrol.AccessControl{pluginManifestAccessControl{}, pluginManifestAccessControl{}.WithoutResolvers()} {
				allowed, err := ac.Evaluate(t.Context(), nil, tc.evaluator)
				require.NoError(t, err)
				require.Equal(t, tc.allowed, allowed)
			}
		})
	}
}

func TestPluginManifestAccessChecker(t *testing.T) {
	check := appplugin.NewPluginAccessChecker(pluginManifestAccessControl{})
	decision, reason, err := check(t.Context(), &identity.StaticRequester{UserUID: "test-user"}, "test-app")
	require.NoError(t, err)
	require.Equal(t, authorizer.DecisionAllow, decision)
	require.Empty(t, reason)
}
