package featuremgmt

// codeowner string that references a GH team or user
// the value must match the format used in the CODEOWNERS file
type codeowner string

const (
	grafanaAppPlatformSquad                     codeowner = "@grafana/grafana-app-platform-squad"
	grafanaDashboardsSquad                      codeowner = "@grafana/dashboards-squad"
	grafanaExploreSquad                         codeowner = "@grafana/explore-squad"
	grafanaBiSquad                              codeowner = "@grafana/grafana-bi-squad"
	grafanaDatavizSquad                         codeowner = "@grafana/dataviz-squad"
	grafanaFrontendPlatformSquad                codeowner = "@grafana/grafana-frontend-platform"
	grafanaBackendPlatformSquad                 codeowner = "@grafana/backend-platform"
	grafanaPluginsPlatformSquad                 codeowner = "@grafana/plugins-platform-backend"
	grafanaAsCodeSquad                          codeowner = "@grafana/grafana-as-code"
	grafanaAuthnzSquad                          codeowner = "@grafana/grafana-authnz-team"
	grafanaObservabilityLogsSquad               codeowner = "@grafana/observability-logs"
	grafanaObservabilityTracesAndProfilingSquad codeowner = "@grafana/observability-traces-and-profiling"
	grafanaObservabilityMetricsSquad            codeowner = "@grafana/observability-metrics"
	grafanaAlertingSquad                        codeowner = "@grafana/alerting-squad"
	hostedGrafanaTeam                           codeowner = "@grafana/hosted-grafana-team"
	awsDatasourcesSquad                         codeowner = "@grafana/aws-datasources"
	appO11ySquad                                codeowner = "@grafana/app-o11y"
	grafanaPartnerPluginsSquad                  codeowner = "@grafana/partner-datasources"
	grafanaOperatorExperienceSquad              codeowner = "@grafana/grafana-operator-experience-squad"
	enterpriseDatasourcesSquad                  codeowner = "@grafana/enterprise-datasources"
	grafanaSharingSquad                         codeowner = "@grafana/sharing-squad"
	grafanaMachineLearningSquad                 codeowner = "@grafana/machine-learning"
)
