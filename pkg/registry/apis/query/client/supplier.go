package client

import (
	"context"

	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/registry/apis/query/clientapi"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/setting"
)

type singleTenantClientSupplier struct {
	client   clientapi.QueryDataClient
	features featuremgmt.FeatureToggles
	cfg      *setting.Cfg
}

func NewSingleTenantClientSupplier(cfg *setting.Cfg, features featuremgmt.FeatureToggles, p plugins.Client, ctxProv *plugincontext.Provider, accessControl accesscontrol.AccessControl) clientapi.DataSourceClientSupplier {
	return &singleTenantClientSupplier{
		cfg:      cfg,
		features: features,
		client:   newQueryClientForPluginClient(p, ctxProv, accessControl),
	}
}

func (s *singleTenantClientSupplier) GetDataSourceClient(_ context.Context, _ data.DataSourceRef, _ map[string]string, _ clientapi.InstanceConfigurationSettings) (clientapi.QueryDataClient, error) {
	return s.client, nil
}

func (s *singleTenantClientSupplier) GetInstanceConfigurationSettings(ctx context.Context) (clientapi.InstanceConfigurationSettings, error) {
	return clientapi.InstanceConfigurationSettings{
		StackID:                      0,
		FeatureToggles:               s.features,
		FullConfig:                   nil,
		Options:                      nil,
		SQLExpressionCellLimit:       s.cfg.SQLExpressionCellLimit,
		SQLExpressionOutputCellLimit: s.cfg.SQLExpressionOutputCellLimit,
		SQLExpressionTimeout:         s.cfg.SQLExpressionTimeout,
		ExpressionsEnabled:           s.cfg.ExpressionsEnabled,
	}, nil
}
