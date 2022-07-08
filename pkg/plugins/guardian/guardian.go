package guardian

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/datasources"
)

var (
	logger = log.New("plugins.guardian")
)

type RemotePluginsGuardian interface {
	CanListAll() bool
	CanList(pluginID string) bool
}

type guardian struct {
	ctx  context.Context
	acc  ac.AccessControl
	user *models.SignedInUser
}

func New(ctx context.Context, acc ac.AccessControl, user *models.SignedInUser) RemotePluginsGuardian {
	return &guardian{ctx: ctx, acc: acc, user: user}
}

func (g *guardian) CanListAll() bool {
	// Organization or Server Admins should be able to list non-core plugins
	// (to fix once RBAC covers everything related to GetPluginList)
	if g.user.HasRole(models.ROLE_ADMIN) || g.user.IsGrafanaAdmin {
		return true
	}

	// When not using access control, only Org or Server Admin can list non-core plugins
	if g.acc.IsDisabled() {
		return false
	}

	// When using access control, should be able to list all installed plugins:
	//  * anyone that can create a data source
	//  * anyone that can install a plugin
	hasAccess, err := g.acc.Evaluate(g.ctx, g.user, ac.EvalAny(
		ac.EvalPermission(plugins.ActionIntall),
		ac.EvalPermission(datasources.ActionCreate),
	))
	if err != nil {
		logger.Warn("failed to evaluate user permissions", "user", g.user.Login, "error", err)
		return false
	}
	return hasAccess
}

func (g *guardian) CanList(pluginID string) bool {
	// Organization or Server Admins should be able to list non-core plugins
	// (to fix once RBAC covers everything related to GetPluginList)
	if g.user.HasRole(models.ROLE_ADMIN) || g.user.IsGrafanaAdmin {
		return true
	}

	// When not using access control, only Org or Server Admin can list non-core plugins
	if g.acc.IsDisabled() {
		return false
	}

	// When using access control, should be able to list all installed plugins:
	//  * anyone that can create a data source
	//  * anyone that can install a plugin
	// Should be able to list this installed plugin:
	//  * anyone that can toggle this plugin
	hasAccess, err := g.acc.Evaluate(g.ctx, g.user, ac.EvalAny(
		ac.EvalPermission(plugins.ActionIntall),
		ac.EvalPermission(datasources.ActionCreate),
		ac.EvalPermission(plugins.ActionSettingsWrite, plugins.ScopeProvider.GetResourceScope(pluginID)),
	))
	if err != nil {
		logger.Warn("failed to evaluate user permissions", "user", g.user.Login, "plugin", pluginID, "error", err)
		return false
	}
	return hasAccess
}
