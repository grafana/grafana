package router

import (
	"context"
	"fmt"
	"regexp"

	authzlib "github.com/grafana/authlib/authz"
	"github.com/grafana/authlib/types"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	appv0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/authz/legacyclient"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/adapters"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginaccesscontrol"
	"github.com/grafana/grafana/pkg/setting"
)

func cloudSettingsAccessChecker(client legacyclient.LegacyAccessClient) pluginaccesscontrol.AppAccessChecker {
	if client == nil {
		return nil
	}
	return func(ctx context.Context, user identity.Requester, id string) (authorizer.Decision, string, error) {
		ns := request.NamespaceValue(ctx)
		if ns == "" {
			if info, ok := request.RequestInfoFrom(ctx); ok {
				ns = info.Namespace
			}
		}
		if ns == "" || ns == "*" {
			return authorizer.DecisionDeny, "a concrete namespace is required", nil
		}
		verb := "get"
		if info, ok := request.RequestInfoFrom(ctx); ok {
			verb = info.Verb
		}
		service := authzlib.CheckServicePermissions(user, id, appv0.APP_RESOURCE_NAME, verb)
		if !service.Allowed {
			return authorizer.DecisionDeny, "token does not allow this app operation", nil
		}
		if service.ServiceCall {
			return authorizer.DecisionAllow, "", nil
		}
		allowed, err := (cloudSettingsAccessControl{client}).Evaluate(request.WithNamespace(ctx, ns), user,
			accesscontrol.EvalPermission(pluginaccesscontrol.ActionAppAccess, pluginaccesscontrol.ScopeProvider.GetResourceScope(id)))
		if err != nil || !allowed {
			return authorizer.DecisionDeny, "app access denied", err
		}
		return authorizer.DecisionAllow, "", nil
	}
}

func cloudSettingsNamespaceAuthorizer(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return authorizer.DecisionDeny, "a requester is required", nil
	}
	if !attr.IsResourceRequest() {
		// Discovery has no namespace for the legacy app-access check.
		if attr.IsReadOnly() {
			return authorizer.DecisionAllow, "settings discovery", nil
		}
		return authorizer.DecisionNoOpinion, "", nil
	}
	ns, err := types.ParseNamespace(attr.GetNamespace())
	if err != nil || ns.StackID < 1 || !types.NamespaceMatches(user.GetNamespace(), ns.Value) {
		return authorizer.DecisionDeny, "a matching stack namespace is required", nil
	}
	return authorizer.DecisionNoOpinion, "", nil
}

// The namespace is the tenant identity. The deployment already selects the
// plugin process; no stack configuration or per-tenant version lookup is needed.
type cloudPluginContext struct{}

func (cloudPluginContext) PluginContextForApp(ctx context.Context, id string, settings *backend.AppInstanceSettings) (context.Context, backend.PluginContext, error) {
	info, ok := request.RequestInfoFrom(ctx)
	if !ok {
		return ctx, backend.PluginContext{}, fmt.Errorf("missing request info")
	}
	if info.Namespace == "" {
		return ctx, backend.PluginContext{}, fmt.Errorf("a concrete namespace is required")
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return ctx, backend.PluginContext{}, err
	}
	return ctx, backend.PluginContext{
		Namespace:  info.Namespace, // the tenant identity
		APIVersion: info.APIVersion,
		PluginID:   id, AppInstanceSettings: settings,
		User: adapters.BackendUserFromSignedInUser(user),
	}, nil
}

type cloudSettingsAccessControl struct {
	client legacyclient.LegacyAccessClient
}

func (a cloudSettingsAccessControl) Evaluate(ctx context.Context, user identity.Requester, evaluator accesscontrol.Evaluator) (bool, error) {
	ns := request.NamespaceValue(ctx)
	if ns == "" || ns == "*" || a.client == nil {
		return false, nil
	}
	orgID := user.GetOrgID()

	// NOTE! this is an experimental client that may not always be accurate
	// This should not yet be deployed in production.
	return a.client.LegacyCheck(ctx, legacyclient.LegacyCheckRequest{
		Namespace:      ns,
		Subject:        user.GetUID(),
		RequesterOrgID: &orgID,
		Evaluator:      evaluator,
	})
}

func (cloudSettingsAccessControl) RegisterScopeAttributeResolver(string, accesscontrol.ScopeAttributeResolver) {
}

func (a cloudSettingsAccessControl) WithoutResolvers() accesscontrol.AccessControl { return a }
func (cloudSettingsAccessControl) InvalidateResolverCache(int64, string)           {}

// cloudAppSettingsEnabled reports whether the cloud loader serves app settings
// from the plugins source.
func cloudAppSettingsEnabled(cfg *setting.Cfg) bool {
	return len(cloudAppSettingsPlugins(cfg)) > 0
}

// cloudAppSettingsPlugins returns the plugin ID patterns whose settings the
// cloud loader serves, from app_settings_plugins. Settings roll out per plugin,
// so an empty list serves none, unlike group patterns, where it matches every
// group; "*" serves every plugin.
func cloudAppSettingsPlugins(cfg *setting.Cfg) []*regexp.Regexp {
	if cfg == nil {
		return nil
	}
	var patterns []string
	for _, p := range splitGroupPatterns(cfg.SectionWithEnvOverrides(cloudRouterSection).Key("app_settings_plugins").MustString("")) {
		if p != "" {
			patterns = append(patterns, p)
		}
	}
	return compileGroupPatterns(patterns)
}

func cloudSettingsClient(client plugins.Client, middleware []backend.HandlerMiddleware) (plugins.Client, error) {
	if client == nil {
		// Frontend-only apps can serve settings and proxy routes without a v2 backend.
		client = &backend.Handlers{
			CheckHealthHandler: backend.CheckHealthHandlerFunc(func(context.Context, *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
				return nil, plugins.ErrMethodNotImplemented
			}),
			CallResourceHandler: backend.CallResourceHandlerFunc(func(context.Context, *backend.CallResourceRequest, backend.CallResourceResponseSender) error {
				return plugins.ErrMethodNotImplemented
			}),
		}
	}
	return backend.HandlerFromMiddlewares(client, middleware...)
}
