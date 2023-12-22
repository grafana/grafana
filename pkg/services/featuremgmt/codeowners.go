package featuremgmt

// Codeowner string that references a GH team or user
// the value must match the format used in the CODEOWNERS file
type Codeowner string

const (
	grafanaAppPlatformSquad                     Codeowner = "@grafana/grafana-app-platform-squad"
	grafanaDashboardsSquad                      Codeowner = "@grafana/dashboards-squad"
	grafanaExploreSquad                         Codeowner = "@grafana/explore-squad"
	grafanaBiSquad                              Codeowner = "@grafana/grafana-bi-squad"
	grafanaDatavizSquad                         Codeowner = "@grafana/dataviz-squad"
	grafanaFrontendPlatformSquad                Codeowner = "@grafana/grafana-frontend-platform"
	grafanaBackendPlatformSquad                 Codeowner = "@grafana/backend-platform"
	grafanaPluginsPlatformSquad                 Codeowner = "@grafana/plugins-platform-backend"
	grafanaAsCodeSquad                          Codeowner = "@grafana/grafana-as-code"
	identityAccessTeam                          Codeowner = "@grafana/identity-access-team"
	grafanaObservabilityLogsSquad               Codeowner = "@grafana/observability-logs"
	grafanaObservabilityTracesAndProfilingSquad Codeowner = "@grafana/observability-traces-and-profiling"
	grafanaObservabilityMetricsSquad            Codeowner = "@grafana/observability-metrics"
	grafanaAlertingSquad                        Codeowner = "@grafana/alerting-squad"
	hostedGrafanaTeam                           Codeowner = "@grafana/hosted-grafana-team"
	awsDatasourcesSquad                         Codeowner = "@grafana/aws-datasources"
	appO11ySquad                                Codeowner = "@grafana/app-o11y"
	grafanaPartnerPluginsSquad                  Codeowner = "@grafana/partner-datasources"
	grafanaOperatorExperienceSquad              Codeowner = "@grafana/grafana-operator-experience-squad"
	enterpriseDatasourcesSquad                  Codeowner = "@grafana/enterprise-datasources"
	grafanaSharingSquad                         Codeowner = "@grafana/sharing-squad"
	grafanaDatabasesFrontend                    Codeowner = "@grafana/databases-frontend"
)
