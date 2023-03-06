package featuremgmt

// codeowner string that references a GH team or user
// the value must match the format used in the CODEOWNERS file
type codeowner string

const (
	grafanaMultitenancySquad    codeowner = "@grafana/multitenancy-squad"
	grafanaDashboardsSquad      codeowner = "@grafana/dashboards-squad"
	grafanaBiSquad              codeowner = "@grafana/grafana-bi-squad"
	grafanaDatavizSquad         codeowner = "@grafana/dataviz-squad"
	grafanaUserEssentialsSquad  codeowner = "@grafana/user-essentials"
	grafanaBackendPlatformSquad codeowner = "@grafana/backend-platform"
	grafanaPluginsPlatformSquad codeowner = "@grafana/plugins-platform-backend"
)
