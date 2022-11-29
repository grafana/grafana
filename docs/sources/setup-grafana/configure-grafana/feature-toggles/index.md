---
aliases:
  - /docs/grafana/latest/setup-grafana/configure-grafana/feature-toggles/
description: Learn about toggles for experimental and beta features, which you can enable or disable.
title: Configure feature toggles
weight: 150
---

# Configure feature toggles

Feature toggles, also known as feature flags, are used for experimental or beta features in Grafana. Although we do not recommend that you use these features in production, you can turn on feature toggles to try out new functionality in development or test environments.

This page contains a list of available feature toggles. To learn how to turn on feature toggles, refer to our [Configure Grafana documentation]({{< relref "../_index.md/#feature_toggles" >}}). Feature toogles are also available to Grafana Cloud Advanced customers - if you use Grafana Cloud Advanced, you can open a support ticket specifying the feature toggles and stack you would like them enabled

## Available feature toggles

| Feature toggle name              | Description                                                                                                                                                 | Release stage | Enabled by default |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | ------------------ |
| alertingBigTransactions          | Use big transactions for alerting database writes                                                                                                           | alpha         |                    |
| promQueryBuilder                 | Show prometheus query builder                                                                                                                               | stable        | Yes                |
| trimDefaults                     | Use cue schema to remove values that will be applied automatically                                                                                          | beta          |                    |
| disableEnvelopeEncryption        | Disable envelope encryption (emergency only)                                                                                                                | stable        |                    |
| database_metrics                 | Add prometheus metrics for database tables                                                                                                                  | stable        |                    |
| dashboardPreviews                | Create and show thumbnails for dashboard search results                                                                                                     | alpha         |                    |
| live-config                      | Save grafana live configuration in SQL tables                                                                                                               | alpha         |                    |
| live-pipeline                    | enable a generic live processing pipeline                                                                                                                   | alpha         |                    |
| live-service-web-worker          | This will use a webworker thread to processes events rather than the main thread                                                                            | alpha         |                    |
| queryOverLive                    | Use grafana live websocket to execute backend queries                                                                                                       | alpha         |                    |
| panelTitleSearch                 | Search for dashboards using panel title                                                                                                                     | alpha         |                    |
| tempoApmTable                    | Show APM table                                                                                                                                              | alpha         |                    |
| prometheusAzureOverrideAudience  | Experimental. Allow override default AAD audience for Azure Prometheus endpoint                                                                             | beta          |                    |
| influxdbBackendMigration         | Query InfluxDB InfluxQL without the proxy                                                                                                                   | alpha         |                    |
| publicDashboards                 | enables public access to dashboards                                                                                                                         | alpha         |                    |
| lokiLive                         | support websocket streaming for loki (early prototype)                                                                                                      | alpha         |                    |
| lokiDataframeApi                 | use experimental loki api for websocket streaming (early prototype)                                                                                         | alpha         |                    |
| lokiMonacoEditor                 | Access to Monaco query editor for Loki                                                                                                                      | stable        | Yes                |
| swaggerUi                        | Serves swagger UI                                                                                                                                           | beta          |                    |
| featureHighlights                | Highlight Enterprise features                                                                                                                               | stable        |                    |
| dashboardComments                | Enable dashboard-wide comments                                                                                                                              | alpha         |                    |
| annotationComments               | Enable annotation comments                                                                                                                                  | alpha         |                    |
| migrationLocking                 | Lock database during migrations                                                                                                                             | beta          |                    |
| storage                          | Configurable storage for dashboards, datasources, and resources                                                                                             | alpha         |                    |
| exploreMixedDatasource           | Enable mixed datasource in Explore                                                                                                                          | alpha         |                    |
| tracing                          | Adds trace ID to error notifications                                                                                                                        | alpha         |                    |
| commandPalette                   | Enable command palette                                                                                                                                      | stable        | Yes                |
| correlations                     | Correlations page                                                                                                                                           | alpha         |                    |
| cloudWatchDynamicLabels          | Use dynamic labels instead of alias patterns in CloudWatch datasource                                                                                       | stable        | Yes                |
| datasourceQueryMultiStatus       | Introduce HTTP 207 Multi Status for api/ds/query                                                                                                            | alpha         |                    |
| traceToMetrics                   | Enable trace to metrics links                                                                                                                               | alpha         |                    |
| prometheusBufferedClient         | Enable buffered (old) client for Prometheus datasource as default instead of streaming JSON parser client (new)                                             | stable        |                    |
| newDBLibrary                     | Use jmoiron/sqlx rather than xorm for a few backend services                                                                                                | beta          |                    |
| validateDashboardsOnSave         | Validate dashboard JSON POSTed to api/dashboards/db                                                                                                         | alpha         |                    |
| autoMigrateGraphPanels           | Replace the angular graph panel with timeseries                                                                                                             | beta          |                    |
| prometheusWideSeries             | Enable wide series responses in the Prometheus datasource                                                                                                   | alpha         |                    |
| canvasPanelNesting               | Allow elements nesting                                                                                                                                      | alpha         |                    |
| scenes                           | Experimental framework to build interactive dashboards                                                                                                      | alpha         |                    |
| disableSecretsCompatibility      | Disable duplicated secret storage in legacy tables                                                                                                          | alpha         |                    |
| logRequestsInstrumentedAsUnknown | Logs the path for requests that are instrumented as unknown                                                                                                 | unknown       |                    |
| dataConnectionsConsole           | Enables a new top-level page called Connections. This page is an experiment for better grouping of installing / configuring data sources and other plugins. | alpha         |                    |
| internationalization             | Enables internationalization                                                                                                                                | stable        |                    |
| topnav                           | New top nav and page layouts                                                                                                                                | alpha         |                    |
| traceqlEditor                    | Show the TraceQL editor in the explore page                                                                                                                 | alpha         |                    |
| flameGraph                       | Show the flame graph                                                                                                                                        | alpha         |                    |
| cloudWatchCrossAccountQuerying   | Use cross-account querying in CloudWatch datasource                                                                                                         | alpha         |                    |
| redshiftAsyncQueryDataSupport    | Enable async query data support for Redshift                                                                                                                | alpha         |                    |
| athenaAsyncQueryDataSupport      | Enable async query data support for Athena                                                                                                                  | alpha         |                    |
| increaseInMemDatabaseQueryCache  | Enable more in memory caching for database queries                                                                                                          | unknown       |                    |
| interFont                        | Switch to inter font                                                                                                                                        | unknown       |                    |
| newPanelChromeUI                 | Show updated look and feel of grafana-ui PanelChrome: panel header, icons, and menu                                                                         | alpha         |                    |
| showDashboardValidationWarnings  | Show warnings when Dashboards do not validate against the schema                                                                                            | unknown       |                    |
| mysqlAnsiQuotes                  | Use double quote to escape keyword in Mysql query                                                                                                           | alpha         |                    |
| datasourceLogger                 | Logs all datasource requests                                                                                                                                | unknown       |                    |
| accessTokenExpirationCheck       | Enable OAuth access_token expiration check and token refresh using the refresh_token                                                                        | stable        |                    |
| elasticsearchBackendMigration    | Use Elasticsearch as backend data source                                                                                                                    | alpha         |                    |
| authnService                     | Use new auth service to perform authentication                                                                                                              | alpha         |                    |

## Development feature toggles

The following toggles require explicitly setting Grafana's [app mode]({{< relref "../_index.md/#app_mode" >}}) to 'development' before you can enable this feature toggle. These features tend to be especially experimental.

| Feature toggle name                  | Description                                               |
| ------------------------------------ | --------------------------------------------------------- |
| dashboardPreviewsAdmin               | Manage the dashboard previews crawler process from the UI |
| showFeatureFlagsInUI                 | Show feature flags in the settings UI                     |
| dashboardsFromStorage                | Load dashboards from the generic storage interface        |
| export                               | Export grafana instance (to git, etc)                     |
| azureMonitorResourcePickerForMetrics | New UI for Azure Monitor Metrics Query                    |
| grpcServer                           | Run GRPC server                                           |
| objectStore                          | SQL based object store                                    |
| queryLibrary                         | Reusable query library                                    |
| accessControlOnCall                  | Access control primitives for OnCall                      |
| nestedFolders                        | Enable folder nesting                                     |
