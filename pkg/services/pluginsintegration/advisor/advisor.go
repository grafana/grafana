package advisor

import (
	"context"

	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/resource"
	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks/datasourcecheck"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks/plugincheck"
	"github.com/grafana/grafana/pkg/services/apiserver"
	apiserverrequest "github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/setting"
)

type AdvisorStats interface {
	ReportSummary(ctx context.Context) (*ReportInfo, error)
}

type Service struct {
	cfg                *setting.Cfg
	restConfigProvider apiserver.RestConfigProvider
	namespace          string
	client             resource.Client
}

func ProvideService(
	cfg *setting.Cfg,
	restConfigProvider apiserver.RestConfigProvider,
) (*Service, error) {
	namespace := "default"
	if cfg != nil && cfg.StackID != "" {
		namespace = apiserverrequest.GetNamespaceMapper(cfg)(1)
	}

	return &Service{
		cfg:                cfg,
		restConfigProvider: restConfigProvider,
		namespace:          namespace,
	}, nil
}

type ReportInfo struct {
	PluginsOutdated      int
	PluginsDeprecated    int
	DatasourcesUnhealthy int
}

func (s *Service) ReportSummary(ctx context.Context) (*ReportInfo, error) {
	if s.client == nil {
		kubeConfig, err := s.restConfigProvider.GetRestConfig(ctx)
		if err != nil {
			return nil, err
		}
		clientGenerator := k8s.NewClientRegistry(*kubeConfig, k8s.ClientConfig{})
		client, err := clientGenerator.ClientFor(advisorv0alpha1.CheckKind())
		if err != nil {
			return nil, err
		}
		s.client = client
	}

	checkList, err := s.client.List(ctx, s.namespace, resource.ListOptions{})
	if err != nil {
		return nil, err
	}

	var lastPluginCheck *advisorv0alpha1.Check
	var lastDatasourceCheck *advisorv0alpha1.Check
	for _, check := range checkList.GetItems() {
		if check.GetLabels()[checks.TypeLabel] == plugincheck.CheckID {
			if lastPluginCheck == nil || lastPluginCheck.GetCommonMetadata().CreationTimestamp.Before(check.GetCommonMetadata().CreationTimestamp) {
				lastPluginCheck = check.(*advisorv0alpha1.Check)
			}
		}
		if check.GetLabels()[checks.TypeLabel] == datasourcecheck.CheckID {
			if lastDatasourceCheck == nil || lastDatasourceCheck.GetCommonMetadata().CreationTimestamp.Before(check.GetCommonMetadata().CreationTimestamp) {
				lastDatasourceCheck = check.(*advisorv0alpha1.Check)
			}
		}
	}

	reportInfo := &ReportInfo{}
	if lastPluginCheck != nil {
		for _, failure := range lastPluginCheck.CheckStatus.Report.Failures {
			if failure.StepID == plugincheck.UpdateStepID {
				reportInfo.PluginsOutdated++
			} else if failure.StepID == plugincheck.DeprecationStepID {
				reportInfo.PluginsDeprecated++
			}
		}
	}
	if lastDatasourceCheck != nil {
		for _, failure := range lastDatasourceCheck.CheckStatus.Report.Failures {
			if failure.StepID == datasourcecheck.HealthCheckStepID {
				reportInfo.DatasourcesUnhealthy++
			}
		}
	}

	return reportInfo, nil
}
