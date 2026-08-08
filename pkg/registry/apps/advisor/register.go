package advisor

import (
	"context"
	"fmt"

	authlib "github.com/grafana/authlib/types"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	advisorapp "github.com/grafana/grafana/apps/advisor/pkg/app"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checkregistry"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	grafanaauthorizer "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ appsdkapiserver.AppInstaller    = (*AppInstaller)(nil)
	_ appinstaller.AuthorizerProvider = (*AppInstaller)(nil)
)

type AppInstaller struct {
	*advisorapp.AdvisorAppInstaller
}

func ProvideAppInstaller(
	accessControlService accesscontrol.Service,
	accessClient authlib.AccessClient,
	checkRegistry checkregistry.CheckService,
	cfg *setting.Cfg,
	orgService org.Service,
	registerer prometheus.Registerer,
) (*AppInstaller, error) {
	if err := registerAccessControlRoles(accessControlService); err != nil {
		return nil, fmt.Errorf("registering access control roles: %w", err)
	}

	resourceAuthorizer := grafanaauthorizer.NewResourceAuthorizer(accessClient)
	appAuthorizer := authorizer.AuthorizerFunc(
		func(ctx context.Context, attr authorizer.Attributes) (authorizer.Decision, string, error) {
			// Translations are static, public UI strings, so no dedicated
			// permission is needed: any authenticated user may read them.
			if attr.IsResourceRequest() && attr.GetResource() == "translations" && attr.GetVerb() == "get" {
				if _, err := identity.GetRequester(ctx); err != nil {
					return authorizer.DecisionDeny, "valid user is required", err
				}
				return authorizer.DecisionAllow, "", nil
			}
			return resourceAuthorizer.Authorize(ctx, attr)
		})
	i, err := advisorapp.ProvideAppInstaller(appAuthorizer, checkRegistry, cfg, orgService, registerer)
	if err != nil {
		return nil, err
	}
	return &AppInstaller{
		AdvisorAppInstaller: i,
	}, nil
}
