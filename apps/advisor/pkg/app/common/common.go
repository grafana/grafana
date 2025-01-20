package common

import (
	"context"

	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
)

type AdvisorConfig struct {
	DatasourceSvc         datasources.DataSourceService
	PluginStore           pluginstore.Store
	PluginRepo            repo.Service
	PluginContextProvider *plugincontext.Provider
	PluginClient          plugins.Client
}

type CheckRegisterer interface {
	New(cfg *AdvisorConfig) Check
	Type() string
}

type Check interface {
	Run(ctx context.Context, obj *advisorv0alpha1.CheckSpec) (*advisorv0alpha1.CheckV0alpha1StatusReport, error)
}

var RegisterChecks = []CheckRegisterer{}

func RegisterCheck(check CheckRegisterer) {
	RegisterChecks = append(RegisterChecks, check)
}
