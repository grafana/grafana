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

func isMoreRecent(check1 resource.Object, check2 resource.Object) bool {
	return check1.GetCommonMetadata().CreationTimestamp.After(check2.GetCommonMetadata().CreationTimestamp)
}

// findLatestCheck returns the most recent check of the specified type from the list
func findLatestCheck(checkList []resource.Object, checkType string) *advisorv0alpha1.Check {
	var latestCheck *advisorv0alpha1.Check
	for _, check := range checkList {
		currentCheckType := check.GetLabels()[checks.TypeLabel]
		if currentCheckType != checkType {
			continue
		}
		if latestCheck == nil || isMoreRecent(check, latestCheck) {
			latestCheck = check.(*advisorv0alpha1.Check)
		}
	}
	return latestCheck
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

	latestPluginCheck := findLatestCheck(checkList.GetItems(), plugincheck.CheckID)
	latestDatasourceCheck := findLatestCheck(checkList.GetItems(), datasourcecheck.CheckID)
	reportInfo := &ReportInfo{}
	if latestPluginCheck != nil {
		for _, failure := range latestPluginCheck.CheckStatus.Report.Failures {
			if failure.StepID == plugincheck.UpdateStepID {
				reportInfo.PluginsOutdated++
			} else if failure.StepID == plugincheck.DeprecationStepID {
				reportInfo.PluginsDeprecated++
			}
		}
	}
	if latestDatasourceCheck != nil {
		for _, failure := range latestDatasourceCheck.CheckStatus.Report.Failures {
			if failure.StepID == datasourcecheck.HealthCheckStepID {
				reportInfo.DatasourcesUnhealthy++
			}
		}
	}

	return reportInfo, nil
}
