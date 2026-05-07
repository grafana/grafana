package client

import (
	"context"

	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/registry/apis/query/clientapi"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
	"github.com/grafana/grafana/pkg/setting"
)

type singleTenantInstanceProvider struct {
	client       clientapi.QueryDataClient
	instanceConf clientapi.InstanceConfigurationSettings
}

type singleTenantInstance struct {
	client       clientapi.QueryDataClient
	instanceConf clientapi.InstanceConfigurationSettings
	logger       log.Logger
}

func (t *singleTenantInstance) GetDataSourceClient(_ context.Context, _ data.DataSourceRef) (clientapi.QueryDataClient, error) {
	return t.client, nil
}

func NewSingleTenantInstanceProvider(cfg *setting.Cfg, features featuremgmt.FeatureToggles, p plugins.Client, ctxProv *plugincontext.Provider, accessControl accesscontrol.AccessControl) clientapi.InstanceProvider {
	conf := clientapi.InstanceConfigurationSettings{
		FeatureToggles:                features,
		SQLExpressionCellLimit:        cfg.SQLExpressionCellLimit,
		SQLExpressionOutputCellLimit:  cfg.SQLExpressionOutputCellLimit,
		SQLExpressionQueryLengthLimit: cfg.SQLExpressionQueryLengthLimit,
		SQLExpressionTimeout:          cfg.SQLExpressionTimeout,
		ExpressionsEnabled:            cfg.ExpressionsEnabled,
	}

	return &singleTenantInstanceProvider{
		instanceConf: conf,
		client:       newQueryClientForPluginClient(p, ctxProv, accessControl),
	}
}

func (s *singleTenantInstanceProvider) GetInstance(_ context.Context, logger log.Logger, _ map[string]string) (clientapi.Instance, error) {
	return &singleTenantInstance{
		client:       s.client,
		instanceConf: s.instanceConf,
		logger:       logger,
	}, nil
}

func (s *singleTenantInstanceProvider) GetMode() string {
	return "st"
}

func (s *singleTenantInstance) GetSettings() clientapi.InstanceConfigurationSettings {
	return s.instanceConf
}

func (s *singleTenantInstance) GetLogger() log.Logger {
	return s.logger
}

func (s *singleTenantInstance) ReportMetrics() {
	// we do not report any metrics currently
}
