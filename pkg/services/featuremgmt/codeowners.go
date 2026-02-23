package featuremgmt

// codeowner string that references a GH team or user
// the value must match the format used in the CODEOWNERS file
type codeowner string

const (
	grafanaAppPlatformSquad                     codeowner = "@grafana/grafana-app-platform-squad"
	grafanaDashboardsSquad                      codeowner = "@grafana/dashboards-squad"
	grafanaDatavizSquad                         codeowner = "@grafana/dataviz-squad"
	grafanaSessionReplaySquad                   codeowner = "@grafana/session-replay"
	grafanaDataProSquad                         codeowner = "@grafana/datapro"
	grafanaFrontendPlatformSquad                codeowner = "@grafana/grafana-frontend-platform"
	grafanaFrontendNavigation                   codeowner = "@grafana/grafana-frontend-navigation"
	grafanaBackendServicesSquad                 codeowner = "@grafana/grafana-backend-services-squad"
	grafanaSearchAndStorageSquad                codeowner = "@grafana/search-and-storage"
	grafanaPluginsPlatformSquad                 codeowner = "@grafana/plugins-platform-backend"
	grafanaFrontendOpsWG                        codeowner = "@grafana/frontend-ops"
	identityAccessTeam                          codeowner = "@grafana/identity-access-team"
	grafanaObservabilityLogsSquad               codeowner = "@grafana/observability-logs"
	grafanaObservabilityTracesAndProfilingSquad codeowner = "@grafana/observability-traces-and-profiling"
	grafanaAlertingSquad                        codeowner = "@grafana/alerting-squad"
	awsDatasourcesSquad                         codeowner = "@grafana/aws-datasources"
	appO11ySquad                                codeowner = "@grafana/app-o11y"
	grafanaPartnerPluginsSquad                  codeowner = "@grafana/partner-datasources"
	grafanaOperatorExperienceSquad              codeowner = "@grafana/grafana-operator-experience-squad"
	grafanaSharingSquad                         codeowner = "@grafana/sharing-squad"
	grafanaOSSBigTent                           codeowner = "@grafana/oss-big-tent"
	grafanaDatasourcesCoreServicesSquad         codeowner = "@grafana/grafana-datasources-core-services"
	grafanaBackendGroup                         codeowner = "@grafana/grafana-backend-group"
	grafanaPathfinderSquad                      codeowner = "@grafana/pathfinder"
	grafanaDataSources                          codeowner = "@grafana/data-sources"
)
