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
	cfg             *setting.Cfg
	namespace       string
	clientGenerator func(ctx context.Context) (resource.Client, error)
}

func ProvideService(
	settingsProvider setting.SettingsProvider,
	restConfigProvider apiserver.RestConfigProvider,
) (*Service, error) {
	namespace := "default"
	cfg := settingsProvider.Get()
	if cfg.StackID != "" {
		namespace = apiserverrequest.GetNamespaceMapper(settingsProvider)(1)
	}

	return &Service{
		cfg:       cfg,
		namespace: namespace,
		clientGenerator: func(ctx context.Context) (resource.Client, error) {
			kubeConfig, err := restConfigProvider.GetRestConfig(ctx)
			if err != nil {
				return nil, err
			}
			clientGenerator := k8s.NewClientRegistry(*kubeConfig, k8s.ClientConfig{})
			return clientGenerator.ClientFor(advisorv0alpha1.CheckKind())
		},
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
	client, err := s.clientGenerator(ctx)
	if err != nil {
		return nil, err
	}
	checkList, err := client.List(ctx, s.namespace, resource.ListOptions{})
	if err != nil {
		return nil, err
	}

	latestPluginCheck := findLatestCheck(checkList.GetItems(), plugincheck.CheckID)
	latestDatasourceCheck := findLatestCheck(checkList.GetItems(), datasourcecheck.CheckID)
	reportInfo := &ReportInfo{}
	if latestPluginCheck != nil {
		for _, failure := range latestPluginCheck.Status.Report.Failures {
			switch failure.StepID {
			case plugincheck.UpdateStepID:
				reportInfo.PluginsOutdated++
			case plugincheck.DeprecationStepID:
				reportInfo.PluginsDeprecated++
			}
		}
	}
	if latestDatasourceCheck != nil {
		for _, failure := range latestDatasourceCheck.Status.Report.Failures {
			if failure.StepID == datasourcecheck.HealthCheckStepID {
				reportInfo.DatasourcesUnhealthy++
			}
		}
	}

	return reportInfo, nil
}
