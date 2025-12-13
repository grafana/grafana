package advisor

import (
	"fmt"

	authlib "github.com/grafana/authlib/types"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	advisorapp "github.com/grafana/grafana/apps/advisor/pkg/app"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checkregistry"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/appinstaller"
	grafanaauthorizer "github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	_ appsdkapiserver.AppInstaller    = (*AdvisorAppInstaller)(nil)
	_ appinstaller.AuthorizerProvider = (*AdvisorAppInstaller)(nil)
)

type AdvisorAppInstaller struct {
	*advisorapp.AdvisorAppInstaller
}

func ProvideAppInstaller(
	accessControlService accesscontrol.Service,
	accessClient authlib.AccessClient,
	checkRegistry checkregistry.CheckService,
	cfg *setting.Cfg,
	orgService org.Service,
) (*AdvisorAppInstaller, error) {
	if err := registerAccessControlRoles(accessControlService); err != nil {
		return nil, fmt.Errorf("registering access control roles: %w", err)
	}

	authorizer := grafanaauthorizer.NewResourceAuthorizer(accessClient)
	i, err := advisorapp.ProvideAppInstaller(authorizer, checkRegistry, cfg, orgService)
	if err != nil {
		return nil, err
	}
	return &AdvisorAppInstaller{
		AdvisorAppInstaller: i,
	}, nil
}
