package client

import (
	"context"

	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/registry/apis/query/clientapi"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/setting"
)

type singleTenantInstanceProvider struct {
	client   clientapi.QueryDataClient
	features featuremgmt.FeatureToggles
	cfg      *setting.Cfg
}

type singleTenantInstance struct {
	client   clientapi.QueryDataClient
	features featuremgmt.FeatureToggles
	cfg      *setting.Cfg
}

func (t *singleTenantInstance) GetDataSourceClient(_ context.Context, _ data.DataSourceRef) (clientapi.QueryDataClient, error) {
	return t.client, nil
}

func NewSingleTenantInstanceProvider(cfg *setting.Cfg, features featuremgmt.FeatureToggles, p plugins.Client, ctxProv *plugincontext.Provider, accessControl accesscontrol.AccessControl) clientapi.InstanceProvider {
	return &singleTenantInstanceProvider{
		cfg:      cfg,
		features: features,
		client:   newQueryClientForPluginClient(p, ctxProv, accessControl),
	}
}

func (s *singleTenantInstanceProvider) GetInstance(_ context.Context, _ map[string]string) (clientapi.Instance, error) {
	return &singleTenantInstance{
		client:   s.client,
		features: s.features,
		cfg:      s.cfg,
	}, nil
}

func (s *singleTenantInstance) GetSettings() clientapi.InstanceConfigurationSettings {
	return clientapi.InstanceConfigurationSettings{
		FeatureToggles:                s.features,
		SQLExpressionCellLimit:        s.cfg.SQLExpressionCellLimit,
		SQLExpressionOutputCellLimit:  s.cfg.SQLExpressionOutputCellLimit,
		SQLExpressionQueryLengthLimit: s.cfg.SQLExpressionQueryLengthLimit,
		SQLExpressionTimeout:          s.cfg.SQLExpressionTimeout,
		ExpressionsEnabled:            s.cfg.ExpressionsEnabled,
	}
}

func (s *singleTenantInstance) GetLogger(parent log.Logger) log.Logger {
	// currently we do not add any extra info
	return parent.New()
}

func (s *singleTenantInstance) ReportMetrics() {
	// we do not report any metrics currently
}
