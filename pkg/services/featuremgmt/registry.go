// To change feature toggles, edit:
//  pkg/services/featuremgmt/registry.go
// Then run tests in:
//  pkg/services/featuremgmt/toggles_gen_test.go
// twice to generate and validate the feature toggle files

package featuremgmt

import (
	"sort"
	"strings"

	"github.com/grafana/grafana/pkg/services/featuremgmt/registry"
)

var (
	toggles = sortByName(append(legacyList, registry.MultitenancySquadToggles...))

	// Do not add new toggles to the legacy list.
	// Instead, add it in your squad's file, i.e. pkg/services/featuremgmt/registry/*_squad.go.
	//
	// If your squad does not yet have a separate feature toggle file -
	// create the file, and append the new list to the `toggles` variable defined above
	legacyList = []registry.FeatureToggle{
		{
			Name:        "alertingBigTransactions",
			Description: "Use big transactions for alerting database writes",
			State:       registry.FeatureStateAlpha,
		},
		{
			Name:        "trimDefaults",
			Description: "Use cue schema to remove values that will be applied automatically",
			State:       registry.FeatureStateBeta,
		},
		{
			Name:        "disableEnvelopeEncryption",
			Description: "Disable envelope encryption (emergency only)",
			State:       registry.FeatureStateStable,
		},
		{
			Name:        "database_metrics",
			Description: "Add Prometheus metrics for database tables",
			State:       registry.FeatureStateStable,
		},
		{
			Name:        "prometheusAzureOverrideAudience",
			Description: "Experimental. Allow override default AAD audience for Azure Prometheus endpoint",
			State:       registry.FeatureStateBeta,
		},
		{
			Name:        "publicDashboards",
			Description: "Enables public access to dashboards",
			State:       registry.FeatureStateAlpha,
		},
		{
			Name:            "publicDashboardsEmailSharing",
			Description:     "Allows public dashboard sharing to be restricted to only allowed emails",
			State:           registry.FeatureStateAlpha,
			RequiresLicense: true,
			RequiresDevMode: true,
		},
		{
			Name:        "lokiDataframeApi",
			Description: "Use experimental loki api for WebSocket streaming (early prototype)",
			State:       registry.FeatureStateAlpha,
		},
		{
			Name:        "featureHighlights",
			Description: "Highlight Grafana Enterprise features",
			State:       registry.FeatureStateStable,
		},
		{
			Name:        "migrationLocking",
			Description: "Lock database during migrations",
			State:       registry.FeatureStateBeta,
		},
		{
			Name:         "exploreMixedDatasource",
			Description:  "Enable mixed datasource in Explore",
			State:        registry.FeatureStateAlpha,
			FrontendOnly: true,
		},
		{
			Name:         "tracing",
			Description:  "Adds trace ID to error notifications",
			State:        registry.FeatureStateAlpha,
			FrontendOnly: true,
		},
		{
			Name:         "newTraceView",
			Description:  "Shows the new trace view design",
			State:        registry.FeatureStateAlpha,
			FrontendOnly: true,
		},
		{
			Name:        "correlations",
			Description: "Correlations page",
			State:       registry.FeatureStateAlpha,
		},
		{
			Name:        "cloudWatchDynamicLabels",
			Description: "Use dynamic labels instead of alias patterns in CloudWatch datasource",
			State:       registry.FeatureStateStable,
			Expression:  "true", // enabled by default
		},
		{
			Name:        "datasourceQueryMultiStatus",
			Description: "Introduce HTTP 207 Multi Status for api/ds/query",
			State:       registry.FeatureStateAlpha,
		},
		{
			Name:         "traceToMetrics",
			Description:  "Enable trace to metrics links",
			State:        registry.FeatureStateAlpha,
			FrontendOnly: true,
		},
		{
			Name:        "newDBLibrary",
			Description: "Use jmoiron/sqlx rather than xorm for a few backend services",
			State:       registry.FeatureStateBeta,
		},
		{
			Name:            "validateDashboardsOnSave",
			Description:     "Validate dashboard JSON POSTed to api/dashboards/db",
			State:           registry.FeatureStateBeta,
			RequiresRestart: true,
		},
		{
			Name:         "autoMigrateGraphPanels",
			Description:  "Replace the angular graph panel with timeseries",
			State:        registry.FeatureStateBeta,
			FrontendOnly: true,
		},
		{
			Name:        "prometheusWideSeries",
			Description: "Enable wide series responses in the Prometheus datasource",
			State:       registry.FeatureStateAlpha,
		},
		{
			Name:         "canvasPanelNesting",
			Description:  "Allow elements nesting",
			State:        registry.FeatureStateAlpha,
			FrontendOnly: true,
		},
		{
			Name:         "scenes",
			Description:  "Experimental framework to build interactive dashboards",
			State:        registry.FeatureStateAlpha,
			FrontendOnly: true,
		},
		{
			Name:            "disableSecretsCompatibility",
			Description:     "Disable duplicated secret storage in legacy tables",
			State:           registry.FeatureStateAlpha,
			RequiresRestart: true,
		},
		{
			Name:        "logRequestsInstrumentedAsUnknown",
			Description: "Logs the path for requests that are instrumented as unknown",
			State:       registry.FeatureStateAlpha,
		},
		{
			Name:        "dataConnectionsConsole",
			Description: "Enables a new top-level page called Connections. This page is an experiment that provides a better experience when you install and configure data sources and other plugins.",
			State:       registry.FeatureStateAlpha,
		},
		{
			Name:        "internationalization",
			Description: "Enables internationalization",
			State:       registry.FeatureStateStable,
			Expression:  "true", // enabled by default
		},
		{
			Name:        "topnav",
			Description: "Displays new top nav and page layouts",
			State:       registry.FeatureStateBeta,
		},
		{
			Name:        "cloudWatchCrossAccountQuerying",
			Description: "Enables cross-account querying in CloudWatch datasources",
			State:       registry.FeatureStateStable,
			Expression:  "true", //enabled by default
		},
		{
			Name:         "redshiftAsyncQueryDataSupport",
			Description:  "Enable async query data support for Redshift",
			State:        registry.FeatureStateAlpha,
			FrontendOnly: true,
		},
		{
			Name:         "athenaAsyncQueryDataSupport",
			Description:  "Enable async query data support for Athena",
			State:        registry.FeatureStateAlpha,
			FrontendOnly: true,
		},
		{
			Name:         "newPanelChromeUI",
			Description:  "Show updated look and feel of grafana-ui PanelChrome: panel header, icons, and menu",
			State:        registry.FeatureStateAlpha,
			FrontendOnly: true,
		},
		{
			Name:        "showDashboardValidationWarnings",
			Description: "Show warnings when dashboards do not validate against the schema",
			State:       registry.FeatureStateAlpha,
		},
		{
			Name:        "mysqlAnsiQuotes",
			Description: "Use double quotes to escape keyword in a MySQL query",
			State:       registry.FeatureStateAlpha,
		},
		{
			Name:        "accessControlOnCall",
			Description: "Access control primitives for OnCall",
			State:       registry.FeatureStateBeta,
		},
		{
			Name:            "nestedFolders",
			Description:     "Enable folder nesting",
			State:           registry.FeatureStateAlpha,
			RequiresDevMode: true,
		},
		{
			Name:        "accessTokenExpirationCheck",
			Description: "Enable OAuth access_token expiration check and token refresh using the refresh_token",
			State:       registry.FeatureStateStable,
		},
		{
			Name:        "elasticsearchBackendMigration",
			Description: "Use Elasticsearch as backend data source",
			State:       registry.FeatureStateAlpha,
		},
		{
			Name:        "datasourceOnboarding",
			Description: "Enable data source onboarding page",
			State:       registry.FeatureStateAlpha,
		},
		{
			Name:        "secureSocksDatasourceProxy",
			Description: "Enable secure socks tunneling for supported core datasources",
			State:       registry.FeatureStateAlpha,
		},
		{
			Name:        "authnService",
			Description: "Use new auth service to perform authentication",
			State:       registry.FeatureStateAlpha,
		},
		{
			Name:        "disablePrometheusExemplarSampling",
			Description: "Disable Prometheus examplar sampling",
			State:       registry.FeatureStateStable,
		},
		{
			Name:        "alertingBacktesting",
			Description: "Rule backtesting API for alerting",
			State:       registry.FeatureStateAlpha,
		},
		{
			Name:         "editPanelCSVDragAndDrop",
			Description:  "Enables drag and drop for CSV and Excel files",
			FrontendOnly: true,
			State:        registry.FeatureStateAlpha,
		},
		{
			Name:            "alertingNoNormalState",
			Description:     "Stop maintaining state of alerts that are not firing",
			State:           registry.FeatureStateBeta,
			RequiresRestart: false,
		},
		{

			Name:         "logsSampleInExplore",
			Description:  "Enables access to the logs sample feature in Explore",
			State:        registry.FeatureStateStable,
			Expression:   "true", //turned on by default
			FrontendOnly: true,
		},
		{
			Name:         "logsContextDatasourceUi",
			Description:  "Allow datasource to provide custom UI for context view",
			State:        registry.FeatureStateAlpha,
			FrontendOnly: true,
		},
		{
			Name:         "lokiQuerySplitting",
			Description:  "Split large interval queries into subqueries with smaller time intervals",
			State:        registry.FeatureStateAlpha,
			FrontendOnly: true,
		},
		{
			Name:        "individualCookiePreferences",
			Description: "Support overriding cookie preferences per user",
			State:       registry.FeatureStateAlpha,
		},
		{
			Name:         "drawerDataSourcePicker",
			Description:  "Changes the user experience for data source selection to a drawer.",
			State:        registry.FeatureStateAlpha,
			FrontendOnly: true,
		},
	}
)

func sortByName(toggles []registry.FeatureToggle) []registry.FeatureToggle {
	sort.Slice(toggles, func(i, j int) bool {
		return strings.Compare(toggles[i].Name, toggles[j].Name) < 0
	})
	return toggles
}
