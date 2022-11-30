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

## Stable feature toggles

Some stable features are enabled by default -- they can be disabled by setting the flag to false in the configuration.

| FEATURE TOGGLE NAME          | DESCRIPTION                                                                                                     | ENABLE BY DEFAULT |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------- |
| `promQueryBuilder`           | Show prometheus query builder                                                                                   | Yes               |
| `disableEnvelopeEncryption`  | Disable envelope encryption (emergency only)                                                                    |                   |
| `database_metrics`           | Add prometheus metrics for database tables                                                                      |                   |
| `lokiMonacoEditor`           | Access to Monaco query editor for Loki                                                                          | Yes               |
| `featureHighlights`          | Highlight Enterprise features                                                                                   |                   |
| `commandPalette`             | Enable command palette                                                                                          | Yes               |
| `cloudWatchDynamicLabels`    | Use dynamic labels instead of alias patterns in CloudWatch datasource                                           | Yes               |
| `prometheusBufferedClient`   | Enable buffered (old) client for Prometheus datasource as default instead of streaming JSON parser client (new) |                   |
| `internationalization`       | Enables internationalization                                                                                    |                   |
| `accessTokenExpirationCheck` | Enable OAuth access_token expiration check and token refresh using the refresh_token                            |                   |

## Beta feature toggles

| FEATURE TOGGLE NAME               | DESCRIPTION                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------- |
| `trimDefaults`                    | Use cue schema to remove values that will be applied automatically              |
| `panelTitleSearch`                | Search for dashboards using panel title                                         |
| `prometheusAzureOverrideAudience` | Experimental. Allow override default AAD audience for Azure Prometheus endpoint |
| `swaggerUi`                       | Serves swagger UI                                                               |
| `migrationLocking`                | Lock database during migrations                                                 |
| `newDBLibrary`                    | Use jmoiron/sqlx rather than xorm for a few backend services                    |
| `validateDashboardsOnSave`        | Validate dashboard JSON POSTed to api/dashboards/db                             |
| `autoMigrateGraphPanels`          | Replace the angular graph panel with timeseries                                 |
| `interFont`                       | Switch to inter font                                                            |
| `datasourceLogger`                | Logs all datasource requests                                                    |

## Alpha feature toggles

These are features early in their development lifecycle, they are not yet supported in grafana cloud.

| FEATURE TOGGLE NAME                | DESCRIPTION                                                                                                                                                 |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `alertingBigTransactions`          | Use big transactions for alerting database writes                                                                                                           |
| `dashboardPreviews`                | Create and show thumbnails for dashboard search results                                                                                                     |
| `live-config`                      | Save grafana live configuration in SQL tables                                                                                                               |
| `live-pipeline`                    | enable a generic live processing pipeline                                                                                                                   |
| `live-service-web-worker`          | This will use a webworker thread to processes events rather than the main thread                                                                            |
| `queryOverLive`                    | Use grafana live websocket to execute backend queries                                                                                                       |
| `tempoApmTable`                    | Show APM table                                                                                                                                              |
| `influxdbBackendMigration`         | Query InfluxDB InfluxQL without the proxy                                                                                                                   |
| `publicDashboards`                 | enables public access to dashboards                                                                                                                         |
| `lokiLive`                         | support websocket streaming for loki (early prototype)                                                                                                      |
| `lokiDataframeApi`                 | use experimental loki api for websocket streaming (early prototype)                                                                                         |
| `dashboardComments`                | Enable dashboard-wide comments                                                                                                                              |
| `annotationComments`               | Enable annotation comments                                                                                                                                  |
| `storage`                          | Configurable storage for dashboards, datasources, and resources                                                                                             |
| `exploreMixedDatasource`           | Enable mixed datasource in Explore                                                                                                                          |
| `tracing`                          | Adds trace ID to error notifications                                                                                                                        |
| `correlations`                     | Correlations page                                                                                                                                           |
| `datasourceQueryMultiStatus`       | Introduce HTTP 207 Multi Status for api/ds/query                                                                                                            |
| `traceToMetrics`                   | Enable trace to metrics links                                                                                                                               |
| `prometheusWideSeries`             | Enable wide series responses in the Prometheus datasource                                                                                                   |
| `canvasPanelNesting`               | Allow elements nesting                                                                                                                                      |
| `scenes`                           | Experimental framework to build interactive dashboards                                                                                                      |
| `disableSecretsCompatibility`      | Disable duplicated secret storage in legacy tables                                                                                                          |
| `logRequestsInstrumentedAsUnknown` | Logs the path for requests that are instrumented as unknown                                                                                                 |
| `dataConnectionsConsole`           | Enables a new top-level page called Connections. This page is an experiment for better grouping of installing / configuring data sources and other plugins. |
| `topnav`                           | New top nav and page layouts                                                                                                                                |
| `traceqlEditor`                    | Show the TraceQL editor in the explore page                                                                                                                 |
| `flameGraph`                       | Show the flame graph                                                                                                                                        |
| `cloudWatchCrossAccountQuerying`   | Use cross-account querying in CloudWatch datasource                                                                                                         |
| `redshiftAsyncQueryDataSupport`    | Enable async query data support for Redshift                                                                                                                |
| `athenaAsyncQueryDataSupport`      | Enable async query data support for Athena                                                                                                                  |
| `increaseInMemDatabaseQueryCache`  | Enable more in memory caching for database queries                                                                                                          |
| `newPanelChromeUI`                 | Show updated look and feel of grafana-ui PanelChrome: panel header, icons, and menu                                                                         |
| `showDashboardValidationWarnings`  | Show warnings when Dashboards do not validate against the schema                                                                                            |
| `mysqlAnsiQuotes`                  | Use double quote to escape keyword in Mysql query                                                                                                           |
| `elasticsearchBackendMigration`    | Use Elasticsearch as backend data source                                                                                                                    |
| `authnService`                     | Use new auth service to perform authentication                                                                                                              |

## Development feature toggles

The following toggles require explicitly setting Grafana's [app mode]({{< relref "../_index.md/#app_mode" >}}) to 'development' before you can enable this feature toggle. These features tend to be especially experimental.

| FEATURE TOGGLE NAME                    | DESCRIPTION                                               |
| -------------------------------------- | --------------------------------------------------------- |
| `dashboardPreviewsAdmin`               | Manage the dashboard previews crawler process from the UI |
| `showFeatureFlagsInUI`                 | Show feature flags in the settings UI                     |
| `dashboardsFromStorage`                | Load dashboards from the generic storage interface        |
| `export`                               | Export grafana instance (to git, etc)                     |
| `azureMonitorResourcePickerForMetrics` | New UI for Azure Monitor Metrics Query                    |
| `grpcServer`                           | Run GRPC server                                           |
| `objectStore`                          | SQL based object store                                    |
| `queryLibrary`                         | Reusable query library                                    |
| `accessControlOnCall`                  | Access control primitives for OnCall                      |
| `nestedFolders`                        | Enable folder nesting                                     |
