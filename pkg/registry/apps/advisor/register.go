package advisor

import (
	"context"
	"fmt"

	authlib "github.com/grafana/authlib/types"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/prometheus/client_golang/prometheus"

	advisorapp "github.com/grafana/grafana/apps/advisor/pkg/app"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checkregistry"
	appsdkapiserver "github.com/grafana/grafana/pkg/apiserver/appsdk"
	"github.com/grafana/grafana/pkg/infra/log"
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

// aggregationFlag routes advisor.grafana.app requests to the multi-tenant
// advisor when it is on.
const aggregationFlag = "aggregation.advisor-grafana-app.enabled"

type AppInstaller struct {
	*advisorapp.AdvisorAppInstaller
}

// ProvideAppInstaller returns nil when the aggregationFlag is on, so the app,
// its check type registerer and its check scheduler don't run in this Grafana.
// The advisor access control roles are registered either way.
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

	ctx := context.Background()
	if openfeature.NewDefaultClient().Boolean(ctx, aggregationFlag, false, openfeature.TransactionContext(ctx)) {
		log.New("app-registry").Info("Skipping advisor.grafana.app apiserver: served by the multi-tenant advisor", "flag", aggregationFlag)
		return nil, nil
	}

	authorizer := grafanaauthorizer.NewResourceAuthorizer(accessClient)
	i, err := advisorapp.ProvideAppInstaller(authorizer, checkRegistry, cfg, orgService, registerer)
	if err != nil {
		return nil, err
	}
	return &AppInstaller{
		AdvisorAppInstaller: i,
	}, nil
}
