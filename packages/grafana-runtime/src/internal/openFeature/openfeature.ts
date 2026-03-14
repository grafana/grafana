'use client';

import {
  type ReactFlagEvaluationOptions,
  type ReactFlagEvaluationNoSuspenseOptions,
  type FlagQuery,
  useFlag,
  useSuspenseFlag,
} from '@openfeature/react-sdk';

// Flag key constants for programmatic access
export const FlagKeys = {
  /** Flag key for Enable AI powered features for dashboards to auto-summary changes when saving */
  AI_GENERATED_DASHBOARD_CHANGES: 'aiGeneratedDashboardChanges',
  /** Flag key for Enable configuration of alert enrichments in Grafana Cloud. */
  ALERT_ENRICHMENT: 'alertEnrichment',
  /** Flag key for Enable conditional alert enrichment steps. */
  ALERT_ENRICHMENT_CONDITIONAL: 'alertEnrichmentConditional',
  /** Flag key for Allow multiple steps per enrichment. */
  ALERT_ENRICHMENT_MULTI_STEP: 'alertEnrichmentMultiStep',
  /** Flag key for Enables the alert rule restore feature */
  ALERT_RULE_RESTORE: 'alertRuleRestore',
  /** Flag key for Use FiredAt for StartsAt when sending alerts to Alertmaanger */
  ALERT_RULE_USE_FIRED_AT_FOR_STARTS_AT: 'alertRuleUseFiredAtForStartsAt',
  /** Flag key for Enable AI-analyze central state history. */
  ALERTING_AI_ANALYZE_CENTRAL_STATE_HISTORY: 'alertingAIAnalyzeCentralStateHistory',
  /** Flag key for Enable AI-generated feedback from the Grafana UI. */
  ALERTING_AI_FEEDBACK: 'alertingAIFeedback',
  /** Flag key for Enable AI-generated alert rules. */
  ALERTING_AI_GEN_ALERT_RULES: 'alertingAIGenAlertRules',
  /** Flag key for Enable AI-generated alerting templates. */
  ALERTING_AI_GEN_TEMPLATES: 'alertingAIGenTemplates',
  /** Flag key for Enable AI-improve alert rules labels and annotations. */
  ALERTING_AI_IMPROVE_ALERT_RULES: 'alertingAIImproveAlertRules',
  /** Flag key for Shows a promotional banner for the Alerts Activity feature on the Rule List page */
  ALERTING_ALERTS_ACTIVITY_BANNER: 'alertingAlertsActivityBanner',
  /** Flag key for Rule backtesting API for alerting */
  ALERTING_BACKTESTING: 'alertingBacktesting',
  /** Flag key for Enables the alerting bulk actions in the UI */
  ALERTING_BULK_ACTIONS_IN_UI: 'alertingBulkActionsInUI',
  /** Flag key for Enables the new central alert history. */
  ALERTING_CENTRAL_ALERT_HISTORY: 'alertingCentralAlertHistory',
  /** Flag key for Disables the DMA feature in the UI */
  ALERTING_DISABLE_DM_AIN_UI: 'alertingDisableDMAinUI',
  /** Flag key for Disables the ability to send alerts to an external Alertmanager datasource. */
  ALERTING_DISABLE_SEND_ALERTS_EXTERNAL: 'alertingDisableSendAlertsExternal',
  /** Flag key for Enable Assistant Investigations enrichment type. */
  ALERTING_ENRICHMENT_ASSISTANT_INVESTIGATIONS: 'alertingEnrichmentAssistantInvestigations',
  /** Flag key for Enable enrichment per rule in the alerting UI. */
  ALERTING_ENRICHMENT_PER_RULE: 'alertingEnrichmentPerRule',
  /** Flag key for Enable the new alerting search experience */
  ALERTING_FILTER_V_2: 'alertingFilterV2',
  /** Flag key for Makes NoData and Error alerts fire immediately, without 'pending' stage */
  ALERTING_IGNORE_PENDING_FOR_NO_DATA_AND_ERROR: 'alertingIgnorePendingForNoDataAndError',
  /** Flag key for Enables the API to import Alertmanager configuration */
  ALERTING_IMPORT_ALERTMANAGER_API: 'alertingImportAlertmanagerAPI',
  /** Flag key for Enables the UI to see imported Alertmanager configuration */
  ALERTING_IMPORT_ALERTMANAGER_UI: 'alertingImportAlertmanagerUI',
  /** Flag key for Enables a UI feature for importing rules from a Prometheus file to Grafana-managed rules */
  ALERTING_IMPORT_YAMLUI: 'alertingImportYAMLUI',
  /** Flag key for Enables the new Jira integration for contact points in cloud alert managers. */
  ALERTING_JIRA_INTEGRATION: 'alertingJiraIntegration',
  /** Flag key for Enables the new alert list view design */
  ALERTING_LIST_VIEW_V_2: 'alertingListViewV2',
  /** Flag key for Enables the alerting list view v2 preview toggle */
  ALERTING_LIST_VIEW_V_2_PREVIEW_TOGGLE: 'alertingListViewV2PreviewToggle',
  /** Flag key for Enables the alerting migration UI, to migrate data source-managed rules to Grafana-managed rules */
  ALERTING_MIGRATION_UI: 'alertingMigrationUI',
  /** Flag key for Enables the migration wizard UI to migrate alert rules and notification resources from external sources to Grafana Alerting */
  ALERTING_MIGRATION_WIZARD_UI: 'alertingMigrationWizardUI',
  /** Flag key for Enables the ability to create multiple alerting policies */
  ALERTING_MULTIPLE_POLICIES: 'alertingMultiplePolicies',
  /** Flag key for Enables the new Alerting navigation structure with improved menu grouping */
  ALERTING_NAVIGATION_V_2: 'alertingNavigationV2',
  /** Flag key for Enables the notification history feature */
  ALERTING_NOTIFICATION_HISTORY: 'alertingNotificationHistory',
  /** Flag key for Enables the notification history global menu item viewer */
  ALERTING_NOTIFICATION_HISTORY_GLOBAL: 'alertingNotificationHistoryGlobal',
  /** Flag key for Enables the notification history tab in the rule viewer */
  ALERTING_NOTIFICATION_HISTORY_RULE_VIEWER: 'alertingNotificationHistoryRuleViewer',
  /** Flag key for Enables simplified step mode in the notifications section */
  ALERTING_NOTIFICATIONS_STEP_MODE: 'alertingNotificationsStepMode',
  /** Flag key for Uses Prometheus rules as the primary source of truth for ruler-enabled data sources */
  ALERTING_PROMETHEUS_RULES_PRIMARY: 'alertingPrometheusRulesPrimary',
  /** Flag key for Enables a feature to avoid issues with concurrent writes to the alerting provenance table in MySQL */
  ALERTING_PROVENANCE_LOCK_WRITES: 'alertingProvenanceLockWrites',
  /** Flag key for Enables step mode for alerting queries and expressions */
  ALERTING_QUERY_AND_EXPRESSIONS_STEP_MODE: 'alertingQueryAndExpressionsStepMode',
  /** Flag key for Optimizes eligible queries in order to reduce load on datasources */
  ALERTING_QUERY_OPTIMIZATION: 'alertingQueryOptimization',
  /** Flag key for Enables UI functionality to permanently delete alert rules */
  ALERTING_RULE_PERMANENTLY_DELETE: 'alertingRulePermanentlyDelete',
  /** Flag key for Enables the UI functionality to recover and view deleted alert rules */
  ALERTING_RULE_RECOVER_DELETED: 'alertingRuleRecoverDeleted',
  /** Flag key for Enables the alert rule version history restore feature */
  ALERTING_RULE_VERSION_HISTORY_RESTORE: 'alertingRuleVersionHistoryRestore',
  /** Flag key for Enables the compressed protobuf-based alert state storage. Default is enabled. */
  ALERTING_SAVE_STATE_COMPRESSED: 'alertingSaveStateCompressed',
  /** Flag key for Writes the state periodically to the database, asynchronous to rule evaluation */
  ALERTING_SAVE_STATE_PERIODIC: 'alertingSaveStatePeriodic',
  /** Flag key for Enables saved searches for alert rules list */
  ALERTING_SAVED_SEARCHES: 'alertingSavedSearches',
  /** Flag key for Use synchronized dispatch timer to minimize duplicate notifications across alertmanager HA pods */
  ALERTING_SYNC_DISPATCH_TIMER: 'alertingSyncDispatchTimer',
  /** Flag key for Use the new k8s API for fetching integration type schemas */
  ALERTING_SYNC_NOTIFIERS_API_MIGRATION: 'alertingSyncNotifiersApiMigration',
  /** Flag key for Enables the alerting triage feature */
  ALERTING_TRIAGE: 'alertingTriage',
  /** Flag key for Enables saved searches for the Alert Activity page */
  ALERTING_TRIAGE_SAVED_SEARCHES: 'alertingTriageSavedSearches',
  /** Flag key for Enables removing the reducer from the alerting UI when creating a new alert rule and using instant query */
  ALERTING_UI_OPTIMIZE_REDUCER: 'alertingUIOptimizeReducer',
  /** Flag key for Enables the UI to use certain backend-side filters */
  ALERTING_UI_USE_BACKEND_FILTERS: 'alertingUIUseBackendFilters',
  /** Flag key for Enables the UI to use rules backend-side filters 100% compatible with the frontend filters */
  ALERTING_UI_USE_FULLY_COMPAT_BACKEND_FILTERS: 'alertingUIUseFullyCompatBackendFilters',
  /** Flag key for this flag */
  ALERTING_USE_NEW_SIMPLIFIED_ROUTING_HASH_ALGORITHM: 'alertingUseNewSimplifiedRoutingHashAlgorithm',
  /** Flag key for Enable Grafana to have a remote Alertmanager instance as the primary Alertmanager. */
  ALERTMANAGER_REMOTE_PRIMARY: 'alertmanagerRemotePrimary',
  /** Flag key for Enable Grafana to sync configuration and state with a remote Alertmanager. */
  ALERTMANAGER_REMOTE_SECONDARY: 'alertmanagerRemoteSecondary',
  /** Flag key for Starts Grafana in remote secondary mode pulling the latest state from the remote Alertmanager to avoid duplicate notifications. */
  ALERTMANAGER_REMOTE_SECONDARY_WITH_REMOTE_STATE: 'alertmanagerRemoteSecondaryWithRemoteState',
  /** Flag key for Change the way annotation permissions work by scoping them to folders and dashboards. */
  ANNOTATION_PERMISSION_UPDATE: 'annotationPermissionUpdate',
  /** Flag key for Enables the gRPC client to authenticate with the App Platform by using ID & access tokens */
  APP_PLATFORM_GRPC_CLIENT_AUTH: 'appPlatformGrpcClientAuth',
  /** Flag key for Enables SRI checks for Grafana JavaScript assets */
  ASSET_SRI_CHECKS: 'assetSriChecks',
  /** Flag key for Enable audit logging with Kubernetes under app platform */
  AUDIT_LOGGING_APP_PLATFORM: 'auditLoggingAppPlatform',
  /** Flag key for Enables the gRPC server for authorization */
  AUTH_ZGRPC_SERVER: 'authZGRPCServer',
  /** Flag key for Enable caching for async queries for Redshift and Athena. Requires that the datasource has caching and async query support enabled */
  AWS_ASYNC_QUERY_CACHING: 'awsAsyncQueryCaching',
  /** Flag key for Enables http proxy settings for aws datasources */
  AWS_DATASOURCES_HTTP_PROXY: 'awsDatasourcesHttpProxy',
  /** Flag key for Support temporary security credentials in AWS plugins for Grafana Cloud customers */
  AWS_DATASOURCES_TEMP_CREDENTIALS: 'awsDatasourcesTempCredentials',
  /** Flag key for Disables the log limit restriction for Azure Monitor when true. The limit is enabled by default. */
  AZURE_MONITOR_DISABLE_LOG_LIMIT: 'azureMonitorDisableLogLimit',
  /** Flag key for Enables user auth for Azure Monitor datasource only */
  AZURE_MONITOR_ENABLE_USER_AUTH: 'azureMonitorEnableUserAuth',
  /** Flag key for Enables the logs builder mode for the Azure Monitor data source */
  AZURE_MONITOR_LOGS_BUILDER_EDITOR: 'azureMonitorLogsBuilderEditor',
  /** Flag key for Allows configuration of Azure Monitor as a data source that can provide Prometheus exemplars */
  AZURE_MONITOR_PROMETHEUS_EXEMPLARS: 'azureMonitorPrometheusExemplars',
  /** Flag key for Enables the updated Azure Monitor resource picker */
  AZURE_RESOURCE_PICKER_UPDATES: 'azureResourcePickerUpdates',
  /** Flag key for If enabled, the caching backend gradually serializes query responses for the cache, comparing against the configured `[caching]max_value_mb` value as it goes. This can can help prevent Grafana from running out of memory while attempting to cache very large query responses. */
  CACHING_OPTIMIZE_SERIALIZATION_MEMORY_USAGE: 'cachingOptimizeSerializationMemoryUsage',
  /** Flag key for Allow elements nesting */
  CANVAS_PANEL_NESTING: 'canvasPanelNesting',
  /** Flag key for Allow pan and zoom in canvas panel */
  CANVAS_PANEL_PAN_ZOOM: 'canvasPanelPanZoom',
  /** Flag key for Prioritize loading plugins from the CDN before other sources */
  CDN_PLUGINS_LOAD_FIRST: 'cdnPluginsLoadFirst',
  /** Flag key for Enable loading plugins via declarative URLs */
  CDN_PLUGINS_URLS: 'cdnPluginsUrls',
  /** Flag key for Enabled grafana cloud specific RBAC roles */
  CLOUD_RBAC_ROLES: 'cloudRBACRoles',
  /** Flag key for Runs CloudWatch metrics queries as separate batches */
  CLOUD_WATCH_BATCH_QUERIES: 'cloudWatchBatchQueries',
  /** Flag key for Enables cross-account querying in CloudWatch datasources */
  CLOUD_WATCH_CROSS_ACCOUNT_QUERYING: 'cloudWatchCrossAccountQuerying',
  /** Flag key for Updates CloudWatch label parsing to be more accurate */
  CLOUD_WATCH_NEW_LABEL_PARSING: 'cloudWatchNewLabelParsing',
  /** Flag key for Round up end time for metric queries to the next minute to avoid missing data */
  CLOUD_WATCH_ROUND_UP_END_TIME: 'cloudWatchRoundUpEndTime',
  /** Flag key for Enable changing the scheduler base interval via configuration option unified_alerting.scheduler_tick_interval */
  CONFIGURABLE_SCHEDULER_TICK: 'configurableSchedulerTick',
  /** Flag key for Enables browser crash detection reporting to Faro. */
  CRASH_DETECTION: 'crashDetection',
  /** Flag key for Wraps the ad hoc and group by variables in a single wrapper, with all other variables below it */
  DASHBOARD_AD_HOC_AND_GROUP_BY_WRAPPER: 'dashboardAdHocAndGroupByWrapper',
  /** Flag key for Disable schema validation for dashboards/v1 */
  DASHBOARD_DISABLE_SCHEMA_VALIDATION_V_1: 'dashboardDisableSchemaValidationV1',
  /** Flag key for Disable schema validation for dashboards/v2 */
  DASHBOARD_DISABLE_SCHEMA_VALIDATION_V_2: 'dashboardDisableSchemaValidationV2',
  /** Flag key for Enables the dashboard filters overview pane */
  DASHBOARD_FILTERS_OVERVIEW: 'dashboardFiltersOverview',
  /** Flag key for Supports __from and __to macros that always use the dashboard level time range */
  DASHBOARD_LEVEL_TIME_MACROS: 'dashboardLevelTimeMacros',
  /** Flag key for Displays datasource provisioned dashboards in dashboard empty page, only when coming from datasource configuration page */
  DASHBOARD_LIBRARY: 'dashboardLibrary',
  /** Flag key for Enables new dashboard layouts */
  DASHBOARD_NEW_LAYOUTS: 'dashboardNewLayouts',
  /** Flag key for Enables dashboard rendering using scenes for all roles */
  DASHBOARD_SCENE: 'dashboardScene',
  /** Flag key for Log schema validation errors so they can be analyzed later */
  DASHBOARD_SCHEMA_VALIDATION_LOGGING: 'dashboardSchemaValidationLogging',
  /** Flag key for Enables a flow to get started with a new dashboard from a template */
  DASHBOARD_TEMPLATES: 'dashboardTemplates',
  /** Flag key for Enables the Assistant button in the dashboard templates card */
  DASHBOARD_TEMPLATES_ASSISTANT_BUTTON: 'dashboardTemplatesAssistantButton',
  /** Flag key for Enables undo/redo in dynamic dashboards */
  DASHBOARD_UNDO_REDO: 'dashboardUndoRedo',
  /** Flag key for Enables dashboard validator app to run compatibility checks between a dashboard and data source */
  DASHBOARD_VALIDATOR_APP: 'dashboardValidatorApp',
  /** Flag key for Enable AI powered features in dashboards */
  DASHGPT: 'dashgpt',
  /** Flag key for Enable grafana dataplane aggregator */
  DATAPLANE_AGGREGATOR: 'dataplaneAggregator',
  /** Flag key for Expose some datasources as apiservers. */
  DATASOURCE_API_SERVERS: 'datasourceAPIServers',
  /** Flag key for Shows defined connections for a data source in the plugins detail page */
  DATASOURCE_CONNECTIONS_TAB: 'datasourceConnectionsTab',
  /** Flag key for Does not register datasource apis that use the numeric id */
  DATASOURCE_DISABLE_ID_API: 'datasourceDisableIdApi',
  /** Flag key for Show query type endpoints in datasource API servers (currently hardcoded for testdata, expressions, and prometheus) */
  DATASOURCE_QUERY_TYPES: 'datasourceQueryTypes',
  /** Flag key for Handle datasource resource requests to the legacy API routes by querying the new datasource api group endpoints behind the scenes. */
  DATASOURCES_API_SERVER_ENABLE_RESOURCE_ENDPOINT: 'datasourcesApiServerEnableResourceEndpoint',
  /** Flag key for Send Datsource resource requests to K8s /apis/ API routes instead of the legacy /api/datasources/uid/{uid}/resources/{path} routes. */
  DATASOURCES_API_SERVER_ENABLE_RESOURCE_ENDPOINT_FRONTEND: 'datasourcesApiServerEnableResourceEndpointFrontend',
  /** Flag key for Handle datasource CRUD requests to the legacy API routes by querying the new datasource api group endpoints behind the scenes. */
  DATASOURCES_REROUTE_LEGACY_CRUDAP_IS: 'datasourcesRerouteLegacyCRUDAPIs',
  /** Flag key for In server-side expressions, disable the sorting of numeric-kind metrics by their metric name or labels. */
  DISABLE_NUMERIC_METRICS_SORTING_IN_EXPRESSIONS: 'disableNumericMetricsSortingInExpressions',
  /** Flag key for Disables dataplane specific processing in server side expressions. */
  DISABLE_SSE_DATAPLANE: 'disableSSEDataplane',
  /** Flag key for Enables showing recently used drilldowns or recommendations given by the datasource in the AdHocFilters and GroupBy variables */
  DRILLDOWN_RECOMMENDATIONS: 'drilldownRecommendations',
  /** Flag key for Enables cross cluster search in the Elasticsearch data source */
  ELASTICSEARCH_CROSS_CLUSTER_SEARCH: 'elasticsearchCrossClusterSearch',
  /** Flag key for Enables less memory intensive Elasticsearch result parsing */
  ELASTICSEARCH_IMPROVED_PARSING: 'elasticsearchImprovedParsing',
  /** Flag key for Enables the raw DSL query editor in the Elasticsearch data source */
  ELASTICSEARCH_RAW_DSL_QUERY: 'elasticsearchRawDSLQuery',
  /** Flag key for Set this to true to enable all app chrome extensions registered by plugins. */
  ENABLE_APP_CHROME_EXTENSIONS: 'enableAppChromeExtensions',
  /** Flag key for Set this to true to enable all dashboard empty state extensions registered by plugins. */
  ENABLE_DASHBOARD_EMPTY_EXTENSIONS: 'enableDashboardEmptyExtensions',
  /** Flag key for Enables the edit functionality in the datagrid panel */
  ENABLE_DATAGRID_EDITING: 'enableDatagridEditing',
  /** Flag key for Enables the extension admin page regardless of development mode */
  ENABLE_EXTENSIONS_ADMIN_PAGE: 'enableExtensionsAdminPage',
  /** Flag key for Enables SCIM support for user and group management */
  ENABLE_SCIM: 'enableSCIM',
  /** Flag key for Enables the scopes usage in Metrics Explore */
  ENABLE_SCOPES_IN_METRICS_EXPLORE: 'enableScopesInMetricsExplore',
  /** Flag key for Exclude redundant individual dashboard/folder permissions from managed roles at query time */
  EXCLUDE_REDUNDANT_MANAGED_PERMISSIONS: 'excludeRedundantManagedPermissions',
  /** Flag key for A/A test for recently viewed dashboards feature */
  EXPERIMENT_RECENTLY_VIEWED_DASHBOARDS: 'experimentRecentlyViewedDashboards',
  /** Flag key for Used in Logs Drilldown to query by aggregated metrics */
  EXPLORE_LOGS_AGGREGATED_METRICS: 'exploreLogsAggregatedMetrics',
  /** Flag key for Deprecated. Replace with lokiShardSplitting. Used in Logs Drilldown to split queries into multiple queries based on the number of shards */
  EXPLORE_LOGS_SHARD_SPLITTING: 'exploreLogsShardSplitting',
  /** Flag key for Automatic service account and token setup for plugins */
  EXTERNAL_SERVICE_ACCOUNTS: 'externalServiceAccounts',
  /** Flag key for Enable all plugins to supply visualization suggestions (including 3rd party plugins) */
  EXTERNAL_VIZ_SUGGESTIONS: 'externalVizSuggestions',
  /** Flag key for Enable the data source selector within the Frontend Apps section of the Frontend Observability */
  FARO_DATASOURCE_SELECTOR: 'faroDatasourceSelector',
  /** Flag key for Enable Faro session replay for Grafana */
  FARO_SESSION_REPLAY: 'faroSessionReplay',
  /** Flag key for Enable favorite datasources */
  FAVORITE_DATASOURCES: 'favoriteDatasources',
  /** Flag key for Highlight Grafana Enterprise features */
  FEATURE_HIGHLIGHTS: 'featureHighlights',
  /** Flag key for Add compact=true when fetching rules */
  FETCH_RULES_IN_COMPACT_MODE: 'fetchRulesInCompactMode',
  /** Flag key for Use a POST request to list rules by passing down the namespaces user has access to */
  FETCH_RULES_USING_POST: 'fetchRulesUsingPost',
  /** Flag key for Enables use of app platform API for folders */
  FOLDERS_APP_PLATFORM_API: 'foldersAppPlatformAPI',
  /** Flag key for Enables the frontend service to fetch tenant-specific settings overrides from the settings service */
  FRONTEND_SERVICE_USE_SETTINGS_SERVICE: 'frontendServiceUseSettingsService',
  /** Flag key for Whether to use the new SharedPreferences functional component */
  FUNCTIONAL_SHARED_PREFERENCES: 'functionalSharedPreferences',
  /** Flag key for Start an additional https handler and write kubectl options */
  GRAFANA_API_SERVER_ENSURE_KUBECTL_ACCESS: 'grafanaAPIServerEnsureKubectlAccess',
  /** Flag key for Register experimental APIs with the k8s API server, including all datasources */
  GRAFANA_API_SERVER_WITH_EXPERIMENTAL_AP_IS: 'grafanaAPIServerWithExperimentalAPIs',
  /** Flag key for Enables Advisor app */
  GRAFANA_ADVISOR: 'grafanaAdvisor',
  /** Flag key for Enables integration with Grafana Assistant in Profiles Drilldown */
  GRAFANA_ASSISTANT_IN_PROFILES_DRILLDOWN: 'grafanaAssistantInProfilesDrilldown',
  /** Flag key for Enables Grafana-managed recording rules. */
  GRAFANA_MANAGED_RECORDING_RULES: 'grafanaManagedRecordingRules',
  /** Flag key for Enables the temporary themes for GrafanaCon */
  GRAFANACON_THEMES: 'grafanaconThemes',
  /** Flag key for Enables the Graphite data source full backend mode */
  GRAPHITE_BACKEND_MODE: 'graphiteBackendMode',
  /** Flag key for Enable the groupsync extension for managing Group Attribute Sync feature */
  GROUP_ATTRIBUTE_SYNC: 'groupAttributeSync',
  /** Flag key for Enable groupBy variable support in scenes dashboards */
  GROUP_BY_VARIABLE: 'groupByVariable',
  /** Flag key for Run the GRPC server */
  GRPC_SERVER: 'grpcServer',
  /** Flag key for Enable Y-axis scale configuration options for pre-bucketed heatmap data (heatmap-rows) */
  HEATMAP_ROWS_AXIS_OPTIONS: 'heatmapRowsAxisOptions',
  /** Flag key for Enables improved support for OAuth external sessions. After enabling this feature, users might need to re-authenticate themselves. */
  IMPROVED_EXTERNAL_SESSION_HANDLING: 'improvedExternalSessionHandling',
  /** Flag key for Enables improved support for SAML external sessions. Ensure the NameID format is correctly configured in Grafana for SAML Single Logout to function properly. */
  IMPROVED_EXTERNAL_SESSION_HANDLING_SAML: 'improvedExternalSessionHandlingSAML',
  /** Flag key for Enables running Infinity queries in parallel */
  INFINITY_RUN_QUERIES_IN_PARALLEL: 'infinityRunQueriesInParallel',
  /** Flag key for Query InfluxDB InfluxQL without the proxy */
  INFLUXDB_BACKEND_MIGRATION: 'influxdbBackendMigration',
  /** Flag key for Enables running InfluxDB Influxql queries in parallel */
  INFLUXDB_RUN_QUERIES_IN_PARALLEL: 'influxdbRunQueriesInParallel',
  /** Flag key for Enable streaming JSON parser for InfluxDB datasource InfluxQL query language */
  INFLUXQL_STREAMING_PARSER: 'influxqlStreamingParser',
  /** Flag key for Enables the interactive learning app */
  INTERACTIVE_LEARNING: 'interactiveLearning',
  /** Flag key for Enable querying trace data through Jaeger's gRPC endpoint (HTTP) */
  JAEGER_ENABLE_GRPC_ENDPOINT: 'jaegerEnableGrpcEndpoint',
  /** Flag key for Distributes alert rule evaluations more evenly over time, including spreading out rules within the same group. Disables sequential evaluation if enabled. */
  JITTER_ALERT_RULES_WITHIN_GROUPS: 'jitterAlertRulesWithinGroups',
  /** Flag key for Enable folder's api server counts */
  K_8_S_FOLDER_COUNTS: 'k8SFolderCounts',
  /** Flag key for Enable grafana's embedded kube-aggregator */
  KUBERNETES_AGGREGATOR: 'kubernetesAggregator',
  /** Flag key for Enable CAP token based authentication in grafana's embedded kube-aggregator */
  KUBERNETES_AGGREGATOR_CAP_TOKEN_AUTH: 'kubernetesAggregatorCapTokenAuth',
  /** Flag key for Adds support for Kubernetes alerting historian APIs */
  KUBERNETES_ALERTING_HISTORIAN: 'kubernetesAlertingHistorian',
  /** Flag key for Adds support for Kubernetes alerting and recording rules */
  KUBERNETES_ALERTING_RULES: 'kubernetesAlertingRules',
  /** Flag key for Deprecated: Use kubernetesAuthZResourcePermissionsRedirect and kubernetesAuthZRolesRedirect instead */
  KUBERNETES_AUTH_Z_HANDLER_REDIRECT: 'kubernetesAuthZHandlerRedirect',
  /** Flag key for Redirects the traffic from the legacy resource permissions endpoints to the new K8s AuthZ endpoints */
  KUBERNETES_AUTH_Z_RESOURCE_PERMISSIONS_REDIRECT: 'kubernetesAuthZResourcePermissionsRedirect',
  /** Flag key for Redirects the traffic from the legacy roles endpoints to the new K8s AuthZ endpoints */
  KUBERNETES_AUTH_Z_ROLES_REDIRECT: 'kubernetesAuthZRolesRedirect',
  /** Flag key for Enables create, delete, and update mutations for resources owned by IAM identity */
  KUBERNETES_AUTHN_MUTATION: 'kubernetesAuthnMutation',
  /** Flag key for Deprecated: Use kubernetesAuthzCoreRolesApi, kubernetesAuthzRolesApi, and kubernetesAuthzRoleBindingsApi instead */
  KUBERNETES_AUTHZ_APIS: 'kubernetesAuthzApis',
  /** Flag key for Registers AuthZ Core Roles /apis endpoint */
  KUBERNETES_AUTHZ_CORE_ROLES_API: 'kubernetesAuthzCoreRolesApi',
  /** Flag key for Registers AuthZ Global Roles /apis endpoint */
  KUBERNETES_AUTHZ_GLOBAL_ROLES_API: 'kubernetesAuthzGlobalRolesApi',
  /** Flag key for Registers AuthZ resource permission /apis endpoints */
  KUBERNETES_AUTHZ_RESOURCE_PERMISSION_APIS: 'kubernetesAuthzResourcePermissionApis',
  /** Flag key for Registers AuthZ Role Bindings /apis endpoint */
  KUBERNETES_AUTHZ_ROLE_BINDINGS_API: 'kubernetesAuthzRoleBindingsApi',
  /** Flag key for Registers AuthZ Roles /apis endpoint */
  KUBERNETES_AUTHZ_ROLES_API: 'kubernetesAuthzRolesApi',
  /** Flag key for Registers AuthZ TeamLBACRule /apis endpoint */
  KUBERNETES_AUTHZ_TEAM_LBAC_RULE_API: 'kubernetesAuthzTeamLBACRuleApi',
  /** Flag key for Enable sync of Zanzana authorization store on AuthZ CRD mutations */
  KUBERNETES_AUTHZ_ZANZANA_SYNC: 'kubernetesAuthzZanzanaSync',
  /** Flag key for Adds support for Kubernetes correlations */
  KUBERNETES_CORRELATIONS: 'kubernetesCorrelations',
  /** Flag key for Use the kubernetes API in the frontend for dashboards */
  KUBERNETES_DASHBOARDS: 'kubernetesDashboards',
  /** Flag key for Enables external group mapping APIs in the app platform */
  KUBERNETES_EXTERNAL_GROUP_MAPPINGS_API: 'kubernetesExternalGroupMappingsApi',
  /** Flag key for Redirects the request of the external group mapping endpoints to the app platform APIs */
  KUBERNETES_EXTERNAL_GROUP_MAPPINGS_REDIRECT: 'kubernetesExternalGroupMappingsRedirect',
  /** Flag key for Routes library panel requests from /api to the /apis endpoint */
  KUBERNETES_LIBRARY_PANELS: 'kubernetesLibraryPanels',
  /** Flag key for Adds support for Kubernetes logs drilldown */
  KUBERNETES_LOGS_DRILLDOWN: 'kubernetesLogsDrilldown',
  /** Flag key for Adds support for Kubernetes querycaching */
  KUBERNETES_QUERY_CACHING: 'kubernetesQueryCaching',
  /** Flag key for Enables k8s short url api and uses it under the hood when handling legacy /api */
  KUBERNETES_SHORT_UR_LS: 'kubernetesShortURLs',
  /** Flag key for Routes snapshot requests from /api to the /apis endpoint */
  KUBERNETES_SNAPSHOTS: 'kubernetesSnapshots',
  /** Flag key for Routes stars requests from /api to the /apis endpoint */
  KUBERNETES_STARS: 'kubernetesStars',
  /** Flag key for Enables search for team bindings in the app platform API */
  KUBERNETES_TEAM_BINDINGS: 'kubernetesTeamBindings',
  /** Flag key for Use the new APIs for syncing users to teams */
  KUBERNETES_TEAM_SYNC: 'kubernetesTeamSync',
  /** Flag key for Redirects the request of the team endpoints to the app platform APIs */
  KUBERNETES_TEAMS_HANDLER_REDIRECT: 'kubernetesTeamsHandlerRedirect',
  /** Flag key for Adds support for Kubernetes unified storage quotas */
  KUBERNETES_UNIFIED_STORAGE_QUOTAS: 'kubernetesUnifiedStorageQuotas',
  /** Flag key for Registers a live apiserver */
  LIVE_API_SERVER: 'liveAPIServer',
  /** Flag key for Specifies the locale so the correct format for numbers and dates can be shown */
  LOCALE_FORMAT_PREFERENCE: 'localeFormatPreference',
  /** Flag key for In-development feature that will allow injection of labels into loki queries. */
  LOG_QL_SCOPE: 'logQLScope',
  /** Flag key for Allow datasource to provide custom UI for context view */
  LOGS_CONTEXT_DATASOURCE_UI: 'logsContextDatasourceUi',
  /** Flag key for A table visualisation for logs in Explore */
  LOGS_EXPLORE_TABLE_VISUALISATION: 'logsExploreTableVisualisation',
  /** Flag key for Enables a control component for the logs panel in Explore */
  LOGS_PANEL_CONTROLS: 'logsPanelControls',
  /** Flag key for Support new streaming approach for loki (prototype, needs special loki build) */
  LOKI_EXPERIMENTAL_STREAMING: 'lokiExperimentalStreaming',
  /** Flag key for Defaults to using the Loki `/labels` API instead of `/series` */
  LOKI_LABEL_NAMES_QUERY_API: 'lokiLabelNamesQueryApi',
  /** Flag key for Changes logs responses from Loki to be compliant with the dataplane specification. */
  LOKI_LOGS_DATAPLANE: 'lokiLogsDataplane',
  /** Flag key for Send X-Loki-Query-Limits-Context header to Loki on first split request */
  LOKI_QUERY_LIMITS_CONTEXT: 'lokiQueryLimitsContext',
  /** Flag key for Split large interval queries into subqueries with smaller time intervals */
  LOKI_QUERY_SPLITTING: 'lokiQuerySplitting',
  /** Flag key for Enables running Loki queries in parallel */
  LOKI_RUN_QUERIES_IN_PARALLEL: 'lokiRunQueriesInParallel',
  /** Flag key for Use stream shards to split queries into smaller subqueries */
  LOKI_SHARD_SPLITTING: 'lokiShardSplitting',
  /** Flag key for Pick the dual write mode from database configs */
  MANAGED_DUAL_WRITER: 'managedDualWriter',
  /** Flag key for Enables creating metrics from profiles and storing them as recording rules */
  METRICS_FROM_PROFILES: 'metricsFromProfiles',
  /** Flag key for Enable support for Machine Learning in server-side expressions */
  ML_EXPRESSIONS: 'mlExpressions',
  /** Flag key for Enables support for variables whose values can have multiple properties */
  MULTI_PROPS_VARIABLES: 'multiPropsVariables',
  /** Flag key for use multi-tenant path for awsTempCredentials */
  MULTI_TENANT_TEMP_CREDENTIALS: 'multiTenantTempCredentials',
  /** Flag key for Enables new design for the Clickhouse data source configuration page */
  NEW_CLICKHOUSE_CONFIG_PAGE_DESIGN: 'newClickhouseConfigPageDesign',
  /** Flag key for Enables filters and group by variables on all new dashboards. Variables are added only if default data source supports filtering. */
  NEW_DASHBOARD_WITH_FILTERS_AND_GROUP_BY: 'newDashboardWithFiltersAndGroupBy',
  /** Flag key for Enable new gauge visualization */
  NEW_GAUGE: 'newGauge',
  /** Flag key for Enables new design for the InfluxDB data source configuration page */
  NEW_INFLUX_DS_CONFIG_PAGE_DESIGN: 'newInfluxDSConfigPageDesign',
  /** Flag key for New Log Context component */
  NEW_LOG_CONTEXT: 'newLogContext',
  /** Flag key for Enables the new logs panel */
  NEW_LOGS_PANEL: 'newLogsPanel',
  /** Flag key for Increases panel padding globally */
  NEW_PANEL_PADDING: 'newPanelPadding',
  /** Flag key for Enables the report creation drawer in a dashboard */
  NEW_SHARE_REPORT_DRAWER: 'newShareReportDrawer',
  /** Flag key for Enables new keyboard shortcuts for time range zoom operations */
  NEW_TIME_RANGE_ZOOM_SHORTCUTS: 'newTimeRangeZoomShortcuts',
  /** Flag key for Enable new visualization suggestions */
  NEW_VIZ_SUGGESTIONS: 'newVizSuggestions',
  /** Flag key for Require that sub claims is present in oauth tokens. */
  OAUTH_REQUIRE_SUB_CLAIM: 'oauthRequireSubClaim',
  /** Flag key for When storing dashboard and folder resource permissions, only store action sets and not the full list of underlying permission */
  ONLY_STORE_ACTION_SETS: 'onlyStoreActionSets',
  /** Flag key for Run queries through the data source backend */
  OPENTSDB_BACKEND_MIGRATION: 'opentsdbBackendMigration',
  /** Flag key for Applies OTel formatting templates to displayed logs */
  OTEL_LOGS_FORMATTING: 'otelLogsFormatting',
  /** Flag key for Enables use of the `systemPanelFilterVar` variable to filter panels in a dashboard */
  PANEL_FILTER_VARIABLE: 'panelFilterVariable',
  /** Flag key for Enables a group by action per panel */
  PANEL_GROUP_BY: 'panelGroupBy',
  /** Flag key for Enable style actions (copy/paste) in the panel editor */
  PANEL_STYLE_ACTIONS: 'panelStyleActions',
  /** Flag key for Enables a new panel time settings drawer */
  PANEL_TIME_SETTINGS: 'panelTimeSettings',
  /** Flag key for Search for dashboards using panel title */
  PANEL_TITLE_SEARCH: 'panelTitleSearch',
  /** Flag key for Enable passwordless login via magic link authentication */
  PASSWORDLESS_MAGIC_LINK_AUTHENTICATION: 'passwordlessMagicLinkAuthentication',
  /** Flag key for Enables generating table data as PDF in reporting */
  PDF_TABLES: 'pdfTables',
  /** Flag key for Enables filtering by grouping labels on the panel level through legend or tooltip */
  PER_PANEL_FILTERING: 'perPanelFiltering',
  /** Flag key for Enables viewing non-applicable drilldowns on a panel level */
  PER_PANEL_NON_APPLICABLE_DRILLDOWNS: 'perPanelNonApplicableDrilldowns',
  /** Flag key for Enables experimental reconciler for playlists */
  PLAYLISTS_RECONCILER: 'playlistsReconciler',
  /** Flag key for Enables running plugins in containers */
  PLUGIN_CONTAINERS: 'pluginContainers',
  /** Flag key for Show insights for plugins in the plugin details page */
  PLUGIN_INSIGHTS: 'pluginInsights',
  /** Flag key for Enable syncing plugin installations to the installs API */
  PLUGIN_INSTALL_API_SYNC: 'pluginInstallAPISync',
  /** Flag key for Preserve plugin proxy trailing slash. */
  PLUGIN_PROXY_PRESERVE_TRAILING_SLASH: 'pluginProxyPreserveTrailingSlash',
  /** Flag key for Load plugins on store service startup instead of wire provider, and call RegisterFixedRoles after all plugins are loaded */
  PLUGIN_STORE_SERVICE_LOADING: 'pluginStoreServiceLoading',
  /** Flag key for Enables auto-updating of users installed plugins */
  PLUGINS_AUTO_UPDATE: 'pluginsAutoUpdate',
  /** Flag key for Enables SRI checks for plugin assets */
  PLUGINS_SRI_CHECKS: 'pluginsSriChecks',
  /** Flag key for Prefer library panel title over viz panel title. */
  PREFER_LIBRARY_PANEL_TITLE: 'preferLibraryPanelTitle',
  /** Flag key for Enables possibility to preserve dashboard variables and time range when navigating between dashboards */
  PRESERVE_DASHBOARD_STATE_WHEN_NAVIGATING: 'preserveDashboardStateWhenNavigating',
  /** Flag key for Restrict PanelChrome contents with overflow: hidden; */
  PREVENT_PANEL_CHROME_OVERFLOW: 'preventPanelChromeOverflow',
  /** Flag key for Enables profiles exemplars support in profiles drilldown */
  PROFILES_EXEMPLARS: 'profilesExemplars',
  /** Flag key for Deprecated. Allow override default AAD audience for Azure Prometheus endpoint. Enabled by default. This feature should no longer be used and will be removed in the future. */
  PROMETHEUS_AZURE_OVERRIDE_AUDIENCE: 'prometheusAzureOverrideAudience',
  /** Flag key for Adds support for quotes and special characters in label values for Prometheus queries */
  PROMETHEUS_SPECIAL_CHARS_IN_LABEL_VALUES: 'prometheusSpecialCharsInLabelValues',
  /** Flag key for Checks for deprecated Prometheus authentication methods (SigV4 and Azure), installs the relevant data source, and migrates the Prometheus data sources */
  PROMETHEUS_TYPE_MIGRATION: 'prometheusTypeMigration',
  /** Flag key for Next generation provisioning... and git */
  PROVISIONING: 'provisioning',
  /** Flag key for Enable export functionality for provisioned resources */
  PROVISIONING_EXPORT: 'provisioningExport',
  /** Flag key for Allow setting folder metadata for provisioned folders */
  PROVISIONING_FOLDER_METADATA: 'provisioningFolderMetadata',
  /** Flag key for Enables public dashboard sharing to be restricted to only allowed emails */
  PUBLIC_DASHBOARDS_EMAIL_SHARING: 'publicDashboardsEmailSharing',
  /** Flag key for Enables public dashboard rendering using scenes */
  PUBLIC_DASHBOARDS_SCENE: 'publicDashboardsScene',
  /** Flag key for Enable request deduplication when query caching is enabled. Requests issuing the same query will be deduplicated, only the first request to arrive will be executed and the response will be shared with requests arriving while there is a request in-flight */
  QUERY_CACHE_REQUEST_DEDUPLICATION: 'queryCacheRequestDeduplication',
  /** Flag key for Enables next generation query editor experience */
  QUERY_EDITOR_NEXT: 'queryEditorNext',
  /** Flag key for Enables Saved queries (query library) feature */
  QUERY_LIBRARY: 'queryLibrary',
  /** Flag key for Register /apis/query.grafana.app/ -- will eventually replace /api/ds/query */
  QUERY_SERVICE: 'queryService',
  /** Flag key for Routes requests to the new query service */
  QUERY_SERVICE_FROM_UI: 'queryServiceFromUI',
  /** Flag key for Rewrite requests targeting /ds/query to the query service */
  QUERY_SERVICE_REWRITE: 'queryServiceRewrite',
  /** Flag key for Adds datasource connections to the query service */
  QUERY_SERVICE_WITH_CONNECTIONS: 'queryServiceWithConnections',
  /** Flag key for Enables the Query with Assistant button in the query editor */
  QUERY_WITH_ASSISTANT: 'queryWithAssistant',
  /** Flag key for Whether to use the new React 19 runtime */
  REACT_19: 'react19',
  /** Flag key for Enables recently viewed dashboards section in the browsing dashboard page */
  RECENTLY_VIEWED_DASHBOARDS: 'recentlyViewedDashboards',
  /** Flag key for Refactor time range variables flow to reduce number of API calls made when query variables are chained */
  REFACTOR_VARIABLES_TIME_RANGE: 'refactorVariablesTimeRange',
  /** Flag key for Require that refresh tokens are present in oauth tokens. */
  REFRESH_TOKEN_REQUIRED: 'refreshTokenRequired',
  /** Flag key for Enables reload of dashboards on scopes, time range and variables changes */
  RELOAD_DASHBOARDS_ON_PARAMS_CHANGE: 'reloadDashboardsOnParamsChange',
  /** Flag key for Uses JWT-based auth for rendering instead of relying on remote cache */
  RENDER_AUTH_JWT: 'renderAuthJWT',
  /** Flag key for Disable pre-loading app plugins when the request is coming from the renderer */
  RENDERER_DISABLE_APP_PLUGINS_PRELOAD: 'rendererDisableAppPluginsPreload',
  /** Flag key for Enables CSV encoding options in the reporting feature */
  REPORTING_CSV_ENCODING_OPTIONS: 'reportingCsvEncodingOptions',
  /** Flag key for Enable v2 dashboard layout support in reports (auto-grid, tabs, rows) */
  REPORTING_V_2_LAYOUTS: 'reportingV2Layouts',
  /** Flag key for Enables restore deleted dashboards feature */
  RESTORE_DASHBOARDS: 'restoreDashboards',
  /** Flag key for Enables sharing a list of APIs with a list of plugins */
  RESTRICTED_PLUGIN_APIS: 'restrictedPluginApis',
  /** Flag key for Enables the new role picker drawer design */
  ROLE_PICKER_DRAWER: 'rolePickerDrawer',
  /** Flag key for Enables the new version of rudderstack */
  RUDDERSTACK_UPGRADE: 'rudderstackUpgrade',
  /** Flag key for Enables Saved queries (query library) RBAC permissions */
  SAVED_QUERIES_RBAC: 'savedQueriesRBAC',
  /** Flag key for Enable fallback parsing behavior when scan row encounters invalid dashboard JSON */
  SCAN_ROW_INVALID_DASHBOARD_PARSE_FALLBACK_ENABLED: 'scanRowInvalidDashboardParseFallbackEnabled',
  /** Flag key for In-development feature flag for the scope api using the app platform. */
  SCOPE_API: 'scopeApi',
  /** Flag key for Enables the use of scope filters in Grafana */
  SCOPE_FILTERS: 'scopeFilters',
  /** Flag key for Enable scope search to include all levels of the scope node tree */
  SCOPE_SEARCH_ALL_LEVELS: 'scopeSearchAllLevels',
  /** Flag key for Enable the Secrets Keeper management UI for configuring external secret storage */
  SECRETS_KEEPER_UI: 'secretsKeeperUI',
  /** Flag key for Enables the creation of keepers that manage secrets stored on AWS secrets manager */
  SECRETS_MANAGEMENT_APP_PLATFORM_AWS_KEEPER: 'secretsManagementAppPlatformAwsKeeper',
  /** Flag key for Enable the secrets management app platform UI */
  SECRETS_MANAGEMENT_APP_PLATFORM_UI: 'secretsManagementAppPlatformUI',
  /** Flag key for Enables image sharing functionality for dashboards */
  SHARING_DASHBOARD_IMAGE: 'sharingDashboardImage',
  /** Flag key for Enables the ASAP smoothing transformation for time series data */
  SMOOTHING_TRANSFORMATION: 'smoothingTransformation',
  /** Flag key for Enables SQL Expressions, which can execute SQL queries against data source results. */
  SQL_EXPRESSIONS: 'sqlExpressions',
  /** Flag key for Enables column autocomplete for SQL Expressions */
  SQL_EXPRESSIONS_COLUMN_AUTO_COMPLETE: 'sqlExpressionsColumnAutoComplete',
  /** Flag key for Send query to the same datasource in a single request when using server side expressions. The `cloudWatchBatchQueries` feature toggle should be enabled if this used with CloudWatch. */
  SSE_GROUP_BY_DATASOURCE: 'sseGroupByDatasource',
  /** Flag key for populate star status from apiserver */
  STARS_FROM_API_SERVER: 'starsFromAPIServer',
  /** Flag key for Configurable storage for dashboards, datasources, and resources */
  STORAGE: 'storage',
  /** Flag key for Displays datasource provisioned and community dashboards in dashboard empty page, only when coming from datasource configuration page */
  SUGGESTED_DASHBOARDS: 'suggestedDashboards',
  /** Flag key for Enables shared crosshair in table panel */
  TABLE_SHARED_CROSSHAIR: 'tableSharedCrosshair',
  /** Flag key for Use fixed-width numbers globally in the UI */
  TABULAR_NUMBERS: 'tabularNumbers',
  /** Flag key for Enables team folders functionality */
  TEAM_FOLDERS: 'teamFolders',
  /** Flag key for Use the Kubernetes TeamLBACRule API for team HTTP headers on datasource query requests */
  TEAM_HTTP_HEADERS_FROM_APP_PLATFORM: 'teamHttpHeadersFromAppPlatform',
  /** Flag key for Enables LBAC for datasources for Tempo to apply LBAC filtering of traces to the client requests for users in teams */
  TEAM_HTTP_HEADERS_TEMPO: 'teamHttpHeadersTempo',
  /** Flag key for Enables creating alerts from Tempo data source */
  TEMPO_ALERTING: 'tempoAlerting',
  /** Flag key for Enables time comparison option in supported panels */
  TIME_COMPARISON: 'timeComparison',
  /** Flag key for Enables time range panning functionality */
  TIME_RANGE_PAN: 'timeRangePan',
  /** Flag key for Enables time pickers sync */
  TIME_RANGE_PROVIDER: 'timeRangeProvider',
  /** Flag key for Show transformation quick-start cards in empty transformations state */
  TRANSFORMATIONS_EMPTY_PLACEHOLDER: 'transformationsEmptyPlaceholder',
  /** Flag key for Enable TTL plugin instance manager */
  TTL_PLUGIN_INSTANCE_MANAGER: 'ttlPluginInstanceManager',
  /** Flag key for Enables unified navbars */
  UNIFIED_NAVBARS: 'unifiedNavbars',
  /** Flag key for Enables to save big objects in blob storage */
  UNIFIED_STORAGE_BIG_OBJECTS_SUPPORT: 'unifiedStorageBigObjectsSupport',
  /** Flag key for Enables the unified storage grpc connection pool */
  UNIFIED_STORAGE_GRPC_CONNECTION_POOL: 'unifiedStorageGrpcConnectionPool',
  /** Flag key for Enable dual reader for unified storage search */
  UNIFIED_STORAGE_SEARCH_DUAL_READER_ENABLED: 'unifiedStorageSearchDualReaderEnabled',
  /** Flag key for Enable unified storage search UI */
  UNIFIED_STORAGE_SEARCH_UI: 'unifiedStorageSearchUI',
  /** Flag key for Enables unlimited dashboard panel grouping */
  UNLIMITED_LAYOUTS_NESTING: 'unlimitedLayoutsNesting',
  /** Flag key for Routes short url requests from /api to the /apis endpoint in the frontend. Depends on kubernetesShortURLs */
  USE_KUBERNETES_SHORT_UR_LS_API: 'useKubernetesShortURLsAPI',
  /** Flag key for Enables plugins decoupling from bootdata */
  USE_MT_PLUGINS: 'useMTPlugins',
  /** Flag key for Makes the frontend use the 'names' param for fetching multiple scope nodes at once */
  USE_MULTIPLE_SCOPE_NODES_ENDPOINT: 'useMultipleScopeNodesEndpoint',
  /** Flag key for Use the new datasource API groups for datasource CRUD requests */
  USE_NEW_AP_IS_FOR_DATASOURCE_CRUD: 'useNewAPIsForDatasourceCRUD',
  /** Flag key for Use the single node endpoint for the scope api. This is used to fetch the scope parent node. */
  USE_SCOPE_SINGLE_NODE_ENDPOINT: 'useScopeSingleNodeEndpoint',
  /** Flag key for Use the scopes navigation endpoint instead of the dashboardbindings endpoint */
  USE_SCOPES_NAVIGATION_ENDPOINT: 'useScopesNavigationEndpoint',
  /** Flag key for Use session storage for handling the redirection after login */
  USE_SESSION_STORAGE_FOR_REDIRECTION: 'useSessionStorageForRedirection',
  /** Flag key for Allows authenticated API calls in actions */
  VIZ_ACTIONS_AUTH: 'vizActionsAuth',
  /** Flag key for Enable visualization presets */
  VIZ_PRESETS: 'vizPresets',
  /** Flag key for Use openFGA as authorization engine. */
  ZANZANA: 'zanzana',
  /** Flag key for Use openFGA as main authorization engine and disable legacy RBAC clietn. */
  ZANZANA_NO_LEGACY_CLIENT: 'zanzanaNoLegacyClient',
} as const;

/**
 * Enable AI powered features for dashboards to auto-summary changes when saving
 *
 * **Details:**
 * - flag key: `aiGeneratedDashboardChanges`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAiGeneratedDashboardChanges = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('aiGeneratedDashboardChanges', false, options);
};

/**
 * Enable AI powered features for dashboards to auto-summary changes when saving
 *
 * **Details:**
 * - flag key: `aiGeneratedDashboardChanges`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAiGeneratedDashboardChanges = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('aiGeneratedDashboardChanges', false, options);
};

/**
 * Enable configuration of alert enrichments in Grafana Cloud.
 *
 * **Details:**
 * - flag key: `alertEnrichment`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertEnrichment = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertEnrichment', false, options);
};

/**
 * Enable configuration of alert enrichments in Grafana Cloud.
 *
 * **Details:**
 * - flag key: `alertEnrichment`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertEnrichment = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('alertEnrichment', false, options);
};

/**
 * Enable conditional alert enrichment steps.
 *
 * **Details:**
 * - flag key: `alertEnrichmentConditional`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertEnrichmentConditional = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertEnrichmentConditional', false, options);
};

/**
 * Enable conditional alert enrichment steps.
 *
 * **Details:**
 * - flag key: `alertEnrichmentConditional`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertEnrichmentConditional = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertEnrichmentConditional', false, options);
};

/**
 * Allow multiple steps per enrichment.
 *
 * **Details:**
 * - flag key: `alertEnrichmentMultiStep`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertEnrichmentMultiStep = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertEnrichmentMultiStep', false, options);
};

/**
 * Allow multiple steps per enrichment.
 *
 * **Details:**
 * - flag key: `alertEnrichmentMultiStep`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertEnrichmentMultiStep = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertEnrichmentMultiStep', false, options);
};

/**
 * Enables the alert rule restore feature
 *
 * **Details:**
 * - flag key: `alertRuleRestore`
 * - default value: `true`
 * - type: `boolean`
 */
export const useAlertRuleRestore = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertRuleRestore', true, options);
};

/**
 * Enables the alert rule restore feature
 *
 * **Details:**
 * - flag key: `alertRuleRestore`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertRuleRestore = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('alertRuleRestore', true, options);
};

/**
 * Use FiredAt for StartsAt when sending alerts to Alertmaanger
 *
 * **Details:**
 * - flag key: `alertRuleUseFiredAtForStartsAt`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertRuleUseFiredAtForStartsAt = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertRuleUseFiredAtForStartsAt', false, options);
};

/**
 * Use FiredAt for StartsAt when sending alerts to Alertmaanger
 *
 * **Details:**
 * - flag key: `alertRuleUseFiredAtForStartsAt`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertRuleUseFiredAtForStartsAt = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertRuleUseFiredAtForStartsAt', false, options);
};

/**
 * Enable AI-analyze central state history.
 *
 * **Details:**
 * - flag key: `alertingAIAnalyzeCentralStateHistory`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertingAianalyzeCentralStateHistory = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingAIAnalyzeCentralStateHistory', false, options);
};

/**
 * Enable AI-analyze central state history.
 *
 * **Details:**
 * - flag key: `alertingAIAnalyzeCentralStateHistory`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingAianalyzeCentralStateHistory = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingAIAnalyzeCentralStateHistory', false, options);
};

/**
 * Enable AI-generated feedback from the Grafana UI.
 *
 * **Details:**
 * - flag key: `alertingAIFeedback`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertingAifeedback = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingAIFeedback', false, options);
};

/**
 * Enable AI-generated feedback from the Grafana UI.
 *
 * **Details:**
 * - flag key: `alertingAIFeedback`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingAifeedback = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingAIFeedback', false, options);
};

/**
 * Enable AI-generated alert rules.
 *
 * **Details:**
 * - flag key: `alertingAIGenAlertRules`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertingAigenAlertRules = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingAIGenAlertRules', false, options);
};

/**
 * Enable AI-generated alert rules.
 *
 * **Details:**
 * - flag key: `alertingAIGenAlertRules`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingAigenAlertRules = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingAIGenAlertRules', false, options);
};

/**
 * Enable AI-generated alerting templates.
 *
 * **Details:**
 * - flag key: `alertingAIGenTemplates`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertingAigenTemplates = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingAIGenTemplates', false, options);
};

/**
 * Enable AI-generated alerting templates.
 *
 * **Details:**
 * - flag key: `alertingAIGenTemplates`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingAigenTemplates = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingAIGenTemplates', false, options);
};

/**
 * Enable AI-improve alert rules labels and annotations.
 *
 * **Details:**
 * - flag key: `alertingAIImproveAlertRules`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertingAiimproveAlertRules = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingAIImproveAlertRules', false, options);
};

/**
 * Enable AI-improve alert rules labels and annotations.
 *
 * **Details:**
 * - flag key: `alertingAIImproveAlertRules`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingAiimproveAlertRules = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingAIImproveAlertRules', false, options);
};

/**
 * Shows a promotional banner for the Alerts Activity feature on the Rule List page
 *
 * **Details:**
 * - flag key: `alertingAlertsActivityBanner`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertingAlertsActivityBanner = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingAlertsActivityBanner', false, options);
};

/**
 * Shows a promotional banner for the Alerts Activity feature on the Rule List page
 *
 * **Details:**
 * - flag key: `alertingAlertsActivityBanner`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingAlertsActivityBanner = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingAlertsActivityBanner', false, options);
};

/**
 * Rule backtesting API for alerting
 *
 * **Details:**
 * - flag key: `alertingBacktesting`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertingBacktesting = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingBacktesting', false, options);
};

/**
 * Rule backtesting API for alerting
 *
 * **Details:**
 * - flag key: `alertingBacktesting`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingBacktesting = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingBacktesting', false, options);
};

/**
 * Enables the alerting bulk actions in the UI
 *
 * **Details:**
 * - flag key: `alertingBulkActionsInUI`
 * - default value: `true`
 * - type: `boolean`
 */
export const useAlertingBulkActionsInUi = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingBulkActionsInUI', true, options);
};

/**
 * Enables the alerting bulk actions in the UI
 *
 * **Details:**
 * - flag key: `alertingBulkActionsInUI`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingBulkActionsInUi = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingBulkActionsInUI', true, options);
};

/**
 * Enables the new central alert history.
 *
 * **Details:**
 * - flag key: `alertingCentralAlertHistory`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertingCentralAlertHistory = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingCentralAlertHistory', false, options);
};

/**
 * Enables the new central alert history.
 *
 * **Details:**
 * - flag key: `alertingCentralAlertHistory`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingCentralAlertHistory = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingCentralAlertHistory', false, options);
};

/**
 * Disables the DMA feature in the UI
 *
 * **Details:**
 * - flag key: `alertingDisableDMAinUI`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertingDisableDmainUi = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingDisableDMAinUI', false, options);
};

/**
 * Disables the DMA feature in the UI
 *
 * **Details:**
 * - flag key: `alertingDisableDMAinUI`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingDisableDmainUi = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingDisableDMAinUI', false, options);
};

/**
 * Disables the ability to send alerts to an external Alertmanager datasource.
 *
 * **Details:**
 * - flag key: `alertingDisableSendAlertsExternal`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertingDisableSendAlertsExternal = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingDisableSendAlertsExternal', false, options);
};

/**
 * Disables the ability to send alerts to an external Alertmanager datasource.
 *
 * **Details:**
 * - flag key: `alertingDisableSendAlertsExternal`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingDisableSendAlertsExternal = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingDisableSendAlertsExternal', false, options);
};

/**
 * Enable Assistant Investigations enrichment type.
 *
 * **Details:**
 * - flag key: `alertingEnrichmentAssistantInvestigations`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertingEnrichmentAssistantInvestigations = (
  options?: ReactFlagEvaluationOptions
): FlagQuery<boolean> => {
  return useFlag('alertingEnrichmentAssistantInvestigations', false, options);
};

/**
 * Enable Assistant Investigations enrichment type.
 *
 * **Details:**
 * - flag key: `alertingEnrichmentAssistantInvestigations`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingEnrichmentAssistantInvestigations = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingEnrichmentAssistantInvestigations', false, options);
};

/**
 * Enable enrichment per rule in the alerting UI.
 *
 * **Details:**
 * - flag key: `alertingEnrichmentPerRule`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertingEnrichmentPerRule = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingEnrichmentPerRule', false, options);
};

/**
 * Enable enrichment per rule in the alerting UI.
 *
 * **Details:**
 * - flag key: `alertingEnrichmentPerRule`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingEnrichmentPerRule = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingEnrichmentPerRule', false, options);
};

/**
 * Enable the new alerting search experience
 *
 * **Details:**
 * - flag key: `alertingFilterV2`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertingFilterV2 = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingFilterV2', false, options);
};

/**
 * Enable the new alerting search experience
 *
 * **Details:**
 * - flag key: `alertingFilterV2`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingFilterV2 = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingFilterV2', false, options);
};

/**
 * Makes NoData and Error alerts fire immediately, without 'pending' stage
 *
 * **Details:**
 * - flag key: `alertingIgnorePendingForNoDataAndError`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertingIgnorePendingForNoDataAndError = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingIgnorePendingForNoDataAndError', false, options);
};

/**
 * Makes NoData and Error alerts fire immediately, without 'pending' stage
 *
 * **Details:**
 * - flag key: `alertingIgnorePendingForNoDataAndError`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingIgnorePendingForNoDataAndError = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingIgnorePendingForNoDataAndError', false, options);
};

/**
 * Enables the API to import Alertmanager configuration
 *
 * **Details:**
 * - flag key: `alertingImportAlertmanagerAPI`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertingImportAlertmanagerApi = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingImportAlertmanagerAPI', false, options);
};

/**
 * Enables the API to import Alertmanager configuration
 *
 * **Details:**
 * - flag key: `alertingImportAlertmanagerAPI`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingImportAlertmanagerApi = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingImportAlertmanagerAPI', false, options);
};

/**
 * Enables the UI to see imported Alertmanager configuration
 *
 * **Details:**
 * - flag key: `alertingImportAlertmanagerUI`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertingImportAlertmanagerUi = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingImportAlertmanagerUI', false, options);
};

/**
 * Enables the UI to see imported Alertmanager configuration
 *
 * **Details:**
 * - flag key: `alertingImportAlertmanagerUI`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingImportAlertmanagerUi = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingImportAlertmanagerUI', false, options);
};

/**
 * Enables a UI feature for importing rules from a Prometheus file to Grafana-managed rules
 *
 * **Details:**
 * - flag key: `alertingImportYAMLUI`
 * - default value: `true`
 * - type: `boolean`
 */
export const useAlertingImportYamlui = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingImportYAMLUI', true, options);
};

/**
 * Enables a UI feature for importing rules from a Prometheus file to Grafana-managed rules
 *
 * **Details:**
 * - flag key: `alertingImportYAMLUI`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingImportYamlui = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingImportYAMLUI', true, options);
};

/**
 * Enables the new Jira integration for contact points in cloud alert managers.
 *
 * **Details:**
 * - flag key: `alertingJiraIntegration`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertingJiraIntegration = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingJiraIntegration', false, options);
};

/**
 * Enables the new Jira integration for contact points in cloud alert managers.
 *
 * **Details:**
 * - flag key: `alertingJiraIntegration`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingJiraIntegration = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingJiraIntegration', false, options);
};

/**
 * Enables the new alert list view design
 *
 * **Details:**
 * - flag key: `alertingListViewV2`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertingListViewV2 = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingListViewV2', false, options);
};

/**
 * Enables the new alert list view design
 *
 * **Details:**
 * - flag key: `alertingListViewV2`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingListViewV2 = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingListViewV2', false, options);
};

/**
 * Enables the alerting list view v2 preview toggle
 *
 * **Details:**
 * - flag key: `alertingListViewV2PreviewToggle`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertingListViewV2PreviewToggle = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingListViewV2PreviewToggle', false, options);
};

/**
 * Enables the alerting list view v2 preview toggle
 *
 * **Details:**
 * - flag key: `alertingListViewV2PreviewToggle`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingListViewV2PreviewToggle = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingListViewV2PreviewToggle', false, options);
};

/**
 * Enables the alerting migration UI, to migrate data source-managed rules to Grafana-managed rules
 *
 * **Details:**
 * - flag key: `alertingMigrationUI`
 * - default value: `true`
 * - type: `boolean`
 */
export const useAlertingMigrationUi = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingMigrationUI', true, options);
};

/**
 * Enables the alerting migration UI, to migrate data source-managed rules to Grafana-managed rules
 *
 * **Details:**
 * - flag key: `alertingMigrationUI`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingMigrationUi = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingMigrationUI', true, options);
};

/**
 * Enables the migration wizard UI to migrate alert rules and notification resources from external sources to Grafana Alerting
 *
 * **Details:**
 * - flag key: `alertingMigrationWizardUI`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertingMigrationWizardUi = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingMigrationWizardUI', false, options);
};

/**
 * Enables the migration wizard UI to migrate alert rules and notification resources from external sources to Grafana Alerting
 *
 * **Details:**
 * - flag key: `alertingMigrationWizardUI`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingMigrationWizardUi = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingMigrationWizardUI', false, options);
};

/**
 * Enables the ability to create multiple alerting policies
 *
 * **Details:**
 * - flag key: `alertingMultiplePolicies`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertingMultiplePolicies = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingMultiplePolicies', false, options);
};

/**
 * Enables the ability to create multiple alerting policies
 *
 * **Details:**
 * - flag key: `alertingMultiplePolicies`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingMultiplePolicies = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingMultiplePolicies', false, options);
};

/**
 * Enables the new Alerting navigation structure with improved menu grouping
 *
 * **Details:**
 * - flag key: `alertingNavigationV2`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertingNavigationV2 = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingNavigationV2', false, options);
};

/**
 * Enables the new Alerting navigation structure with improved menu grouping
 *
 * **Details:**
 * - flag key: `alertingNavigationV2`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingNavigationV2 = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingNavigationV2', false, options);
};

/**
 * Enables the notification history feature
 *
 * **Details:**
 * - flag key: `alertingNotificationHistory`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertingNotificationHistory = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingNotificationHistory', false, options);
};

/**
 * Enables the notification history feature
 *
 * **Details:**
 * - flag key: `alertingNotificationHistory`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingNotificationHistory = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingNotificationHistory', false, options);
};

/**
 * Enables the notification history global menu item viewer
 *
 * **Details:**
 * - flag key: `alertingNotificationHistoryGlobal`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertingNotificationHistoryGlobal = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingNotificationHistoryGlobal', false, options);
};

/**
 * Enables the notification history global menu item viewer
 *
 * **Details:**
 * - flag key: `alertingNotificationHistoryGlobal`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingNotificationHistoryGlobal = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingNotificationHistoryGlobal', false, options);
};

/**
 * Enables the notification history tab in the rule viewer
 *
 * **Details:**
 * - flag key: `alertingNotificationHistoryRuleViewer`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertingNotificationHistoryRuleViewer = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingNotificationHistoryRuleViewer', false, options);
};

/**
 * Enables the notification history tab in the rule viewer
 *
 * **Details:**
 * - flag key: `alertingNotificationHistoryRuleViewer`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingNotificationHistoryRuleViewer = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingNotificationHistoryRuleViewer', false, options);
};

/**
 * Enables simplified step mode in the notifications section
 *
 * **Details:**
 * - flag key: `alertingNotificationsStepMode`
 * - default value: `true`
 * - type: `boolean`
 */
export const useAlertingNotificationsStepMode = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingNotificationsStepMode', true, options);
};

/**
 * Enables simplified step mode in the notifications section
 *
 * **Details:**
 * - flag key: `alertingNotificationsStepMode`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingNotificationsStepMode = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingNotificationsStepMode', true, options);
};

/**
 * Uses Prometheus rules as the primary source of truth for ruler-enabled data sources
 *
 * **Details:**
 * - flag key: `alertingPrometheusRulesPrimary`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertingPrometheusRulesPrimary = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingPrometheusRulesPrimary', false, options);
};

/**
 * Uses Prometheus rules as the primary source of truth for ruler-enabled data sources
 *
 * **Details:**
 * - flag key: `alertingPrometheusRulesPrimary`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingPrometheusRulesPrimary = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingPrometheusRulesPrimary', false, options);
};

/**
 * Enables a feature to avoid issues with concurrent writes to the alerting provenance table in MySQL
 *
 * **Details:**
 * - flag key: `alertingProvenanceLockWrites`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertingProvenanceLockWrites = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingProvenanceLockWrites', false, options);
};

/**
 * Enables a feature to avoid issues with concurrent writes to the alerting provenance table in MySQL
 *
 * **Details:**
 * - flag key: `alertingProvenanceLockWrites`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingProvenanceLockWrites = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingProvenanceLockWrites', false, options);
};

/**
 * Enables step mode for alerting queries and expressions
 *
 * **Details:**
 * - flag key: `alertingQueryAndExpressionsStepMode`
 * - default value: `true`
 * - type: `boolean`
 */
export const useAlertingQueryAndExpressionsStepMode = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingQueryAndExpressionsStepMode', true, options);
};

/**
 * Enables step mode for alerting queries and expressions
 *
 * **Details:**
 * - flag key: `alertingQueryAndExpressionsStepMode`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingQueryAndExpressionsStepMode = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingQueryAndExpressionsStepMode', true, options);
};

/**
 * Optimizes eligible queries in order to reduce load on datasources
 *
 * **Details:**
 * - flag key: `alertingQueryOptimization`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertingQueryOptimization = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingQueryOptimization', false, options);
};

/**
 * Optimizes eligible queries in order to reduce load on datasources
 *
 * **Details:**
 * - flag key: `alertingQueryOptimization`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingQueryOptimization = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingQueryOptimization', false, options);
};

/**
 * Enables UI functionality to permanently delete alert rules
 *
 * **Details:**
 * - flag key: `alertingRulePermanentlyDelete`
 * - default value: `true`
 * - type: `boolean`
 */
export const useAlertingRulePermanentlyDelete = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingRulePermanentlyDelete', true, options);
};

/**
 * Enables UI functionality to permanently delete alert rules
 *
 * **Details:**
 * - flag key: `alertingRulePermanentlyDelete`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingRulePermanentlyDelete = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingRulePermanentlyDelete', true, options);
};

/**
 * Enables the UI functionality to recover and view deleted alert rules
 *
 * **Details:**
 * - flag key: `alertingRuleRecoverDeleted`
 * - default value: `true`
 * - type: `boolean`
 */
export const useAlertingRuleRecoverDeleted = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingRuleRecoverDeleted', true, options);
};

/**
 * Enables the UI functionality to recover and view deleted alert rules
 *
 * **Details:**
 * - flag key: `alertingRuleRecoverDeleted`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingRuleRecoverDeleted = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingRuleRecoverDeleted', true, options);
};

/**
 * Enables the alert rule version history restore feature
 *
 * **Details:**
 * - flag key: `alertingRuleVersionHistoryRestore`
 * - default value: `true`
 * - type: `boolean`
 */
export const useAlertingRuleVersionHistoryRestore = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingRuleVersionHistoryRestore', true, options);
};

/**
 * Enables the alert rule version history restore feature
 *
 * **Details:**
 * - flag key: `alertingRuleVersionHistoryRestore`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingRuleVersionHistoryRestore = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingRuleVersionHistoryRestore', true, options);
};

/**
 * Enables the compressed protobuf-based alert state storage. Default is enabled.
 *
 * **Details:**
 * - flag key: `alertingSaveStateCompressed`
 * - default value: `true`
 * - type: `boolean`
 */
export const useAlertingSaveStateCompressed = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingSaveStateCompressed', true, options);
};

/**
 * Enables the compressed protobuf-based alert state storage. Default is enabled.
 *
 * **Details:**
 * - flag key: `alertingSaveStateCompressed`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingSaveStateCompressed = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingSaveStateCompressed', true, options);
};

/**
 * Writes the state periodically to the database, asynchronous to rule evaluation
 *
 * **Details:**
 * - flag key: `alertingSaveStatePeriodic`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertingSaveStatePeriodic = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingSaveStatePeriodic', false, options);
};

/**
 * Writes the state periodically to the database, asynchronous to rule evaluation
 *
 * **Details:**
 * - flag key: `alertingSaveStatePeriodic`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingSaveStatePeriodic = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingSaveStatePeriodic', false, options);
};

/**
 * Enables saved searches for alert rules list
 *
 * **Details:**
 * - flag key: `alertingSavedSearches`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertingSavedSearches = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingSavedSearches', false, options);
};

/**
 * Enables saved searches for alert rules list
 *
 * **Details:**
 * - flag key: `alertingSavedSearches`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingSavedSearches = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingSavedSearches', false, options);
};

/**
 * Use synchronized dispatch timer to minimize duplicate notifications across alertmanager HA pods
 *
 * **Details:**
 * - flag key: `alertingSyncDispatchTimer`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertingSyncDispatchTimer = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingSyncDispatchTimer', false, options);
};

/**
 * Use synchronized dispatch timer to minimize duplicate notifications across alertmanager HA pods
 *
 * **Details:**
 * - flag key: `alertingSyncDispatchTimer`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingSyncDispatchTimer = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingSyncDispatchTimer', false, options);
};

/**
 * Use the new k8s API for fetching integration type schemas
 *
 * **Details:**
 * - flag key: `alertingSyncNotifiersApiMigration`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertingSyncNotifiersApiMigration = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingSyncNotifiersApiMigration', false, options);
};

/**
 * Use the new k8s API for fetching integration type schemas
 *
 * **Details:**
 * - flag key: `alertingSyncNotifiersApiMigration`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingSyncNotifiersApiMigration = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingSyncNotifiersApiMigration', false, options);
};

/**
 * Enables the alerting triage feature
 *
 * **Details:**
 * - flag key: `alertingTriage`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertingTriage = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingTriage', false, options);
};

/**
 * Enables the alerting triage feature
 *
 * **Details:**
 * - flag key: `alertingTriage`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingTriage = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingTriage', false, options);
};

/**
 * Enables saved searches for the Alert Activity page
 *
 * **Details:**
 * - flag key: `alertingTriageSavedSearches`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertingTriageSavedSearches = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingTriageSavedSearches', false, options);
};

/**
 * Enables saved searches for the Alert Activity page
 *
 * **Details:**
 * - flag key: `alertingTriageSavedSearches`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingTriageSavedSearches = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingTriageSavedSearches', false, options);
};

/**
 * Enables removing the reducer from the alerting UI when creating a new alert rule and using instant query
 *
 * **Details:**
 * - flag key: `alertingUIOptimizeReducer`
 * - default value: `true`
 * - type: `boolean`
 */
export const useAlertingUioptimizeReducer = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingUIOptimizeReducer', true, options);
};

/**
 * Enables removing the reducer from the alerting UI when creating a new alert rule and using instant query
 *
 * **Details:**
 * - flag key: `alertingUIOptimizeReducer`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingUioptimizeReducer = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingUIOptimizeReducer', true, options);
};

/**
 * Enables the UI to use certain backend-side filters
 *
 * **Details:**
 * - flag key: `alertingUIUseBackendFilters`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertingUiuseBackendFilters = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingUIUseBackendFilters', false, options);
};

/**
 * Enables the UI to use certain backend-side filters
 *
 * **Details:**
 * - flag key: `alertingUIUseBackendFilters`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingUiuseBackendFilters = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingUIUseBackendFilters', false, options);
};

/**
 * Enables the UI to use rules backend-side filters 100% compatible with the frontend filters
 *
 * **Details:**
 * - flag key: `alertingUIUseFullyCompatBackendFilters`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertingUiuseFullyCompatBackendFilters = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertingUIUseFullyCompatBackendFilters', false, options);
};

/**
 * Enables the UI to use rules backend-side filters 100% compatible with the frontend filters
 *
 * **Details:**
 * - flag key: `alertingUIUseFullyCompatBackendFilters`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingUiuseFullyCompatBackendFilters = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingUIUseFullyCompatBackendFilters', false, options);
};

/**
 * Feature flag
 *
 * **Details:**
 * - flag key: `alertingUseNewSimplifiedRoutingHashAlgorithm`
 * - default value: `true`
 * - type: `boolean`
 */
export const useAlertingUseNewSimplifiedRoutingHashAlgorithm = (
  options?: ReactFlagEvaluationOptions
): FlagQuery<boolean> => {
  return useFlag('alertingUseNewSimplifiedRoutingHashAlgorithm', true, options);
};

/**
 * Feature flag
 *
 * **Details:**
 * - flag key: `alertingUseNewSimplifiedRoutingHashAlgorithm`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertingUseNewSimplifiedRoutingHashAlgorithm = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertingUseNewSimplifiedRoutingHashAlgorithm', true, options);
};

/**
 * Enable Grafana to have a remote Alertmanager instance as the primary Alertmanager.
 *
 * **Details:**
 * - flag key: `alertmanagerRemotePrimary`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertmanagerRemotePrimary = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertmanagerRemotePrimary', false, options);
};

/**
 * Enable Grafana to have a remote Alertmanager instance as the primary Alertmanager.
 *
 * **Details:**
 * - flag key: `alertmanagerRemotePrimary`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertmanagerRemotePrimary = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertmanagerRemotePrimary', false, options);
};

/**
 * Enable Grafana to sync configuration and state with a remote Alertmanager.
 *
 * **Details:**
 * - flag key: `alertmanagerRemoteSecondary`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertmanagerRemoteSecondary = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('alertmanagerRemoteSecondary', false, options);
};

/**
 * Enable Grafana to sync configuration and state with a remote Alertmanager.
 *
 * **Details:**
 * - flag key: `alertmanagerRemoteSecondary`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertmanagerRemoteSecondary = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertmanagerRemoteSecondary', false, options);
};

/**
 * Starts Grafana in remote secondary mode pulling the latest state from the remote Alertmanager to avoid duplicate notifications.
 *
 * **Details:**
 * - flag key: `alertmanagerRemoteSecondaryWithRemoteState`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAlertmanagerRemoteSecondaryWithRemoteState = (
  options?: ReactFlagEvaluationOptions
): FlagQuery<boolean> => {
  return useFlag('alertmanagerRemoteSecondaryWithRemoteState', false, options);
};

/**
 * Starts Grafana in remote secondary mode pulling the latest state from the remote Alertmanager to avoid duplicate notifications.
 *
 * **Details:**
 * - flag key: `alertmanagerRemoteSecondaryWithRemoteState`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAlertmanagerRemoteSecondaryWithRemoteState = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('alertmanagerRemoteSecondaryWithRemoteState', false, options);
};

/**
 * Change the way annotation permissions work by scoping them to folders and dashboards.
 *
 * **Details:**
 * - flag key: `annotationPermissionUpdate`
 * - default value: `true`
 * - type: `boolean`
 */
export const useAnnotationPermissionUpdate = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('annotationPermissionUpdate', true, options);
};

/**
 * Change the way annotation permissions work by scoping them to folders and dashboards.
 *
 * **Details:**
 * - flag key: `annotationPermissionUpdate`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAnnotationPermissionUpdate = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('annotationPermissionUpdate', true, options);
};

/**
 * Enables the gRPC client to authenticate with the App Platform by using ID & access tokens
 *
 * **Details:**
 * - flag key: `appPlatformGrpcClientAuth`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAppPlatformGrpcClientAuth = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('appPlatformGrpcClientAuth', false, options);
};

/**
 * Enables the gRPC client to authenticate with the App Platform by using ID & access tokens
 *
 * **Details:**
 * - flag key: `appPlatformGrpcClientAuth`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAppPlatformGrpcClientAuth = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('appPlatformGrpcClientAuth', false, options);
};

/**
 * Enables SRI checks for Grafana JavaScript assets
 *
 * **Details:**
 * - flag key: `assetSriChecks`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAssetSriChecks = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('assetSriChecks', false, options);
};

/**
 * Enables SRI checks for Grafana JavaScript assets
 *
 * **Details:**
 * - flag key: `assetSriChecks`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAssetSriChecks = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('assetSriChecks', false, options);
};

/**
 * Enable audit logging with Kubernetes under app platform
 *
 * **Details:**
 * - flag key: `auditLoggingAppPlatform`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAuditLoggingAppPlatform = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('auditLoggingAppPlatform', false, options);
};

/**
 * Enable audit logging with Kubernetes under app platform
 *
 * **Details:**
 * - flag key: `auditLoggingAppPlatform`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAuditLoggingAppPlatform = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('auditLoggingAppPlatform', false, options);
};

/**
 * Enables the gRPC server for authorization
 *
 * **Details:**
 * - flag key: `authZGRPCServer`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAuthZgrpcserver = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('authZGRPCServer', false, options);
};

/**
 * Enables the gRPC server for authorization
 *
 * **Details:**
 * - flag key: `authZGRPCServer`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAuthZgrpcserver = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('authZGRPCServer', false, options);
};

/**
 * Enable caching for async queries for Redshift and Athena. Requires that the datasource has caching and async query support enabled
 *
 * **Details:**
 * - flag key: `awsAsyncQueryCaching`
 * - default value: `true`
 * - type: `boolean`
 */
export const useAwsAsyncQueryCaching = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('awsAsyncQueryCaching', true, options);
};

/**
 * Enable caching for async queries for Redshift and Athena. Requires that the datasource has caching and async query support enabled
 *
 * **Details:**
 * - flag key: `awsAsyncQueryCaching`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAwsAsyncQueryCaching = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('awsAsyncQueryCaching', true, options);
};

/**
 * Enables http proxy settings for aws datasources
 *
 * **Details:**
 * - flag key: `awsDatasourcesHttpProxy`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAwsDatasourcesHttpProxy = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('awsDatasourcesHttpProxy', false, options);
};

/**
 * Enables http proxy settings for aws datasources
 *
 * **Details:**
 * - flag key: `awsDatasourcesHttpProxy`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAwsDatasourcesHttpProxy = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('awsDatasourcesHttpProxy', false, options);
};

/**
 * Support temporary security credentials in AWS plugins for Grafana Cloud customers
 *
 * **Details:**
 * - flag key: `awsDatasourcesTempCredentials`
 * - default value: `true`
 * - type: `boolean`
 */
export const useAwsDatasourcesTempCredentials = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('awsDatasourcesTempCredentials', true, options);
};

/**
 * Support temporary security credentials in AWS plugins for Grafana Cloud customers
 *
 * **Details:**
 * - flag key: `awsDatasourcesTempCredentials`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAwsDatasourcesTempCredentials = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('awsDatasourcesTempCredentials', true, options);
};

/**
 * Disables the log limit restriction for Azure Monitor when true. The limit is enabled by default.
 *
 * **Details:**
 * - flag key: `azureMonitorDisableLogLimit`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAzureMonitorDisableLogLimit = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('azureMonitorDisableLogLimit', false, options);
};

/**
 * Disables the log limit restriction for Azure Monitor when true. The limit is enabled by default.
 *
 * **Details:**
 * - flag key: `azureMonitorDisableLogLimit`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAzureMonitorDisableLogLimit = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('azureMonitorDisableLogLimit', false, options);
};

/**
 * Enables user auth for Azure Monitor datasource only
 *
 * **Details:**
 * - flag key: `azureMonitorEnableUserAuth`
 * - default value: `true`
 * - type: `boolean`
 */
export const useAzureMonitorEnableUserAuth = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('azureMonitorEnableUserAuth', true, options);
};

/**
 * Enables user auth for Azure Monitor datasource only
 *
 * **Details:**
 * - flag key: `azureMonitorEnableUserAuth`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAzureMonitorEnableUserAuth = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('azureMonitorEnableUserAuth', true, options);
};

/**
 * Enables the logs builder mode for the Azure Monitor data source
 *
 * **Details:**
 * - flag key: `azureMonitorLogsBuilderEditor`
 * - default value: `false`
 * - type: `boolean`
 */
export const useAzureMonitorLogsBuilderEditor = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('azureMonitorLogsBuilderEditor', false, options);
};

/**
 * Enables the logs builder mode for the Azure Monitor data source
 *
 * **Details:**
 * - flag key: `azureMonitorLogsBuilderEditor`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAzureMonitorLogsBuilderEditor = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('azureMonitorLogsBuilderEditor', false, options);
};

/**
 * Allows configuration of Azure Monitor as a data source that can provide Prometheus exemplars
 *
 * **Details:**
 * - flag key: `azureMonitorPrometheusExemplars`
 * - default value: `true`
 * - type: `boolean`
 */
export const useAzureMonitorPrometheusExemplars = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('azureMonitorPrometheusExemplars', true, options);
};

/**
 * Allows configuration of Azure Monitor as a data source that can provide Prometheus exemplars
 *
 * **Details:**
 * - flag key: `azureMonitorPrometheusExemplars`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAzureMonitorPrometheusExemplars = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('azureMonitorPrometheusExemplars', true, options);
};

/**
 * Enables the updated Azure Monitor resource picker
 *
 * **Details:**
 * - flag key: `azureResourcePickerUpdates`
 * - default value: `true`
 * - type: `boolean`
 */
export const useAzureResourcePickerUpdates = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('azureResourcePickerUpdates', true, options);
};

/**
 * Enables the updated Azure Monitor resource picker
 *
 * **Details:**
 * - flag key: `azureResourcePickerUpdates`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseAzureResourcePickerUpdates = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('azureResourcePickerUpdates', true, options);
};

/**
 * If enabled, the caching backend gradually serializes query responses for the cache, comparing against the configured `[caching]max_value_mb` value as it goes. This can can help prevent Grafana from running out of memory while attempting to cache very large query responses.
 *
 * **Details:**
 * - flag key: `cachingOptimizeSerializationMemoryUsage`
 * - default value: `false`
 * - type: `boolean`
 */
export const useCachingOptimizeSerializationMemoryUsage = (
  options?: ReactFlagEvaluationOptions
): FlagQuery<boolean> => {
  return useFlag('cachingOptimizeSerializationMemoryUsage', false, options);
};

/**
 * If enabled, the caching backend gradually serializes query responses for the cache, comparing against the configured `[caching]max_value_mb` value as it goes. This can can help prevent Grafana from running out of memory while attempting to cache very large query responses.
 *
 * **Details:**
 * - flag key: `cachingOptimizeSerializationMemoryUsage`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseCachingOptimizeSerializationMemoryUsage = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('cachingOptimizeSerializationMemoryUsage', false, options);
};

/**
 * Allow elements nesting
 *
 * **Details:**
 * - flag key: `canvasPanelNesting`
 * - default value: `false`
 * - type: `boolean`
 */
export const useCanvasPanelNesting = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('canvasPanelNesting', false, options);
};

/**
 * Allow elements nesting
 *
 * **Details:**
 * - flag key: `canvasPanelNesting`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseCanvasPanelNesting = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('canvasPanelNesting', false, options);
};

/**
 * Allow pan and zoom in canvas panel
 *
 * **Details:**
 * - flag key: `canvasPanelPanZoom`
 * - default value: `false`
 * - type: `boolean`
 */
export const useCanvasPanelPanZoom = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('canvasPanelPanZoom', false, options);
};

/**
 * Allow pan and zoom in canvas panel
 *
 * **Details:**
 * - flag key: `canvasPanelPanZoom`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseCanvasPanelPanZoom = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('canvasPanelPanZoom', false, options);
};

/**
 * Prioritize loading plugins from the CDN before other sources
 *
 * **Details:**
 * - flag key: `cdnPluginsLoadFirst`
 * - default value: `false`
 * - type: `boolean`
 */
export const useCdnPluginsLoadFirst = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('cdnPluginsLoadFirst', false, options);
};

/**
 * Prioritize loading plugins from the CDN before other sources
 *
 * **Details:**
 * - flag key: `cdnPluginsLoadFirst`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseCdnPluginsLoadFirst = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('cdnPluginsLoadFirst', false, options);
};

/**
 * Enable loading plugins via declarative URLs
 *
 * **Details:**
 * - flag key: `cdnPluginsUrls`
 * - default value: `false`
 * - type: `boolean`
 */
export const useCdnPluginsUrls = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('cdnPluginsUrls', false, options);
};

/**
 * Enable loading plugins via declarative URLs
 *
 * **Details:**
 * - flag key: `cdnPluginsUrls`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseCdnPluginsUrls = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('cdnPluginsUrls', false, options);
};

/**
 * Enabled grafana cloud specific RBAC roles
 *
 * **Details:**
 * - flag key: `cloudRBACRoles`
 * - default value: `false`
 * - type: `boolean`
 */
export const useCloudRbacroles = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('cloudRBACRoles', false, options);
};

/**
 * Enabled grafana cloud specific RBAC roles
 *
 * **Details:**
 * - flag key: `cloudRBACRoles`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseCloudRbacroles = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('cloudRBACRoles', false, options);
};

/**
 * Runs CloudWatch metrics queries as separate batches
 *
 * **Details:**
 * - flag key: `cloudWatchBatchQueries`
 * - default value: `false`
 * - type: `boolean`
 */
export const useCloudWatchBatchQueries = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('cloudWatchBatchQueries', false, options);
};

/**
 * Runs CloudWatch metrics queries as separate batches
 *
 * **Details:**
 * - flag key: `cloudWatchBatchQueries`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseCloudWatchBatchQueries = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('cloudWatchBatchQueries', false, options);
};

/**
 * Enables cross-account querying in CloudWatch datasources
 *
 * **Details:**
 * - flag key: `cloudWatchCrossAccountQuerying`
 * - default value: `true`
 * - type: `boolean`
 */
export const useCloudWatchCrossAccountQuerying = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('cloudWatchCrossAccountQuerying', true, options);
};

/**
 * Enables cross-account querying in CloudWatch datasources
 *
 * **Details:**
 * - flag key: `cloudWatchCrossAccountQuerying`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseCloudWatchCrossAccountQuerying = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('cloudWatchCrossAccountQuerying', true, options);
};

/**
 * Updates CloudWatch label parsing to be more accurate
 *
 * **Details:**
 * - flag key: `cloudWatchNewLabelParsing`
 * - default value: `true`
 * - type: `boolean`
 */
export const useCloudWatchNewLabelParsing = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('cloudWatchNewLabelParsing', true, options);
};

/**
 * Updates CloudWatch label parsing to be more accurate
 *
 * **Details:**
 * - flag key: `cloudWatchNewLabelParsing`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseCloudWatchNewLabelParsing = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('cloudWatchNewLabelParsing', true, options);
};

/**
 * Round up end time for metric queries to the next minute to avoid missing data
 *
 * **Details:**
 * - flag key: `cloudWatchRoundUpEndTime`
 * - default value: `true`
 * - type: `boolean`
 */
export const useCloudWatchRoundUpEndTime = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('cloudWatchRoundUpEndTime', true, options);
};

/**
 * Round up end time for metric queries to the next minute to avoid missing data
 *
 * **Details:**
 * - flag key: `cloudWatchRoundUpEndTime`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseCloudWatchRoundUpEndTime = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('cloudWatchRoundUpEndTime', true, options);
};

/**
 * Enable changing the scheduler base interval via configuration option unified_alerting.scheduler_tick_interval
 *
 * **Details:**
 * - flag key: `configurableSchedulerTick`
 * - default value: `false`
 * - type: `boolean`
 */
export const useConfigurableSchedulerTick = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('configurableSchedulerTick', false, options);
};

/**
 * Enable changing the scheduler base interval via configuration option unified_alerting.scheduler_tick_interval
 *
 * **Details:**
 * - flag key: `configurableSchedulerTick`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseConfigurableSchedulerTick = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('configurableSchedulerTick', false, options);
};

/**
 * Enables browser crash detection reporting to Faro.
 *
 * **Details:**
 * - flag key: `crashDetection`
 * - default value: `false`
 * - type: `boolean`
 */
export const useCrashDetection = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('crashDetection', false, options);
};

/**
 * Enables browser crash detection reporting to Faro.
 *
 * **Details:**
 * - flag key: `crashDetection`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseCrashDetection = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('crashDetection', false, options);
};

/**
 * Wraps the ad hoc and group by variables in a single wrapper, with all other variables below it
 *
 * **Details:**
 * - flag key: `dashboardAdHocAndGroupByWrapper`
 * - default value: `false`
 * - type: `boolean`
 */
export const useDashboardAdHocAndGroupByWrapper = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('dashboardAdHocAndGroupByWrapper', false, options);
};

/**
 * Wraps the ad hoc and group by variables in a single wrapper, with all other variables below it
 *
 * **Details:**
 * - flag key: `dashboardAdHocAndGroupByWrapper`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseDashboardAdHocAndGroupByWrapper = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('dashboardAdHocAndGroupByWrapper', false, options);
};

/**
 * Disable schema validation for dashboards/v1
 *
 * **Details:**
 * - flag key: `dashboardDisableSchemaValidationV1`
 * - default value: `false`
 * - type: `boolean`
 */
export const useDashboardDisableSchemaValidationV1 = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('dashboardDisableSchemaValidationV1', false, options);
};

/**
 * Disable schema validation for dashboards/v1
 *
 * **Details:**
 * - flag key: `dashboardDisableSchemaValidationV1`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseDashboardDisableSchemaValidationV1 = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('dashboardDisableSchemaValidationV1', false, options);
};

/**
 * Disable schema validation for dashboards/v2
 *
 * **Details:**
 * - flag key: `dashboardDisableSchemaValidationV2`
 * - default value: `false`
 * - type: `boolean`
 */
export const useDashboardDisableSchemaValidationV2 = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('dashboardDisableSchemaValidationV2', false, options);
};

/**
 * Disable schema validation for dashboards/v2
 *
 * **Details:**
 * - flag key: `dashboardDisableSchemaValidationV2`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseDashboardDisableSchemaValidationV2 = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('dashboardDisableSchemaValidationV2', false, options);
};

/**
 * Enables the dashboard filters overview pane
 *
 * **Details:**
 * - flag key: `dashboardFiltersOverview`
 * - default value: `false`
 * - type: `boolean`
 */
export const useDashboardFiltersOverview = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('dashboardFiltersOverview', false, options);
};

/**
 * Enables the dashboard filters overview pane
 *
 * **Details:**
 * - flag key: `dashboardFiltersOverview`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseDashboardFiltersOverview = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('dashboardFiltersOverview', false, options);
};

/**
 * Supports __from and __to macros that always use the dashboard level time range
 *
 * **Details:**
 * - flag key: `dashboardLevelTimeMacros`
 * - default value: `false`
 * - type: `boolean`
 */
export const useDashboardLevelTimeMacros = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('dashboardLevelTimeMacros', false, options);
};

/**
 * Supports __from and __to macros that always use the dashboard level time range
 *
 * **Details:**
 * - flag key: `dashboardLevelTimeMacros`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseDashboardLevelTimeMacros = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('dashboardLevelTimeMacros', false, options);
};

/**
 * Displays datasource provisioned dashboards in dashboard empty page, only when coming from datasource configuration page
 *
 * **Details:**
 * - flag key: `dashboardLibrary`
 * - default value: `false`
 * - type: `boolean`
 */
export const useDashboardLibrary = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('dashboardLibrary', false, options);
};

/**
 * Displays datasource provisioned dashboards in dashboard empty page, only when coming from datasource configuration page
 *
 * **Details:**
 * - flag key: `dashboardLibrary`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseDashboardLibrary = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('dashboardLibrary', false, options);
};

/**
 * Enables new dashboard layouts
 *
 * **Details:**
 * - flag key: `dashboardNewLayouts`
 * - default value: `false`
 * - type: `boolean`
 */
export const useDashboardNewLayouts = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('dashboardNewLayouts', false, options);
};

/**
 * Enables new dashboard layouts
 *
 * **Details:**
 * - flag key: `dashboardNewLayouts`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseDashboardNewLayouts = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('dashboardNewLayouts', false, options);
};

/**
 * Enables dashboard rendering using scenes for all roles
 *
 * **Details:**
 * - flag key: `dashboardScene`
 * - default value: `true`
 * - type: `boolean`
 */
export const useDashboardScene = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('dashboardScene', true, options);
};

/**
 * Enables dashboard rendering using scenes for all roles
 *
 * **Details:**
 * - flag key: `dashboardScene`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseDashboardScene = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('dashboardScene', true, options);
};

/**
 * Log schema validation errors so they can be analyzed later
 *
 * **Details:**
 * - flag key: `dashboardSchemaValidationLogging`
 * - default value: `false`
 * - type: `boolean`
 */
export const useDashboardSchemaValidationLogging = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('dashboardSchemaValidationLogging', false, options);
};

/**
 * Log schema validation errors so they can be analyzed later
 *
 * **Details:**
 * - flag key: `dashboardSchemaValidationLogging`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseDashboardSchemaValidationLogging = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('dashboardSchemaValidationLogging', false, options);
};

/**
 * Enables a flow to get started with a new dashboard from a template
 *
 * **Details:**
 * - flag key: `dashboardTemplates`
 * - default value: `false`
 * - type: `boolean`
 */
export const useDashboardTemplates = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('dashboardTemplates', false, options);
};

/**
 * Enables a flow to get started with a new dashboard from a template
 *
 * **Details:**
 * - flag key: `dashboardTemplates`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseDashboardTemplates = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('dashboardTemplates', false, options);
};

/**
 * Enables the Assistant button in the dashboard templates card
 *
 * **Details:**
 * - flag key: `dashboardTemplatesAssistantButton`
 * - default value: `false`
 * - type: `boolean`
 */
export const useDashboardTemplatesAssistantButton = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('dashboardTemplatesAssistantButton', false, options);
};

/**
 * Enables the Assistant button in the dashboard templates card
 *
 * **Details:**
 * - flag key: `dashboardTemplatesAssistantButton`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseDashboardTemplatesAssistantButton = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('dashboardTemplatesAssistantButton', false, options);
};

/**
 * Enables undo/redo in dynamic dashboards
 *
 * **Details:**
 * - flag key: `dashboardUndoRedo`
 * - default value: `false`
 * - type: `boolean`
 */
export const useDashboardUndoRedo = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('dashboardUndoRedo', false, options);
};

/**
 * Enables undo/redo in dynamic dashboards
 *
 * **Details:**
 * - flag key: `dashboardUndoRedo`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseDashboardUndoRedo = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('dashboardUndoRedo', false, options);
};

/**
 * Enables dashboard validator app to run compatibility checks between a dashboard and data source
 *
 * **Details:**
 * - flag key: `dashboardValidatorApp`
 * - default value: `false`
 * - type: `boolean`
 */
export const useDashboardValidatorApp = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('dashboardValidatorApp', false, options);
};

/**
 * Enables dashboard validator app to run compatibility checks between a dashboard and data source
 *
 * **Details:**
 * - flag key: `dashboardValidatorApp`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseDashboardValidatorApp = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('dashboardValidatorApp', false, options);
};

/**
 * Enable AI powered features in dashboards
 *
 * **Details:**
 * - flag key: `dashgpt`
 * - default value: `true`
 * - type: `boolean`
 */
export const useDashgpt = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('dashgpt', true, options);
};

/**
 * Enable AI powered features in dashboards
 *
 * **Details:**
 * - flag key: `dashgpt`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseDashgpt = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('dashgpt', true, options);
};

/**
 * Enable grafana dataplane aggregator
 *
 * **Details:**
 * - flag key: `dataplaneAggregator`
 * - default value: `false`
 * - type: `boolean`
 */
export const useDataplaneAggregator = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('dataplaneAggregator', false, options);
};

/**
 * Enable grafana dataplane aggregator
 *
 * **Details:**
 * - flag key: `dataplaneAggregator`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseDataplaneAggregator = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('dataplaneAggregator', false, options);
};

/**
 * Expose some datasources as apiservers.
 *
 * **Details:**
 * - flag key: `datasourceAPIServers`
 * - default value: `false`
 * - type: `boolean`
 */
export const useDatasourceApiservers = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('datasourceAPIServers', false, options);
};

/**
 * Expose some datasources as apiservers.
 *
 * **Details:**
 * - flag key: `datasourceAPIServers`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseDatasourceApiservers = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('datasourceAPIServers', false, options);
};

/**
 * Shows defined connections for a data source in the plugins detail page
 *
 * **Details:**
 * - flag key: `datasourceConnectionsTab`
 * - default value: `false`
 * - type: `boolean`
 */
export const useDatasourceConnectionsTab = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('datasourceConnectionsTab', false, options);
};

/**
 * Shows defined connections for a data source in the plugins detail page
 *
 * **Details:**
 * - flag key: `datasourceConnectionsTab`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseDatasourceConnectionsTab = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('datasourceConnectionsTab', false, options);
};

/**
 * Does not register datasource apis that use the numeric id
 *
 * **Details:**
 * - flag key: `datasourceDisableIdApi`
 * - default value: `false`
 * - type: `boolean`
 */
export const useDatasourceDisableIdApi = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('datasourceDisableIdApi', false, options);
};

/**
 * Does not register datasource apis that use the numeric id
 *
 * **Details:**
 * - flag key: `datasourceDisableIdApi`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseDatasourceDisableIdApi = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('datasourceDisableIdApi', false, options);
};

/**
 * Show query type endpoints in datasource API servers (currently hardcoded for testdata, expressions, and prometheus)
 *
 * **Details:**
 * - flag key: `datasourceQueryTypes`
 * - default value: `false`
 * - type: `boolean`
 */
export const useDatasourceQueryTypes = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('datasourceQueryTypes', false, options);
};

/**
 * Show query type endpoints in datasource API servers (currently hardcoded for testdata, expressions, and prometheus)
 *
 * **Details:**
 * - flag key: `datasourceQueryTypes`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseDatasourceQueryTypes = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('datasourceQueryTypes', false, options);
};

/**
 * Handle datasource resource requests to the legacy API routes by querying the new datasource api group endpoints behind the scenes.
 *
 * **Details:**
 * - flag key: `datasourcesApiServerEnableResourceEndpoint`
 * - default value: `false`
 * - type: `boolean`
 */
export const useDatasourcesApiServerEnableResourceEndpoint = (
  options?: ReactFlagEvaluationOptions
): FlagQuery<boolean> => {
  return useFlag('datasourcesApiServerEnableResourceEndpoint', false, options);
};

/**
 * Handle datasource resource requests to the legacy API routes by querying the new datasource api group endpoints behind the scenes.
 *
 * **Details:**
 * - flag key: `datasourcesApiServerEnableResourceEndpoint`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseDatasourcesApiServerEnableResourceEndpoint = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('datasourcesApiServerEnableResourceEndpoint', false, options);
};

/**
 * Send Datsource resource requests to K8s /apis/ API routes instead of the legacy /api/datasources/uid/{uid}/resources/{path} routes.
 *
 * **Details:**
 * - flag key: `datasourcesApiServerEnableResourceEndpointFrontend`
 * - default value: `false`
 * - type: `boolean`
 */
export const useDatasourcesApiServerEnableResourceEndpointFrontend = (
  options?: ReactFlagEvaluationOptions
): FlagQuery<boolean> => {
  return useFlag('datasourcesApiServerEnableResourceEndpointFrontend', false, options);
};

/**
 * Send Datsource resource requests to K8s /apis/ API routes instead of the legacy /api/datasources/uid/{uid}/resources/{path} routes.
 *
 * **Details:**
 * - flag key: `datasourcesApiServerEnableResourceEndpointFrontend`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseDatasourcesApiServerEnableResourceEndpointFrontend = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('datasourcesApiServerEnableResourceEndpointFrontend', false, options);
};

/**
 * Handle datasource CRUD requests to the legacy API routes by querying the new datasource api group endpoints behind the scenes.
 *
 * **Details:**
 * - flag key: `datasourcesRerouteLegacyCRUDAPIs`
 * - default value: `false`
 * - type: `boolean`
 */
export const useDatasourcesRerouteLegacyCrudapis = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('datasourcesRerouteLegacyCRUDAPIs', false, options);
};

/**
 * Handle datasource CRUD requests to the legacy API routes by querying the new datasource api group endpoints behind the scenes.
 *
 * **Details:**
 * - flag key: `datasourcesRerouteLegacyCRUDAPIs`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseDatasourcesRerouteLegacyCrudapis = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('datasourcesRerouteLegacyCRUDAPIs', false, options);
};

/**
 * In server-side expressions, disable the sorting of numeric-kind metrics by their metric name or labels.
 *
 * **Details:**
 * - flag key: `disableNumericMetricsSortingInExpressions`
 * - default value: `false`
 * - type: `boolean`
 */
export const useDisableNumericMetricsSortingInExpressions = (
  options?: ReactFlagEvaluationOptions
): FlagQuery<boolean> => {
  return useFlag('disableNumericMetricsSortingInExpressions', false, options);
};

/**
 * In server-side expressions, disable the sorting of numeric-kind metrics by their metric name or labels.
 *
 * **Details:**
 * - flag key: `disableNumericMetricsSortingInExpressions`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseDisableNumericMetricsSortingInExpressions = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('disableNumericMetricsSortingInExpressions', false, options);
};

/**
 * Disables dataplane specific processing in server side expressions.
 *
 * **Details:**
 * - flag key: `disableSSEDataplane`
 * - default value: `false`
 * - type: `boolean`
 */
export const useDisableSsedataplane = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('disableSSEDataplane', false, options);
};

/**
 * Disables dataplane specific processing in server side expressions.
 *
 * **Details:**
 * - flag key: `disableSSEDataplane`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseDisableSsedataplane = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('disableSSEDataplane', false, options);
};

/**
 * Enables showing recently used drilldowns or recommendations given by the datasource in the AdHocFilters and GroupBy variables
 *
 * **Details:**
 * - flag key: `drilldownRecommendations`
 * - default value: `false`
 * - type: `boolean`
 */
export const useDrilldownRecommendations = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('drilldownRecommendations', false, options);
};

/**
 * Enables showing recently used drilldowns or recommendations given by the datasource in the AdHocFilters and GroupBy variables
 *
 * **Details:**
 * - flag key: `drilldownRecommendations`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseDrilldownRecommendations = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('drilldownRecommendations', false, options);
};

/**
 * Enables cross cluster search in the Elasticsearch data source
 *
 * **Details:**
 * - flag key: `elasticsearchCrossClusterSearch`
 * - default value: `false`
 * - type: `boolean`
 */
export const useElasticsearchCrossClusterSearch = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('elasticsearchCrossClusterSearch', false, options);
};

/**
 * Enables cross cluster search in the Elasticsearch data source
 *
 * **Details:**
 * - flag key: `elasticsearchCrossClusterSearch`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseElasticsearchCrossClusterSearch = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('elasticsearchCrossClusterSearch', false, options);
};

/**
 * Enables less memory intensive Elasticsearch result parsing
 *
 * **Details:**
 * - flag key: `elasticsearchImprovedParsing`
 * - default value: `false`
 * - type: `boolean`
 */
export const useElasticsearchImprovedParsing = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('elasticsearchImprovedParsing', false, options);
};

/**
 * Enables less memory intensive Elasticsearch result parsing
 *
 * **Details:**
 * - flag key: `elasticsearchImprovedParsing`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseElasticsearchImprovedParsing = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('elasticsearchImprovedParsing', false, options);
};

/**
 * Enables the raw DSL query editor in the Elasticsearch data source
 *
 * **Details:**
 * - flag key: `elasticsearchRawDSLQuery`
 * - default value: `false`
 * - type: `boolean`
 */
export const useElasticsearchRawDslquery = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('elasticsearchRawDSLQuery', false, options);
};

/**
 * Enables the raw DSL query editor in the Elasticsearch data source
 *
 * **Details:**
 * - flag key: `elasticsearchRawDSLQuery`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseElasticsearchRawDslquery = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('elasticsearchRawDSLQuery', false, options);
};

/**
 * Set this to true to enable all app chrome extensions registered by plugins.
 *
 * **Details:**
 * - flag key: `enableAppChromeExtensions`
 * - default value: `false`
 * - type: `boolean`
 */
export const useEnableAppChromeExtensions = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('enableAppChromeExtensions', false, options);
};

/**
 * Set this to true to enable all app chrome extensions registered by plugins.
 *
 * **Details:**
 * - flag key: `enableAppChromeExtensions`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseEnableAppChromeExtensions = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('enableAppChromeExtensions', false, options);
};

/**
 * Set this to true to enable all dashboard empty state extensions registered by plugins.
 *
 * **Details:**
 * - flag key: `enableDashboardEmptyExtensions`
 * - default value: `false`
 * - type: `boolean`
 */
export const useEnableDashboardEmptyExtensions = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('enableDashboardEmptyExtensions', false, options);
};

/**
 * Set this to true to enable all dashboard empty state extensions registered by plugins.
 *
 * **Details:**
 * - flag key: `enableDashboardEmptyExtensions`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseEnableDashboardEmptyExtensions = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('enableDashboardEmptyExtensions', false, options);
};

/**
 * Enables the edit functionality in the datagrid panel
 *
 * **Details:**
 * - flag key: `enableDatagridEditing`
 * - default value: `false`
 * - type: `boolean`
 */
export const useEnableDatagridEditing = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('enableDatagridEditing', false, options);
};

/**
 * Enables the edit functionality in the datagrid panel
 *
 * **Details:**
 * - flag key: `enableDatagridEditing`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseEnableDatagridEditing = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('enableDatagridEditing', false, options);
};

/**
 * Enables the extension admin page regardless of development mode
 *
 * **Details:**
 * - flag key: `enableExtensionsAdminPage`
 * - default value: `false`
 * - type: `boolean`
 */
export const useEnableExtensionsAdminPage = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('enableExtensionsAdminPage', false, options);
};

/**
 * Enables the extension admin page regardless of development mode
 *
 * **Details:**
 * - flag key: `enableExtensionsAdminPage`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseEnableExtensionsAdminPage = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('enableExtensionsAdminPage', false, options);
};

/**
 * Enables SCIM support for user and group management
 *
 * **Details:**
 * - flag key: `enableSCIM`
 * - default value: `true`
 * - type: `boolean`
 */
export const useEnableScim = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('enableSCIM', true, options);
};

/**
 * Enables SCIM support for user and group management
 *
 * **Details:**
 * - flag key: `enableSCIM`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseEnableScim = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('enableSCIM', true, options);
};

/**
 * Enables the scopes usage in Metrics Explore
 *
 * **Details:**
 * - flag key: `enableScopesInMetricsExplore`
 * - default value: `false`
 * - type: `boolean`
 */
export const useEnableScopesInMetricsExplore = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('enableScopesInMetricsExplore', false, options);
};

/**
 * Enables the scopes usage in Metrics Explore
 *
 * **Details:**
 * - flag key: `enableScopesInMetricsExplore`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseEnableScopesInMetricsExplore = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('enableScopesInMetricsExplore', false, options);
};

/**
 * Exclude redundant individual dashboard/folder permissions from managed roles at query time
 *
 * **Details:**
 * - flag key: `excludeRedundantManagedPermissions`
 * - default value: `false`
 * - type: `boolean`
 */
export const useExcludeRedundantManagedPermissions = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('excludeRedundantManagedPermissions', false, options);
};

/**
 * Exclude redundant individual dashboard/folder permissions from managed roles at query time
 *
 * **Details:**
 * - flag key: `excludeRedundantManagedPermissions`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseExcludeRedundantManagedPermissions = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('excludeRedundantManagedPermissions', false, options);
};

/**
 * A/A test for recently viewed dashboards feature
 *
 * **Details:**
 * - flag key: `experimentRecentlyViewedDashboards`
 * - default value: `false`
 * - type: `boolean`
 */
export const useExperimentRecentlyViewedDashboards = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('experimentRecentlyViewedDashboards', false, options);
};

/**
 * A/A test for recently viewed dashboards feature
 *
 * **Details:**
 * - flag key: `experimentRecentlyViewedDashboards`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseExperimentRecentlyViewedDashboards = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('experimentRecentlyViewedDashboards', false, options);
};

/**
 * Used in Logs Drilldown to query by aggregated metrics
 *
 * **Details:**
 * - flag key: `exploreLogsAggregatedMetrics`
 * - default value: `false`
 * - type: `boolean`
 */
export const useExploreLogsAggregatedMetrics = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('exploreLogsAggregatedMetrics', false, options);
};

/**
 * Used in Logs Drilldown to query by aggregated metrics
 *
 * **Details:**
 * - flag key: `exploreLogsAggregatedMetrics`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseExploreLogsAggregatedMetrics = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('exploreLogsAggregatedMetrics', false, options);
};

/**
 * Deprecated. Replace with lokiShardSplitting. Used in Logs Drilldown to split queries into multiple queries based on the number of shards
 *
 * **Details:**
 * - flag key: `exploreLogsShardSplitting`
 * - default value: `false`
 * - type: `boolean`
 */
export const useExploreLogsShardSplitting = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('exploreLogsShardSplitting', false, options);
};

/**
 * Deprecated. Replace with lokiShardSplitting. Used in Logs Drilldown to split queries into multiple queries based on the number of shards
 *
 * **Details:**
 * - flag key: `exploreLogsShardSplitting`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseExploreLogsShardSplitting = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('exploreLogsShardSplitting', false, options);
};

/**
 * Automatic service account and token setup for plugins
 *
 * **Details:**
 * - flag key: `externalServiceAccounts`
 * - default value: `false`
 * - type: `boolean`
 */
export const useExternalServiceAccounts = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('externalServiceAccounts', false, options);
};

/**
 * Automatic service account and token setup for plugins
 *
 * **Details:**
 * - flag key: `externalServiceAccounts`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseExternalServiceAccounts = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('externalServiceAccounts', false, options);
};

/**
 * Enable all plugins to supply visualization suggestions (including 3rd party plugins)
 *
 * **Details:**
 * - flag key: `externalVizSuggestions`
 * - default value: `false`
 * - type: `boolean`
 */
export const useExternalVizSuggestions = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('externalVizSuggestions', false, options);
};

/**
 * Enable all plugins to supply visualization suggestions (including 3rd party plugins)
 *
 * **Details:**
 * - flag key: `externalVizSuggestions`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseExternalVizSuggestions = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('externalVizSuggestions', false, options);
};

/**
 * Enable the data source selector within the Frontend Apps section of the Frontend Observability
 *
 * **Details:**
 * - flag key: `faroDatasourceSelector`
 * - default value: `false`
 * - type: `boolean`
 */
export const useFaroDatasourceSelector = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('faroDatasourceSelector', false, options);
};

/**
 * Enable the data source selector within the Frontend Apps section of the Frontend Observability
 *
 * **Details:**
 * - flag key: `faroDatasourceSelector`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseFaroDatasourceSelector = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('faroDatasourceSelector', false, options);
};

/**
 * Enable Faro session replay for Grafana
 *
 * **Details:**
 * - flag key: `faroSessionReplay`
 * - default value: `false`
 * - type: `boolean`
 */
export const useFaroSessionReplay = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('faroSessionReplay', false, options);
};

/**
 * Enable Faro session replay for Grafana
 *
 * **Details:**
 * - flag key: `faroSessionReplay`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseFaroSessionReplay = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('faroSessionReplay', false, options);
};

/**
 * Enable favorite datasources
 *
 * **Details:**
 * - flag key: `favoriteDatasources`
 * - default value: `false`
 * - type: `boolean`
 */
export const useFavoriteDatasources = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('favoriteDatasources', false, options);
};

/**
 * Enable favorite datasources
 *
 * **Details:**
 * - flag key: `favoriteDatasources`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseFavoriteDatasources = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('favoriteDatasources', false, options);
};

/**
 * Highlight Grafana Enterprise features
 *
 * **Details:**
 * - flag key: `featureHighlights`
 * - default value: `false`
 * - type: `boolean`
 */
export const useFeatureHighlights = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('featureHighlights', false, options);
};

/**
 * Highlight Grafana Enterprise features
 *
 * **Details:**
 * - flag key: `featureHighlights`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseFeatureHighlights = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('featureHighlights', false, options);
};

/**
 * Add compact=true when fetching rules
 *
 * **Details:**
 * - flag key: `fetchRulesInCompactMode`
 * - default value: `false`
 * - type: `boolean`
 */
export const useFetchRulesInCompactMode = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('fetchRulesInCompactMode', false, options);
};

/**
 * Add compact=true when fetching rules
 *
 * **Details:**
 * - flag key: `fetchRulesInCompactMode`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseFetchRulesInCompactMode = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('fetchRulesInCompactMode', false, options);
};

/**
 * Use a POST request to list rules by passing down the namespaces user has access to
 *
 * **Details:**
 * - flag key: `fetchRulesUsingPost`
 * - default value: `false`
 * - type: `boolean`
 */
export const useFetchRulesUsingPost = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('fetchRulesUsingPost', false, options);
};

/**
 * Use a POST request to list rules by passing down the namespaces user has access to
 *
 * **Details:**
 * - flag key: `fetchRulesUsingPost`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseFetchRulesUsingPost = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('fetchRulesUsingPost', false, options);
};

/**
 * Enables use of app platform API for folders
 *
 * **Details:**
 * - flag key: `foldersAppPlatformAPI`
 * - default value: `false`
 * - type: `boolean`
 */
export const useFoldersAppPlatformApi = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('foldersAppPlatformAPI', false, options);
};

/**
 * Enables use of app platform API for folders
 *
 * **Details:**
 * - flag key: `foldersAppPlatformAPI`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseFoldersAppPlatformApi = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('foldersAppPlatformAPI', false, options);
};

/**
 * Enables the frontend service to fetch tenant-specific settings overrides from the settings service
 *
 * **Details:**
 * - flag key: `frontendServiceUseSettingsService`
 * - default value: `false`
 * - type: `boolean`
 */
export const useFrontendServiceUseSettingsService = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('frontendServiceUseSettingsService', false, options);
};

/**
 * Enables the frontend service to fetch tenant-specific settings overrides from the settings service
 *
 * **Details:**
 * - flag key: `frontendServiceUseSettingsService`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseFrontendServiceUseSettingsService = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('frontendServiceUseSettingsService', false, options);
};

/**
 * Whether to use the new SharedPreferences functional component
 *
 * **Details:**
 * - flag key: `functionalSharedPreferences`
 * - default value: `false`
 * - type: `boolean`
 */
export const useFunctionalSharedPreferences = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('functionalSharedPreferences', false, options);
};

/**
 * Whether to use the new SharedPreferences functional component
 *
 * **Details:**
 * - flag key: `functionalSharedPreferences`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseFunctionalSharedPreferences = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('functionalSharedPreferences', false, options);
};

/**
 * Start an additional https handler and write kubectl options
 *
 * **Details:**
 * - flag key: `grafanaAPIServerEnsureKubectlAccess`
 * - default value: `false`
 * - type: `boolean`
 */
export const useGrafanaApiserverEnsureKubectlAccess = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('grafanaAPIServerEnsureKubectlAccess', false, options);
};

/**
 * Start an additional https handler and write kubectl options
 *
 * **Details:**
 * - flag key: `grafanaAPIServerEnsureKubectlAccess`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseGrafanaApiserverEnsureKubectlAccess = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('grafanaAPIServerEnsureKubectlAccess', false, options);
};

/**
 * Register experimental APIs with the k8s API server, including all datasources
 *
 * **Details:**
 * - flag key: `grafanaAPIServerWithExperimentalAPIs`
 * - default value: `false`
 * - type: `boolean`
 */
export const useGrafanaApiserverWithExperimentalApis = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('grafanaAPIServerWithExperimentalAPIs', false, options);
};

/**
 * Register experimental APIs with the k8s API server, including all datasources
 *
 * **Details:**
 * - flag key: `grafanaAPIServerWithExperimentalAPIs`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseGrafanaApiserverWithExperimentalApis = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('grafanaAPIServerWithExperimentalAPIs', false, options);
};

/**
 * Enables Advisor app
 *
 * **Details:**
 * - flag key: `grafanaAdvisor`
 * - default value: `false`
 * - type: `boolean`
 */
export const useGrafanaAdvisor = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('grafanaAdvisor', false, options);
};

/**
 * Enables Advisor app
 *
 * **Details:**
 * - flag key: `grafanaAdvisor`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseGrafanaAdvisor = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('grafanaAdvisor', false, options);
};

/**
 * Enables integration with Grafana Assistant in Profiles Drilldown
 *
 * **Details:**
 * - flag key: `grafanaAssistantInProfilesDrilldown`
 * - default value: `true`
 * - type: `boolean`
 */
export const useGrafanaAssistantInProfilesDrilldown = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('grafanaAssistantInProfilesDrilldown', true, options);
};

/**
 * Enables integration with Grafana Assistant in Profiles Drilldown
 *
 * **Details:**
 * - flag key: `grafanaAssistantInProfilesDrilldown`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseGrafanaAssistantInProfilesDrilldown = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('grafanaAssistantInProfilesDrilldown', true, options);
};

/**
 * Enables Grafana-managed recording rules.
 *
 * **Details:**
 * - flag key: `grafanaManagedRecordingRules`
 * - default value: `false`
 * - type: `boolean`
 */
export const useGrafanaManagedRecordingRules = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('grafanaManagedRecordingRules', false, options);
};

/**
 * Enables Grafana-managed recording rules.
 *
 * **Details:**
 * - flag key: `grafanaManagedRecordingRules`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseGrafanaManagedRecordingRules = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('grafanaManagedRecordingRules', false, options);
};

/**
 * Enables the temporary themes for GrafanaCon
 *
 * **Details:**
 * - flag key: `grafanaconThemes`
 * - default value: `true`
 * - type: `boolean`
 */
export const useGrafanaconThemes = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('grafanaconThemes', true, options);
};

/**
 * Enables the temporary themes for GrafanaCon
 *
 * **Details:**
 * - flag key: `grafanaconThemes`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseGrafanaconThemes = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('grafanaconThemes', true, options);
};

/**
 * Enables the Graphite data source full backend mode
 *
 * **Details:**
 * - flag key: `graphiteBackendMode`
 * - default value: `false`
 * - type: `boolean`
 */
export const useGraphiteBackendMode = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('graphiteBackendMode', false, options);
};

/**
 * Enables the Graphite data source full backend mode
 *
 * **Details:**
 * - flag key: `graphiteBackendMode`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseGraphiteBackendMode = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('graphiteBackendMode', false, options);
};

/**
 * Enable the groupsync extension for managing Group Attribute Sync feature
 *
 * **Details:**
 * - flag key: `groupAttributeSync`
 * - default value: `false`
 * - type: `boolean`
 */
export const useGroupAttributeSync = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('groupAttributeSync', false, options);
};

/**
 * Enable the groupsync extension for managing Group Attribute Sync feature
 *
 * **Details:**
 * - flag key: `groupAttributeSync`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseGroupAttributeSync = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('groupAttributeSync', false, options);
};

/**
 * Enable groupBy variable support in scenes dashboards
 *
 * **Details:**
 * - flag key: `groupByVariable`
 * - default value: `false`
 * - type: `boolean`
 */
export const useGroupByVariable = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('groupByVariable', false, options);
};

/**
 * Enable groupBy variable support in scenes dashboards
 *
 * **Details:**
 * - flag key: `groupByVariable`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseGroupByVariable = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('groupByVariable', false, options);
};

/**
 * Run the GRPC server
 *
 * **Details:**
 * - flag key: `grpcServer`
 * - default value: `false`
 * - type: `boolean`
 */
export const useGrpcServer = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('grpcServer', false, options);
};

/**
 * Run the GRPC server
 *
 * **Details:**
 * - flag key: `grpcServer`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseGrpcServer = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('grpcServer', false, options);
};

/**
 * Enable Y-axis scale configuration options for pre-bucketed heatmap data (heatmap-rows)
 *
 * **Details:**
 * - flag key: `heatmapRowsAxisOptions`
 * - default value: `false`
 * - type: `boolean`
 */
export const useHeatmapRowsAxisOptions = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('heatmapRowsAxisOptions', false, options);
};

/**
 * Enable Y-axis scale configuration options for pre-bucketed heatmap data (heatmap-rows)
 *
 * **Details:**
 * - flag key: `heatmapRowsAxisOptions`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseHeatmapRowsAxisOptions = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('heatmapRowsAxisOptions', false, options);
};

/**
 * Enables improved support for OAuth external sessions. After enabling this feature, users might need to re-authenticate themselves.
 *
 * **Details:**
 * - flag key: `improvedExternalSessionHandling`
 * - default value: `true`
 * - type: `boolean`
 */
export const useImprovedExternalSessionHandling = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('improvedExternalSessionHandling', true, options);
};

/**
 * Enables improved support for OAuth external sessions. After enabling this feature, users might need to re-authenticate themselves.
 *
 * **Details:**
 * - flag key: `improvedExternalSessionHandling`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseImprovedExternalSessionHandling = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('improvedExternalSessionHandling', true, options);
};

/**
 * Enables improved support for SAML external sessions. Ensure the NameID format is correctly configured in Grafana for SAML Single Logout to function properly.
 *
 * **Details:**
 * - flag key: `improvedExternalSessionHandlingSAML`
 * - default value: `true`
 * - type: `boolean`
 */
export const useImprovedExternalSessionHandlingSaml = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('improvedExternalSessionHandlingSAML', true, options);
};

/**
 * Enables improved support for SAML external sessions. Ensure the NameID format is correctly configured in Grafana for SAML Single Logout to function properly.
 *
 * **Details:**
 * - flag key: `improvedExternalSessionHandlingSAML`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseImprovedExternalSessionHandlingSaml = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('improvedExternalSessionHandlingSAML', true, options);
};

/**
 * Enables running Infinity queries in parallel
 *
 * **Details:**
 * - flag key: `infinityRunQueriesInParallel`
 * - default value: `false`
 * - type: `boolean`
 */
export const useInfinityRunQueriesInParallel = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('infinityRunQueriesInParallel', false, options);
};

/**
 * Enables running Infinity queries in parallel
 *
 * **Details:**
 * - flag key: `infinityRunQueriesInParallel`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseInfinityRunQueriesInParallel = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('infinityRunQueriesInParallel', false, options);
};

/**
 * Query InfluxDB InfluxQL without the proxy
 *
 * **Details:**
 * - flag key: `influxdbBackendMigration`
 * - default value: `true`
 * - type: `boolean`
 */
export const useInfluxdbBackendMigration = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('influxdbBackendMigration', true, options);
};

/**
 * Query InfluxDB InfluxQL without the proxy
 *
 * **Details:**
 * - flag key: `influxdbBackendMigration`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseInfluxdbBackendMigration = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('influxdbBackendMigration', true, options);
};

/**
 * Enables running InfluxDB Influxql queries in parallel
 *
 * **Details:**
 * - flag key: `influxdbRunQueriesInParallel`
 * - default value: `false`
 * - type: `boolean`
 */
export const useInfluxdbRunQueriesInParallel = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('influxdbRunQueriesInParallel', false, options);
};

/**
 * Enables running InfluxDB Influxql queries in parallel
 *
 * **Details:**
 * - flag key: `influxdbRunQueriesInParallel`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseInfluxdbRunQueriesInParallel = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('influxdbRunQueriesInParallel', false, options);
};

/**
 * Enable streaming JSON parser for InfluxDB datasource InfluxQL query language
 *
 * **Details:**
 * - flag key: `influxqlStreamingParser`
 * - default value: `false`
 * - type: `boolean`
 */
export const useInfluxqlStreamingParser = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('influxqlStreamingParser', false, options);
};

/**
 * Enable streaming JSON parser for InfluxDB datasource InfluxQL query language
 *
 * **Details:**
 * - flag key: `influxqlStreamingParser`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseInfluxqlStreamingParser = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('influxqlStreamingParser', false, options);
};

/**
 * Enables the interactive learning app
 *
 * **Details:**
 * - flag key: `interactiveLearning`
 * - default value: `false`
 * - type: `boolean`
 */
export const useInteractiveLearning = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('interactiveLearning', false, options);
};

/**
 * Enables the interactive learning app
 *
 * **Details:**
 * - flag key: `interactiveLearning`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseInteractiveLearning = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('interactiveLearning', false, options);
};

/**
 * Enable querying trace data through Jaeger's gRPC endpoint (HTTP)
 *
 * **Details:**
 * - flag key: `jaegerEnableGrpcEndpoint`
 * - default value: `false`
 * - type: `boolean`
 */
export const useJaegerEnableGrpcEndpoint = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('jaegerEnableGrpcEndpoint', false, options);
};

/**
 * Enable querying trace data through Jaeger's gRPC endpoint (HTTP)
 *
 * **Details:**
 * - flag key: `jaegerEnableGrpcEndpoint`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseJaegerEnableGrpcEndpoint = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('jaegerEnableGrpcEndpoint', false, options);
};

/**
 * Distributes alert rule evaluations more evenly over time, including spreading out rules within the same group. Disables sequential evaluation if enabled.
 *
 * **Details:**
 * - flag key: `jitterAlertRulesWithinGroups`
 * - default value: `false`
 * - type: `boolean`
 */
export const useJitterAlertRulesWithinGroups = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('jitterAlertRulesWithinGroups', false, options);
};

/**
 * Distributes alert rule evaluations more evenly over time, including spreading out rules within the same group. Disables sequential evaluation if enabled.
 *
 * **Details:**
 * - flag key: `jitterAlertRulesWithinGroups`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseJitterAlertRulesWithinGroups = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('jitterAlertRulesWithinGroups', false, options);
};

/**
 * Enable folder's api server counts
 *
 * **Details:**
 * - flag key: `k8SFolderCounts`
 * - default value: `false`
 * - type: `boolean`
 */
export const useK8SfolderCounts = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('k8SFolderCounts', false, options);
};

/**
 * Enable folder's api server counts
 *
 * **Details:**
 * - flag key: `k8SFolderCounts`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseK8SfolderCounts = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('k8SFolderCounts', false, options);
};

/**
 * Enable grafana's embedded kube-aggregator
 *
 * **Details:**
 * - flag key: `kubernetesAggregator`
 * - default value: `false`
 * - type: `boolean`
 */
export const useKubernetesAggregator = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('kubernetesAggregator', false, options);
};

/**
 * Enable grafana's embedded kube-aggregator
 *
 * **Details:**
 * - flag key: `kubernetesAggregator`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseKubernetesAggregator = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('kubernetesAggregator', false, options);
};

/**
 * Enable CAP token based authentication in grafana's embedded kube-aggregator
 *
 * **Details:**
 * - flag key: `kubernetesAggregatorCapTokenAuth`
 * - default value: `false`
 * - type: `boolean`
 */
export const useKubernetesAggregatorCapTokenAuth = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('kubernetesAggregatorCapTokenAuth', false, options);
};

/**
 * Enable CAP token based authentication in grafana's embedded kube-aggregator
 *
 * **Details:**
 * - flag key: `kubernetesAggregatorCapTokenAuth`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseKubernetesAggregatorCapTokenAuth = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('kubernetesAggregatorCapTokenAuth', false, options);
};

/**
 * Adds support for Kubernetes alerting historian APIs
 *
 * **Details:**
 * - flag key: `kubernetesAlertingHistorian`
 * - default value: `false`
 * - type: `boolean`
 */
export const useKubernetesAlertingHistorian = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('kubernetesAlertingHistorian', false, options);
};

/**
 * Adds support for Kubernetes alerting historian APIs
 *
 * **Details:**
 * - flag key: `kubernetesAlertingHistorian`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseKubernetesAlertingHistorian = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('kubernetesAlertingHistorian', false, options);
};

/**
 * Adds support for Kubernetes alerting and recording rules
 *
 * **Details:**
 * - flag key: `kubernetesAlertingRules`
 * - default value: `false`
 * - type: `boolean`
 */
export const useKubernetesAlertingRules = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('kubernetesAlertingRules', false, options);
};

/**
 * Adds support for Kubernetes alerting and recording rules
 *
 * **Details:**
 * - flag key: `kubernetesAlertingRules`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseKubernetesAlertingRules = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('kubernetesAlertingRules', false, options);
};

/**
 * Deprecated: Use kubernetesAuthZResourcePermissionsRedirect and kubernetesAuthZRolesRedirect instead
 *
 * **Details:**
 * - flag key: `kubernetesAuthZHandlerRedirect`
 * - default value: `false`
 * - type: `boolean`
 */
export const useKubernetesAuthZhandlerRedirect = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('kubernetesAuthZHandlerRedirect', false, options);
};

/**
 * Deprecated: Use kubernetesAuthZResourcePermissionsRedirect and kubernetesAuthZRolesRedirect instead
 *
 * **Details:**
 * - flag key: `kubernetesAuthZHandlerRedirect`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseKubernetesAuthZhandlerRedirect = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('kubernetesAuthZHandlerRedirect', false, options);
};

/**
 * Redirects the traffic from the legacy resource permissions endpoints to the new K8s AuthZ endpoints
 *
 * **Details:**
 * - flag key: `kubernetesAuthZResourcePermissionsRedirect`
 * - default value: `false`
 * - type: `boolean`
 */
export const useKubernetesAuthZresourcePermissionsRedirect = (
  options?: ReactFlagEvaluationOptions
): FlagQuery<boolean> => {
  return useFlag('kubernetesAuthZResourcePermissionsRedirect', false, options);
};

/**
 * Redirects the traffic from the legacy resource permissions endpoints to the new K8s AuthZ endpoints
 *
 * **Details:**
 * - flag key: `kubernetesAuthZResourcePermissionsRedirect`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseKubernetesAuthZresourcePermissionsRedirect = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('kubernetesAuthZResourcePermissionsRedirect', false, options);
};

/**
 * Redirects the traffic from the legacy roles endpoints to the new K8s AuthZ endpoints
 *
 * **Details:**
 * - flag key: `kubernetesAuthZRolesRedirect`
 * - default value: `false`
 * - type: `boolean`
 */
export const useKubernetesAuthZrolesRedirect = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('kubernetesAuthZRolesRedirect', false, options);
};

/**
 * Redirects the traffic from the legacy roles endpoints to the new K8s AuthZ endpoints
 *
 * **Details:**
 * - flag key: `kubernetesAuthZRolesRedirect`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseKubernetesAuthZrolesRedirect = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('kubernetesAuthZRolesRedirect', false, options);
};

/**
 * Enables create, delete, and update mutations for resources owned by IAM identity
 *
 * **Details:**
 * - flag key: `kubernetesAuthnMutation`
 * - default value: `false`
 * - type: `boolean`
 */
export const useKubernetesAuthnMutation = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('kubernetesAuthnMutation', false, options);
};

/**
 * Enables create, delete, and update mutations for resources owned by IAM identity
 *
 * **Details:**
 * - flag key: `kubernetesAuthnMutation`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseKubernetesAuthnMutation = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('kubernetesAuthnMutation', false, options);
};

/**
 * Deprecated: Use kubernetesAuthzCoreRolesApi, kubernetesAuthzRolesApi, and kubernetesAuthzRoleBindingsApi instead
 *
 * **Details:**
 * - flag key: `kubernetesAuthzApis`
 * - default value: `false`
 * - type: `boolean`
 */
export const useKubernetesAuthzApis = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('kubernetesAuthzApis', false, options);
};

/**
 * Deprecated: Use kubernetesAuthzCoreRolesApi, kubernetesAuthzRolesApi, and kubernetesAuthzRoleBindingsApi instead
 *
 * **Details:**
 * - flag key: `kubernetesAuthzApis`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseKubernetesAuthzApis = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('kubernetesAuthzApis', false, options);
};

/**
 * Registers AuthZ Core Roles /apis endpoint
 *
 * **Details:**
 * - flag key: `kubernetesAuthzCoreRolesApi`
 * - default value: `false`
 * - type: `boolean`
 */
export const useKubernetesAuthzCoreRolesApi = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('kubernetesAuthzCoreRolesApi', false, options);
};

/**
 * Registers AuthZ Core Roles /apis endpoint
 *
 * **Details:**
 * - flag key: `kubernetesAuthzCoreRolesApi`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseKubernetesAuthzCoreRolesApi = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('kubernetesAuthzCoreRolesApi', false, options);
};

/**
 * Registers AuthZ Global Roles /apis endpoint
 *
 * **Details:**
 * - flag key: `kubernetesAuthzGlobalRolesApi`
 * - default value: `false`
 * - type: `boolean`
 */
export const useKubernetesAuthzGlobalRolesApi = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('kubernetesAuthzGlobalRolesApi', false, options);
};

/**
 * Registers AuthZ Global Roles /apis endpoint
 *
 * **Details:**
 * - flag key: `kubernetesAuthzGlobalRolesApi`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseKubernetesAuthzGlobalRolesApi = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('kubernetesAuthzGlobalRolesApi', false, options);
};

/**
 * Registers AuthZ resource permission /apis endpoints
 *
 * **Details:**
 * - flag key: `kubernetesAuthzResourcePermissionApis`
 * - default value: `false`
 * - type: `boolean`
 */
export const useKubernetesAuthzResourcePermissionApis = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('kubernetesAuthzResourcePermissionApis', false, options);
};

/**
 * Registers AuthZ resource permission /apis endpoints
 *
 * **Details:**
 * - flag key: `kubernetesAuthzResourcePermissionApis`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseKubernetesAuthzResourcePermissionApis = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('kubernetesAuthzResourcePermissionApis', false, options);
};

/**
 * Registers AuthZ Role Bindings /apis endpoint
 *
 * **Details:**
 * - flag key: `kubernetesAuthzRoleBindingsApi`
 * - default value: `false`
 * - type: `boolean`
 */
export const useKubernetesAuthzRoleBindingsApi = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('kubernetesAuthzRoleBindingsApi', false, options);
};

/**
 * Registers AuthZ Role Bindings /apis endpoint
 *
 * **Details:**
 * - flag key: `kubernetesAuthzRoleBindingsApi`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseKubernetesAuthzRoleBindingsApi = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('kubernetesAuthzRoleBindingsApi', false, options);
};

/**
 * Registers AuthZ Roles /apis endpoint
 *
 * **Details:**
 * - flag key: `kubernetesAuthzRolesApi`
 * - default value: `false`
 * - type: `boolean`
 */
export const useKubernetesAuthzRolesApi = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('kubernetesAuthzRolesApi', false, options);
};

/**
 * Registers AuthZ Roles /apis endpoint
 *
 * **Details:**
 * - flag key: `kubernetesAuthzRolesApi`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseKubernetesAuthzRolesApi = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('kubernetesAuthzRolesApi', false, options);
};

/**
 * Registers AuthZ TeamLBACRule /apis endpoint
 *
 * **Details:**
 * - flag key: `kubernetesAuthzTeamLBACRuleApi`
 * - default value: `false`
 * - type: `boolean`
 */
export const useKubernetesAuthzTeamLbacruleApi = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('kubernetesAuthzTeamLBACRuleApi', false, options);
};

/**
 * Registers AuthZ TeamLBACRule /apis endpoint
 *
 * **Details:**
 * - flag key: `kubernetesAuthzTeamLBACRuleApi`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseKubernetesAuthzTeamLbacruleApi = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('kubernetesAuthzTeamLBACRuleApi', false, options);
};

/**
 * Enable sync of Zanzana authorization store on AuthZ CRD mutations
 *
 * **Details:**
 * - flag key: `kubernetesAuthzZanzanaSync`
 * - default value: `false`
 * - type: `boolean`
 */
export const useKubernetesAuthzZanzanaSync = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('kubernetesAuthzZanzanaSync', false, options);
};

/**
 * Enable sync of Zanzana authorization store on AuthZ CRD mutations
 *
 * **Details:**
 * - flag key: `kubernetesAuthzZanzanaSync`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseKubernetesAuthzZanzanaSync = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('kubernetesAuthzZanzanaSync', false, options);
};

/**
 * Adds support for Kubernetes correlations
 *
 * **Details:**
 * - flag key: `kubernetesCorrelations`
 * - default value: `false`
 * - type: `boolean`
 */
export const useKubernetesCorrelations = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('kubernetesCorrelations', false, options);
};

/**
 * Adds support for Kubernetes correlations
 *
 * **Details:**
 * - flag key: `kubernetesCorrelations`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseKubernetesCorrelations = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('kubernetesCorrelations', false, options);
};

/**
 * Use the kubernetes API in the frontend for dashboards
 *
 * **Details:**
 * - flag key: `kubernetesDashboards`
 * - default value: `true`
 * - type: `boolean`
 */
export const useKubernetesDashboards = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('kubernetesDashboards', true, options);
};

/**
 * Use the kubernetes API in the frontend for dashboards
 *
 * **Details:**
 * - flag key: `kubernetesDashboards`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseKubernetesDashboards = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('kubernetesDashboards', true, options);
};

/**
 * Enables external group mapping APIs in the app platform
 *
 * **Details:**
 * - flag key: `kubernetesExternalGroupMappingsApi`
 * - default value: `false`
 * - type: `boolean`
 */
export const useKubernetesExternalGroupMappingsApi = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('kubernetesExternalGroupMappingsApi', false, options);
};

/**
 * Enables external group mapping APIs in the app platform
 *
 * **Details:**
 * - flag key: `kubernetesExternalGroupMappingsApi`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseKubernetesExternalGroupMappingsApi = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('kubernetesExternalGroupMappingsApi', false, options);
};

/**
 * Redirects the request of the external group mapping endpoints to the app platform APIs
 *
 * **Details:**
 * - flag key: `kubernetesExternalGroupMappingsRedirect`
 * - default value: `false`
 * - type: `boolean`
 */
export const useKubernetesExternalGroupMappingsRedirect = (
  options?: ReactFlagEvaluationOptions
): FlagQuery<boolean> => {
  return useFlag('kubernetesExternalGroupMappingsRedirect', false, options);
};

/**
 * Redirects the request of the external group mapping endpoints to the app platform APIs
 *
 * **Details:**
 * - flag key: `kubernetesExternalGroupMappingsRedirect`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseKubernetesExternalGroupMappingsRedirect = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('kubernetesExternalGroupMappingsRedirect', false, options);
};

/**
 * Routes library panel requests from /api to the /apis endpoint
 *
 * **Details:**
 * - flag key: `kubernetesLibraryPanels`
 * - default value: `false`
 * - type: `boolean`
 */
export const useKubernetesLibraryPanels = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('kubernetesLibraryPanels', false, options);
};

/**
 * Routes library panel requests from /api to the /apis endpoint
 *
 * **Details:**
 * - flag key: `kubernetesLibraryPanels`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseKubernetesLibraryPanels = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('kubernetesLibraryPanels', false, options);
};

/**
 * Adds support for Kubernetes logs drilldown
 *
 * **Details:**
 * - flag key: `kubernetesLogsDrilldown`
 * - default value: `false`
 * - type: `boolean`
 */
export const useKubernetesLogsDrilldown = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('kubernetesLogsDrilldown', false, options);
};

/**
 * Adds support for Kubernetes logs drilldown
 *
 * **Details:**
 * - flag key: `kubernetesLogsDrilldown`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseKubernetesLogsDrilldown = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('kubernetesLogsDrilldown', false, options);
};

/**
 * Adds support for Kubernetes querycaching
 *
 * **Details:**
 * - flag key: `kubernetesQueryCaching`
 * - default value: `false`
 * - type: `boolean`
 */
export const useKubernetesQueryCaching = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('kubernetesQueryCaching', false, options);
};

/**
 * Adds support for Kubernetes querycaching
 *
 * **Details:**
 * - flag key: `kubernetesQueryCaching`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseKubernetesQueryCaching = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('kubernetesQueryCaching', false, options);
};

/**
 * Enables k8s short url api and uses it under the hood when handling legacy /api
 *
 * **Details:**
 * - flag key: `kubernetesShortURLs`
 * - default value: `false`
 * - type: `boolean`
 */
export const useKubernetesShortUrls = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('kubernetesShortURLs', false, options);
};

/**
 * Enables k8s short url api and uses it under the hood when handling legacy /api
 *
 * **Details:**
 * - flag key: `kubernetesShortURLs`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseKubernetesShortUrls = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('kubernetesShortURLs', false, options);
};

/**
 * Routes snapshot requests from /api to the /apis endpoint
 *
 * **Details:**
 * - flag key: `kubernetesSnapshots`
 * - default value: `false`
 * - type: `boolean`
 */
export const useKubernetesSnapshots = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('kubernetesSnapshots', false, options);
};

/**
 * Routes snapshot requests from /api to the /apis endpoint
 *
 * **Details:**
 * - flag key: `kubernetesSnapshots`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseKubernetesSnapshots = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('kubernetesSnapshots', false, options);
};

/**
 * Routes stars requests from /api to the /apis endpoint
 *
 * **Details:**
 * - flag key: `kubernetesStars`
 * - default value: `false`
 * - type: `boolean`
 */
export const useKubernetesStars = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('kubernetesStars', false, options);
};

/**
 * Routes stars requests from /api to the /apis endpoint
 *
 * **Details:**
 * - flag key: `kubernetesStars`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseKubernetesStars = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('kubernetesStars', false, options);
};

/**
 * Enables search for team bindings in the app platform API
 *
 * **Details:**
 * - flag key: `kubernetesTeamBindings`
 * - default value: `false`
 * - type: `boolean`
 */
export const useKubernetesTeamBindings = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('kubernetesTeamBindings', false, options);
};

/**
 * Enables search for team bindings in the app platform API
 *
 * **Details:**
 * - flag key: `kubernetesTeamBindings`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseKubernetesTeamBindings = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('kubernetesTeamBindings', false, options);
};

/**
 * Use the new APIs for syncing users to teams
 *
 * **Details:**
 * - flag key: `kubernetesTeamSync`
 * - default value: `false`
 * - type: `boolean`
 */
export const useKubernetesTeamSync = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('kubernetesTeamSync', false, options);
};

/**
 * Use the new APIs for syncing users to teams
 *
 * **Details:**
 * - flag key: `kubernetesTeamSync`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseKubernetesTeamSync = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('kubernetesTeamSync', false, options);
};

/**
 * Redirects the request of the team endpoints to the app platform APIs
 *
 * **Details:**
 * - flag key: `kubernetesTeamsHandlerRedirect`
 * - default value: `false`
 * - type: `boolean`
 */
export const useKubernetesTeamsHandlerRedirect = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('kubernetesTeamsHandlerRedirect', false, options);
};

/**
 * Redirects the request of the team endpoints to the app platform APIs
 *
 * **Details:**
 * - flag key: `kubernetesTeamsHandlerRedirect`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseKubernetesTeamsHandlerRedirect = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('kubernetesTeamsHandlerRedirect', false, options);
};

/**
 * Adds support for Kubernetes unified storage quotas
 *
 * **Details:**
 * - flag key: `kubernetesUnifiedStorageQuotas`
 * - default value: `false`
 * - type: `boolean`
 */
export const useKubernetesUnifiedStorageQuotas = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('kubernetesUnifiedStorageQuotas', false, options);
};

/**
 * Adds support for Kubernetes unified storage quotas
 *
 * **Details:**
 * - flag key: `kubernetesUnifiedStorageQuotas`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseKubernetesUnifiedStorageQuotas = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('kubernetesUnifiedStorageQuotas', false, options);
};

/**
 * Registers a live apiserver
 *
 * **Details:**
 * - flag key: `liveAPIServer`
 * - default value: `false`
 * - type: `boolean`
 */
export const useLiveApiserver = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('liveAPIServer', false, options);
};

/**
 * Registers a live apiserver
 *
 * **Details:**
 * - flag key: `liveAPIServer`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseLiveApiserver = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('liveAPIServer', false, options);
};

/**
 * Specifies the locale so the correct format for numbers and dates can be shown
 *
 * **Details:**
 * - flag key: `localeFormatPreference`
 * - default value: `false`
 * - type: `boolean`
 */
export const useLocaleFormatPreference = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('localeFormatPreference', false, options);
};

/**
 * Specifies the locale so the correct format for numbers and dates can be shown
 *
 * **Details:**
 * - flag key: `localeFormatPreference`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseLocaleFormatPreference = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('localeFormatPreference', false, options);
};

/**
 * In-development feature that will allow injection of labels into loki queries.
 *
 * **Details:**
 * - flag key: `logQLScope`
 * - default value: `false`
 * - type: `boolean`
 */
export const useLogQlscope = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('logQLScope', false, options);
};

/**
 * In-development feature that will allow injection of labels into loki queries.
 *
 * **Details:**
 * - flag key: `logQLScope`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseLogQlscope = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('logQLScope', false, options);
};

/**
 * Allow datasource to provide custom UI for context view
 *
 * **Details:**
 * - flag key: `logsContextDatasourceUi`
 * - default value: `true`
 * - type: `boolean`
 */
export const useLogsContextDatasourceUi = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('logsContextDatasourceUi', true, options);
};

/**
 * Allow datasource to provide custom UI for context view
 *
 * **Details:**
 * - flag key: `logsContextDatasourceUi`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseLogsContextDatasourceUi = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('logsContextDatasourceUi', true, options);
};

/**
 * A table visualisation for logs in Explore
 *
 * **Details:**
 * - flag key: `logsExploreTableVisualisation`
 * - default value: `true`
 * - type: `boolean`
 */
export const useLogsExploreTableVisualisation = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('logsExploreTableVisualisation', true, options);
};

/**
 * A table visualisation for logs in Explore
 *
 * **Details:**
 * - flag key: `logsExploreTableVisualisation`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseLogsExploreTableVisualisation = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('logsExploreTableVisualisation', true, options);
};

/**
 * Enables a control component for the logs panel in Explore
 *
 * **Details:**
 * - flag key: `logsPanelControls`
 * - default value: `true`
 * - type: `boolean`
 */
export const useLogsPanelControls = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('logsPanelControls', true, options);
};

/**
 * Enables a control component for the logs panel in Explore
 *
 * **Details:**
 * - flag key: `logsPanelControls`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseLogsPanelControls = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('logsPanelControls', true, options);
};

/**
 * Support new streaming approach for loki (prototype, needs special loki build)
 *
 * **Details:**
 * - flag key: `lokiExperimentalStreaming`
 * - default value: `false`
 * - type: `boolean`
 */
export const useLokiExperimentalStreaming = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('lokiExperimentalStreaming', false, options);
};

/**
 * Support new streaming approach for loki (prototype, needs special loki build)
 *
 * **Details:**
 * - flag key: `lokiExperimentalStreaming`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseLokiExperimentalStreaming = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('lokiExperimentalStreaming', false, options);
};

/**
 * Defaults to using the Loki `/labels` API instead of `/series`
 *
 * **Details:**
 * - flag key: `lokiLabelNamesQueryApi`
 * - default value: `true`
 * - type: `boolean`
 */
export const useLokiLabelNamesQueryApi = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('lokiLabelNamesQueryApi', true, options);
};

/**
 * Defaults to using the Loki `/labels` API instead of `/series`
 *
 * **Details:**
 * - flag key: `lokiLabelNamesQueryApi`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseLokiLabelNamesQueryApi = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('lokiLabelNamesQueryApi', true, options);
};

/**
 * Changes logs responses from Loki to be compliant with the dataplane specification.
 *
 * **Details:**
 * - flag key: `lokiLogsDataplane`
 * - default value: `false`
 * - type: `boolean`
 */
export const useLokiLogsDataplane = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('lokiLogsDataplane', false, options);
};

/**
 * Changes logs responses from Loki to be compliant with the dataplane specification.
 *
 * **Details:**
 * - flag key: `lokiLogsDataplane`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseLokiLogsDataplane = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('lokiLogsDataplane', false, options);
};

/**
 * Send X-Loki-Query-Limits-Context header to Loki on first split request
 *
 * **Details:**
 * - flag key: `lokiQueryLimitsContext`
 * - default value: `false`
 * - type: `boolean`
 */
export const useLokiQueryLimitsContext = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('lokiQueryLimitsContext', false, options);
};

/**
 * Send X-Loki-Query-Limits-Context header to Loki on first split request
 *
 * **Details:**
 * - flag key: `lokiQueryLimitsContext`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseLokiQueryLimitsContext = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('lokiQueryLimitsContext', false, options);
};

/**
 * Split large interval queries into subqueries with smaller time intervals
 *
 * **Details:**
 * - flag key: `lokiQuerySplitting`
 * - default value: `true`
 * - type: `boolean`
 */
export const useLokiQuerySplitting = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('lokiQuerySplitting', true, options);
};

/**
 * Split large interval queries into subqueries with smaller time intervals
 *
 * **Details:**
 * - flag key: `lokiQuerySplitting`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseLokiQuerySplitting = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('lokiQuerySplitting', true, options);
};

/**
 * Enables running Loki queries in parallel
 *
 * **Details:**
 * - flag key: `lokiRunQueriesInParallel`
 * - default value: `false`
 * - type: `boolean`
 */
export const useLokiRunQueriesInParallel = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('lokiRunQueriesInParallel', false, options);
};

/**
 * Enables running Loki queries in parallel
 *
 * **Details:**
 * - flag key: `lokiRunQueriesInParallel`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseLokiRunQueriesInParallel = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('lokiRunQueriesInParallel', false, options);
};

/**
 * Use stream shards to split queries into smaller subqueries
 *
 * **Details:**
 * - flag key: `lokiShardSplitting`
 * - default value: `false`
 * - type: `boolean`
 */
export const useLokiShardSplitting = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('lokiShardSplitting', false, options);
};

/**
 * Use stream shards to split queries into smaller subqueries
 *
 * **Details:**
 * - flag key: `lokiShardSplitting`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseLokiShardSplitting = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('lokiShardSplitting', false, options);
};

/**
 * Pick the dual write mode from database configs
 *
 * **Details:**
 * - flag key: `managedDualWriter`
 * - default value: `false`
 * - type: `boolean`
 */
export const useManagedDualWriter = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('managedDualWriter', false, options);
};

/**
 * Pick the dual write mode from database configs
 *
 * **Details:**
 * - flag key: `managedDualWriter`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseManagedDualWriter = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('managedDualWriter', false, options);
};

/**
 * Enables creating metrics from profiles and storing them as recording rules
 *
 * **Details:**
 * - flag key: `metricsFromProfiles`
 * - default value: `false`
 * - type: `boolean`
 */
export const useMetricsFromProfiles = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('metricsFromProfiles', false, options);
};

/**
 * Enables creating metrics from profiles and storing them as recording rules
 *
 * **Details:**
 * - flag key: `metricsFromProfiles`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseMetricsFromProfiles = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('metricsFromProfiles', false, options);
};

/**
 * Enable support for Machine Learning in server-side expressions
 *
 * **Details:**
 * - flag key: `mlExpressions`
 * - default value: `false`
 * - type: `boolean`
 */
export const useMlExpressions = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('mlExpressions', false, options);
};

/**
 * Enable support for Machine Learning in server-side expressions
 *
 * **Details:**
 * - flag key: `mlExpressions`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseMlExpressions = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('mlExpressions', false, options);
};

/**
 * Enables support for variables whose values can have multiple properties
 *
 * **Details:**
 * - flag key: `multiPropsVariables`
 * - default value: `false`
 * - type: `boolean`
 */
export const useMultiPropsVariables = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('multiPropsVariables', false, options);
};

/**
 * Enables support for variables whose values can have multiple properties
 *
 * **Details:**
 * - flag key: `multiPropsVariables`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseMultiPropsVariables = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('multiPropsVariables', false, options);
};

/**
 * use multi-tenant path for awsTempCredentials
 *
 * **Details:**
 * - flag key: `multiTenantTempCredentials`
 * - default value: `false`
 * - type: `boolean`
 */
export const useMultiTenantTempCredentials = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('multiTenantTempCredentials', false, options);
};

/**
 * use multi-tenant path for awsTempCredentials
 *
 * **Details:**
 * - flag key: `multiTenantTempCredentials`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseMultiTenantTempCredentials = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('multiTenantTempCredentials', false, options);
};

/**
 * Enables new design for the Clickhouse data source configuration page
 *
 * **Details:**
 * - flag key: `newClickhouseConfigPageDesign`
 * - default value: `false`
 * - type: `boolean`
 */
export const useNewClickhouseConfigPageDesign = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('newClickhouseConfigPageDesign', false, options);
};

/**
 * Enables new design for the Clickhouse data source configuration page
 *
 * **Details:**
 * - flag key: `newClickhouseConfigPageDesign`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseNewClickhouseConfigPageDesign = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('newClickhouseConfigPageDesign', false, options);
};

/**
 * Enables filters and group by variables on all new dashboards. Variables are added only if default data source supports filtering.
 *
 * **Details:**
 * - flag key: `newDashboardWithFiltersAndGroupBy`
 * - default value: `false`
 * - type: `boolean`
 */
export const useNewDashboardWithFiltersAndGroupBy = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('newDashboardWithFiltersAndGroupBy', false, options);
};

/**
 * Enables filters and group by variables on all new dashboards. Variables are added only if default data source supports filtering.
 *
 * **Details:**
 * - flag key: `newDashboardWithFiltersAndGroupBy`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseNewDashboardWithFiltersAndGroupBy = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('newDashboardWithFiltersAndGroupBy', false, options);
};

/**
 * Enable new gauge visualization
 *
 * **Details:**
 * - flag key: `newGauge`
 * - default value: `false`
 * - type: `boolean`
 */
export const useNewGauge = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('newGauge', false, options);
};

/**
 * Enable new gauge visualization
 *
 * **Details:**
 * - flag key: `newGauge`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseNewGauge = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('newGauge', false, options);
};

/**
 * Enables new design for the InfluxDB data source configuration page
 *
 * **Details:**
 * - flag key: `newInfluxDSConfigPageDesign`
 * - default value: `false`
 * - type: `boolean`
 */
export const useNewInfluxDsconfigPageDesign = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('newInfluxDSConfigPageDesign', false, options);
};

/**
 * Enables new design for the InfluxDB data source configuration page
 *
 * **Details:**
 * - flag key: `newInfluxDSConfigPageDesign`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseNewInfluxDsconfigPageDesign = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('newInfluxDSConfigPageDesign', false, options);
};

/**
 * New Log Context component
 *
 * **Details:**
 * - flag key: `newLogContext`
 * - default value: `false`
 * - type: `boolean`
 */
export const useNewLogContext = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('newLogContext', false, options);
};

/**
 * New Log Context component
 *
 * **Details:**
 * - flag key: `newLogContext`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseNewLogContext = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('newLogContext', false, options);
};

/**
 * Enables the new logs panel
 *
 * **Details:**
 * - flag key: `newLogsPanel`
 * - default value: `true`
 * - type: `boolean`
 */
export const useNewLogsPanel = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('newLogsPanel', true, options);
};

/**
 * Enables the new logs panel
 *
 * **Details:**
 * - flag key: `newLogsPanel`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseNewLogsPanel = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('newLogsPanel', true, options);
};

/**
 * Increases panel padding globally
 *
 * **Details:**
 * - flag key: `newPanelPadding`
 * - default value: `true`
 * - type: `boolean`
 */
export const useNewPanelPadding = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('newPanelPadding', true, options);
};

/**
 * Increases panel padding globally
 *
 * **Details:**
 * - flag key: `newPanelPadding`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseNewPanelPadding = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('newPanelPadding', true, options);
};

/**
 * Enables the report creation drawer in a dashboard
 *
 * **Details:**
 * - flag key: `newShareReportDrawer`
 * - default value: `false`
 * - type: `boolean`
 */
export const useNewShareReportDrawer = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('newShareReportDrawer', false, options);
};

/**
 * Enables the report creation drawer in a dashboard
 *
 * **Details:**
 * - flag key: `newShareReportDrawer`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseNewShareReportDrawer = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('newShareReportDrawer', false, options);
};

/**
 * Enables new keyboard shortcuts for time range zoom operations
 *
 * **Details:**
 * - flag key: `newTimeRangeZoomShortcuts`
 * - default value: `true`
 * - type: `boolean`
 */
export const useNewTimeRangeZoomShortcuts = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('newTimeRangeZoomShortcuts', true, options);
};

/**
 * Enables new keyboard shortcuts for time range zoom operations
 *
 * **Details:**
 * - flag key: `newTimeRangeZoomShortcuts`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseNewTimeRangeZoomShortcuts = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('newTimeRangeZoomShortcuts', true, options);
};

/**
 * Enable new visualization suggestions
 *
 * **Details:**
 * - flag key: `newVizSuggestions`
 * - default value: `false`
 * - type: `boolean`
 */
export const useNewVizSuggestions = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('newVizSuggestions', false, options);
};

/**
 * Enable new visualization suggestions
 *
 * **Details:**
 * - flag key: `newVizSuggestions`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseNewVizSuggestions = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('newVizSuggestions', false, options);
};

/**
 * Require that sub claims is present in oauth tokens.
 *
 * **Details:**
 * - flag key: `oauthRequireSubClaim`
 * - default value: `false`
 * - type: `boolean`
 */
export const useOauthRequireSubClaim = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('oauthRequireSubClaim', false, options);
};

/**
 * Require that sub claims is present in oauth tokens.
 *
 * **Details:**
 * - flag key: `oauthRequireSubClaim`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseOauthRequireSubClaim = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('oauthRequireSubClaim', false, options);
};

/**
 * When storing dashboard and folder resource permissions, only store action sets and not the full list of underlying permission
 *
 * **Details:**
 * - flag key: `onlyStoreActionSets`
 * - default value: `true`
 * - type: `boolean`
 */
export const useOnlyStoreActionSets = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('onlyStoreActionSets', true, options);
};

/**
 * When storing dashboard and folder resource permissions, only store action sets and not the full list of underlying permission
 *
 * **Details:**
 * - flag key: `onlyStoreActionSets`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseOnlyStoreActionSets = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('onlyStoreActionSets', true, options);
};

/**
 * Run queries through the data source backend
 *
 * **Details:**
 * - flag key: `opentsdbBackendMigration`
 * - default value: `false`
 * - type: `boolean`
 */
export const useOpentsdbBackendMigration = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('opentsdbBackendMigration', false, options);
};

/**
 * Run queries through the data source backend
 *
 * **Details:**
 * - flag key: `opentsdbBackendMigration`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseOpentsdbBackendMigration = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('opentsdbBackendMigration', false, options);
};

/**
 * Applies OTel formatting templates to displayed logs
 *
 * **Details:**
 * - flag key: `otelLogsFormatting`
 * - default value: `false`
 * - type: `boolean`
 */
export const useOtelLogsFormatting = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('otelLogsFormatting', false, options);
};

/**
 * Applies OTel formatting templates to displayed logs
 *
 * **Details:**
 * - flag key: `otelLogsFormatting`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseOtelLogsFormatting = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('otelLogsFormatting', false, options);
};

/**
 * Enables use of the `systemPanelFilterVar` variable to filter panels in a dashboard
 *
 * **Details:**
 * - flag key: `panelFilterVariable`
 * - default value: `false`
 * - type: `boolean`
 */
export const usePanelFilterVariable = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('panelFilterVariable', false, options);
};

/**
 * Enables use of the `systemPanelFilterVar` variable to filter panels in a dashboard
 *
 * **Details:**
 * - flag key: `panelFilterVariable`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspensePanelFilterVariable = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('panelFilterVariable', false, options);
};

/**
 * Enables a group by action per panel
 *
 * **Details:**
 * - flag key: `panelGroupBy`
 * - default value: `false`
 * - type: `boolean`
 */
export const usePanelGroupBy = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('panelGroupBy', false, options);
};

/**
 * Enables a group by action per panel
 *
 * **Details:**
 * - flag key: `panelGroupBy`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspensePanelGroupBy = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('panelGroupBy', false, options);
};

/**
 * Enable style actions (copy/paste) in the panel editor
 *
 * **Details:**
 * - flag key: `panelStyleActions`
 * - default value: `false`
 * - type: `boolean`
 */
export const usePanelStyleActions = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('panelStyleActions', false, options);
};

/**
 * Enable style actions (copy/paste) in the panel editor
 *
 * **Details:**
 * - flag key: `panelStyleActions`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspensePanelStyleActions = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('panelStyleActions', false, options);
};

/**
 * Enables a new panel time settings drawer
 *
 * **Details:**
 * - flag key: `panelTimeSettings`
 * - default value: `false`
 * - type: `boolean`
 */
export const usePanelTimeSettings = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('panelTimeSettings', false, options);
};

/**
 * Enables a new panel time settings drawer
 *
 * **Details:**
 * - flag key: `panelTimeSettings`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspensePanelTimeSettings = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('panelTimeSettings', false, options);
};

/**
 * Search for dashboards using panel title
 *
 * **Details:**
 * - flag key: `panelTitleSearch`
 * - default value: `false`
 * - type: `boolean`
 */
export const usePanelTitleSearch = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('panelTitleSearch', false, options);
};

/**
 * Search for dashboards using panel title
 *
 * **Details:**
 * - flag key: `panelTitleSearch`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspensePanelTitleSearch = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('panelTitleSearch', false, options);
};

/**
 * Enable passwordless login via magic link authentication
 *
 * **Details:**
 * - flag key: `passwordlessMagicLinkAuthentication`
 * - default value: `false`
 * - type: `boolean`
 */
export const usePasswordlessMagicLinkAuthentication = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('passwordlessMagicLinkAuthentication', false, options);
};

/**
 * Enable passwordless login via magic link authentication
 *
 * **Details:**
 * - flag key: `passwordlessMagicLinkAuthentication`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspensePasswordlessMagicLinkAuthentication = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('passwordlessMagicLinkAuthentication', false, options);
};

/**
 * Enables generating table data as PDF in reporting
 *
 * **Details:**
 * - flag key: `pdfTables`
 * - default value: `false`
 * - type: `boolean`
 */
export const usePdfTables = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('pdfTables', false, options);
};

/**
 * Enables generating table data as PDF in reporting
 *
 * **Details:**
 * - flag key: `pdfTables`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspensePdfTables = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('pdfTables', false, options);
};

/**
 * Enables filtering by grouping labels on the panel level through legend or tooltip
 *
 * **Details:**
 * - flag key: `perPanelFiltering`
 * - default value: `false`
 * - type: `boolean`
 */
export const usePerPanelFiltering = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('perPanelFiltering', false, options);
};

/**
 * Enables filtering by grouping labels on the panel level through legend or tooltip
 *
 * **Details:**
 * - flag key: `perPanelFiltering`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspensePerPanelFiltering = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('perPanelFiltering', false, options);
};

/**
 * Enables viewing non-applicable drilldowns on a panel level
 *
 * **Details:**
 * - flag key: `perPanelNonApplicableDrilldowns`
 * - default value: `false`
 * - type: `boolean`
 */
export const usePerPanelNonApplicableDrilldowns = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('perPanelNonApplicableDrilldowns', false, options);
};

/**
 * Enables viewing non-applicable drilldowns on a panel level
 *
 * **Details:**
 * - flag key: `perPanelNonApplicableDrilldowns`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspensePerPanelNonApplicableDrilldowns = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('perPanelNonApplicableDrilldowns', false, options);
};

/**
 * Enables experimental reconciler for playlists
 *
 * **Details:**
 * - flag key: `playlistsReconciler`
 * - default value: `false`
 * - type: `boolean`
 */
export const usePlaylistsReconciler = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('playlistsReconciler', false, options);
};

/**
 * Enables experimental reconciler for playlists
 *
 * **Details:**
 * - flag key: `playlistsReconciler`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspensePlaylistsReconciler = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('playlistsReconciler', false, options);
};

/**
 * Enables running plugins in containers
 *
 * **Details:**
 * - flag key: `pluginContainers`
 * - default value: `false`
 * - type: `boolean`
 */
export const usePluginContainers = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('pluginContainers', false, options);
};

/**
 * Enables running plugins in containers
 *
 * **Details:**
 * - flag key: `pluginContainers`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspensePluginContainers = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('pluginContainers', false, options);
};

/**
 * Show insights for plugins in the plugin details page
 *
 * **Details:**
 * - flag key: `pluginInsights`
 * - default value: `false`
 * - type: `boolean`
 */
export const usePluginInsights = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('pluginInsights', false, options);
};

/**
 * Show insights for plugins in the plugin details page
 *
 * **Details:**
 * - flag key: `pluginInsights`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspensePluginInsights = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('pluginInsights', false, options);
};

/**
 * Enable syncing plugin installations to the installs API
 *
 * **Details:**
 * - flag key: `pluginInstallAPISync`
 * - default value: `false`
 * - type: `boolean`
 */
export const usePluginInstallApisync = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('pluginInstallAPISync', false, options);
};

/**
 * Enable syncing plugin installations to the installs API
 *
 * **Details:**
 * - flag key: `pluginInstallAPISync`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspensePluginInstallApisync = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('pluginInstallAPISync', false, options);
};

/**
 * Preserve plugin proxy trailing slash.
 *
 * **Details:**
 * - flag key: `pluginProxyPreserveTrailingSlash`
 * - default value: `false`
 * - type: `boolean`
 */
export const usePluginProxyPreserveTrailingSlash = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('pluginProxyPreserveTrailingSlash', false, options);
};

/**
 * Preserve plugin proxy trailing slash.
 *
 * **Details:**
 * - flag key: `pluginProxyPreserveTrailingSlash`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspensePluginProxyPreserveTrailingSlash = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('pluginProxyPreserveTrailingSlash', false, options);
};

/**
 * Load plugins on store service startup instead of wire provider, and call RegisterFixedRoles after all plugins are loaded
 *
 * **Details:**
 * - flag key: `pluginStoreServiceLoading`
 * - default value: `false`
 * - type: `boolean`
 */
export const usePluginStoreServiceLoading = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('pluginStoreServiceLoading', false, options);
};

/**
 * Load plugins on store service startup instead of wire provider, and call RegisterFixedRoles after all plugins are loaded
 *
 * **Details:**
 * - flag key: `pluginStoreServiceLoading`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspensePluginStoreServiceLoading = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('pluginStoreServiceLoading', false, options);
};

/**
 * Enables auto-updating of users installed plugins
 *
 * **Details:**
 * - flag key: `pluginsAutoUpdate`
 * - default value: `false`
 * - type: `boolean`
 */
export const usePluginsAutoUpdate = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('pluginsAutoUpdate', false, options);
};

/**
 * Enables auto-updating of users installed plugins
 *
 * **Details:**
 * - flag key: `pluginsAutoUpdate`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspensePluginsAutoUpdate = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('pluginsAutoUpdate', false, options);
};

/**
 * Enables SRI checks for plugin assets
 *
 * **Details:**
 * - flag key: `pluginsSriChecks`
 * - default value: `false`
 * - type: `boolean`
 */
export const usePluginsSriChecks = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('pluginsSriChecks', false, options);
};

/**
 * Enables SRI checks for plugin assets
 *
 * **Details:**
 * - flag key: `pluginsSriChecks`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspensePluginsSriChecks = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('pluginsSriChecks', false, options);
};

/**
 * Prefer library panel title over viz panel title.
 *
 * **Details:**
 * - flag key: `preferLibraryPanelTitle`
 * - default value: `false`
 * - type: `boolean`
 */
export const usePreferLibraryPanelTitle = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('preferLibraryPanelTitle', false, options);
};

/**
 * Prefer library panel title over viz panel title.
 *
 * **Details:**
 * - flag key: `preferLibraryPanelTitle`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspensePreferLibraryPanelTitle = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('preferLibraryPanelTitle', false, options);
};

/**
 * Enables possibility to preserve dashboard variables and time range when navigating between dashboards
 *
 * **Details:**
 * - flag key: `preserveDashboardStateWhenNavigating`
 * - default value: `false`
 * - type: `boolean`
 */
export const usePreserveDashboardStateWhenNavigating = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('preserveDashboardStateWhenNavigating', false, options);
};

/**
 * Enables possibility to preserve dashboard variables and time range when navigating between dashboards
 *
 * **Details:**
 * - flag key: `preserveDashboardStateWhenNavigating`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspensePreserveDashboardStateWhenNavigating = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('preserveDashboardStateWhenNavigating', false, options);
};

/**
 * Restrict PanelChrome contents with overflow: hidden;
 *
 * **Details:**
 * - flag key: `preventPanelChromeOverflow`
 * - default value: `true`
 * - type: `boolean`
 */
export const usePreventPanelChromeOverflow = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('preventPanelChromeOverflow', true, options);
};

/**
 * Restrict PanelChrome contents with overflow: hidden;
 *
 * **Details:**
 * - flag key: `preventPanelChromeOverflow`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspensePreventPanelChromeOverflow = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('preventPanelChromeOverflow', true, options);
};

/**
 * Enables profiles exemplars support in profiles drilldown
 *
 * **Details:**
 * - flag key: `profilesExemplars`
 * - default value: `false`
 * - type: `boolean`
 */
export const useProfilesExemplars = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('profilesExemplars', false, options);
};

/**
 * Enables profiles exemplars support in profiles drilldown
 *
 * **Details:**
 * - flag key: `profilesExemplars`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseProfilesExemplars = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('profilesExemplars', false, options);
};

/**
 * Deprecated. Allow override default AAD audience for Azure Prometheus endpoint. Enabled by default. This feature should no longer be used and will be removed in the future.
 *
 * **Details:**
 * - flag key: `prometheusAzureOverrideAudience`
 * - default value: `true`
 * - type: `boolean`
 */
export const usePrometheusAzureOverrideAudience = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('prometheusAzureOverrideAudience', true, options);
};

/**
 * Deprecated. Allow override default AAD audience for Azure Prometheus endpoint. Enabled by default. This feature should no longer be used and will be removed in the future.
 *
 * **Details:**
 * - flag key: `prometheusAzureOverrideAudience`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspensePrometheusAzureOverrideAudience = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('prometheusAzureOverrideAudience', true, options);
};

/**
 * Adds support for quotes and special characters in label values for Prometheus queries
 *
 * **Details:**
 * - flag key: `prometheusSpecialCharsInLabelValues`
 * - default value: `false`
 * - type: `boolean`
 */
export const usePrometheusSpecialCharsInLabelValues = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('prometheusSpecialCharsInLabelValues', false, options);
};

/**
 * Adds support for quotes and special characters in label values for Prometheus queries
 *
 * **Details:**
 * - flag key: `prometheusSpecialCharsInLabelValues`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspensePrometheusSpecialCharsInLabelValues = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('prometheusSpecialCharsInLabelValues', false, options);
};

/**
 * Checks for deprecated Prometheus authentication methods (SigV4 and Azure), installs the relevant data source, and migrates the Prometheus data sources
 *
 * **Details:**
 * - flag key: `prometheusTypeMigration`
 * - default value: `false`
 * - type: `boolean`
 */
export const usePrometheusTypeMigration = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('prometheusTypeMigration', false, options);
};

/**
 * Checks for deprecated Prometheus authentication methods (SigV4 and Azure), installs the relevant data source, and migrates the Prometheus data sources
 *
 * **Details:**
 * - flag key: `prometheusTypeMigration`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspensePrometheusTypeMigration = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('prometheusTypeMigration', false, options);
};

/**
 * Next generation provisioning... and git
 *
 * **Details:**
 * - flag key: `provisioning`
 * - default value: `false`
 * - type: `boolean`
 */
export const useProvisioning = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('provisioning', false, options);
};

/**
 * Next generation provisioning... and git
 *
 * **Details:**
 * - flag key: `provisioning`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseProvisioning = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('provisioning', false, options);
};

/**
 * Enable export functionality for provisioned resources
 *
 * **Details:**
 * - flag key: `provisioningExport`
 * - default value: `false`
 * - type: `boolean`
 */
export const useProvisioningExport = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('provisioningExport', false, options);
};

/**
 * Enable export functionality for provisioned resources
 *
 * **Details:**
 * - flag key: `provisioningExport`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseProvisioningExport = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('provisioningExport', false, options);
};

/**
 * Allow setting folder metadata for provisioned folders
 *
 * **Details:**
 * - flag key: `provisioningFolderMetadata`
 * - default value: `false`
 * - type: `boolean`
 */
export const useProvisioningFolderMetadata = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('provisioningFolderMetadata', false, options);
};

/**
 * Allow setting folder metadata for provisioned folders
 *
 * **Details:**
 * - flag key: `provisioningFolderMetadata`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseProvisioningFolderMetadata = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('provisioningFolderMetadata', false, options);
};

/**
 * Enables public dashboard sharing to be restricted to only allowed emails
 *
 * **Details:**
 * - flag key: `publicDashboardsEmailSharing`
 * - default value: `false`
 * - type: `boolean`
 */
export const usePublicDashboardsEmailSharing = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('publicDashboardsEmailSharing', false, options);
};

/**
 * Enables public dashboard sharing to be restricted to only allowed emails
 *
 * **Details:**
 * - flag key: `publicDashboardsEmailSharing`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspensePublicDashboardsEmailSharing = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('publicDashboardsEmailSharing', false, options);
};

/**
 * Enables public dashboard rendering using scenes
 *
 * **Details:**
 * - flag key: `publicDashboardsScene`
 * - default value: `true`
 * - type: `boolean`
 */
export const usePublicDashboardsScene = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('publicDashboardsScene', true, options);
};

/**
 * Enables public dashboard rendering using scenes
 *
 * **Details:**
 * - flag key: `publicDashboardsScene`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspensePublicDashboardsScene = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('publicDashboardsScene', true, options);
};

/**
 * Enable request deduplication when query caching is enabled. Requests issuing the same query will be deduplicated, only the first request to arrive will be executed and the response will be shared with requests arriving while there is a request in-flight
 *
 * **Details:**
 * - flag key: `queryCacheRequestDeduplication`
 * - default value: `false`
 * - type: `boolean`
 */
export const useQueryCacheRequestDeduplication = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('queryCacheRequestDeduplication', false, options);
};

/**
 * Enable request deduplication when query caching is enabled. Requests issuing the same query will be deduplicated, only the first request to arrive will be executed and the response will be shared with requests arriving while there is a request in-flight
 *
 * **Details:**
 * - flag key: `queryCacheRequestDeduplication`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseQueryCacheRequestDeduplication = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('queryCacheRequestDeduplication', false, options);
};

/**
 * Enables next generation query editor experience
 *
 * **Details:**
 * - flag key: `queryEditorNext`
 * - default value: `false`
 * - type: `boolean`
 */
export const useQueryEditorNext = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('queryEditorNext', false, options);
};

/**
 * Enables next generation query editor experience
 *
 * **Details:**
 * - flag key: `queryEditorNext`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseQueryEditorNext = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('queryEditorNext', false, options);
};

/**
 * Enables Saved queries (query library) feature
 *
 * **Details:**
 * - flag key: `queryLibrary`
 * - default value: `false`
 * - type: `boolean`
 */
export const useQueryLibrary = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('queryLibrary', false, options);
};

/**
 * Enables Saved queries (query library) feature
 *
 * **Details:**
 * - flag key: `queryLibrary`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseQueryLibrary = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('queryLibrary', false, options);
};

/**
 * Register /apis/query.grafana.app/ -- will eventually replace /api/ds/query
 *
 * **Details:**
 * - flag key: `queryService`
 * - default value: `false`
 * - type: `boolean`
 */
export const useQueryService = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('queryService', false, options);
};

/**
 * Register /apis/query.grafana.app/ -- will eventually replace /api/ds/query
 *
 * **Details:**
 * - flag key: `queryService`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseQueryService = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('queryService', false, options);
};

/**
 * Routes requests to the new query service
 *
 * **Details:**
 * - flag key: `queryServiceFromUI`
 * - default value: `false`
 * - type: `boolean`
 */
export const useQueryServiceFromUi = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('queryServiceFromUI', false, options);
};

/**
 * Routes requests to the new query service
 *
 * **Details:**
 * - flag key: `queryServiceFromUI`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseQueryServiceFromUi = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('queryServiceFromUI', false, options);
};

/**
 * Rewrite requests targeting /ds/query to the query service
 *
 * **Details:**
 * - flag key: `queryServiceRewrite`
 * - default value: `false`
 * - type: `boolean`
 */
export const useQueryServiceRewrite = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('queryServiceRewrite', false, options);
};

/**
 * Rewrite requests targeting /ds/query to the query service
 *
 * **Details:**
 * - flag key: `queryServiceRewrite`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseQueryServiceRewrite = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('queryServiceRewrite', false, options);
};

/**
 * Adds datasource connections to the query service
 *
 * **Details:**
 * - flag key: `queryServiceWithConnections`
 * - default value: `false`
 * - type: `boolean`
 */
export const useQueryServiceWithConnections = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('queryServiceWithConnections', false, options);
};

/**
 * Adds datasource connections to the query service
 *
 * **Details:**
 * - flag key: `queryServiceWithConnections`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseQueryServiceWithConnections = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('queryServiceWithConnections', false, options);
};

/**
 * Enables the Query with Assistant button in the query editor
 *
 * **Details:**
 * - flag key: `queryWithAssistant`
 * - default value: `false`
 * - type: `boolean`
 */
export const useQueryWithAssistant = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('queryWithAssistant', false, options);
};

/**
 * Enables the Query with Assistant button in the query editor
 *
 * **Details:**
 * - flag key: `queryWithAssistant`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseQueryWithAssistant = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('queryWithAssistant', false, options);
};

/**
 * Whether to use the new React 19 runtime
 *
 * **Details:**
 * - flag key: `react19`
 * - default value: `false`
 * - type: `boolean`
 */
export const useReact19 = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('react19', false, options);
};

/**
 * Whether to use the new React 19 runtime
 *
 * **Details:**
 * - flag key: `react19`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseReact19 = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('react19', false, options);
};

/**
 * Enables recently viewed dashboards section in the browsing dashboard page
 *
 * **Details:**
 * - flag key: `recentlyViewedDashboards`
 * - default value: `false`
 * - type: `boolean`
 */
export const useRecentlyViewedDashboards = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('recentlyViewedDashboards', false, options);
};

/**
 * Enables recently viewed dashboards section in the browsing dashboard page
 *
 * **Details:**
 * - flag key: `recentlyViewedDashboards`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseRecentlyViewedDashboards = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('recentlyViewedDashboards', false, options);
};

/**
 * Refactor time range variables flow to reduce number of API calls made when query variables are chained
 *
 * **Details:**
 * - flag key: `refactorVariablesTimeRange`
 * - default value: `false`
 * - type: `boolean`
 */
export const useRefactorVariablesTimeRange = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('refactorVariablesTimeRange', false, options);
};

/**
 * Refactor time range variables flow to reduce number of API calls made when query variables are chained
 *
 * **Details:**
 * - flag key: `refactorVariablesTimeRange`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseRefactorVariablesTimeRange = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('refactorVariablesTimeRange', false, options);
};

/**
 * Require that refresh tokens are present in oauth tokens.
 *
 * **Details:**
 * - flag key: `refreshTokenRequired`
 * - default value: `false`
 * - type: `boolean`
 */
export const useRefreshTokenRequired = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('refreshTokenRequired', false, options);
};

/**
 * Require that refresh tokens are present in oauth tokens.
 *
 * **Details:**
 * - flag key: `refreshTokenRequired`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseRefreshTokenRequired = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('refreshTokenRequired', false, options);
};

/**
 * Enables reload of dashboards on scopes, time range and variables changes
 *
 * **Details:**
 * - flag key: `reloadDashboardsOnParamsChange`
 * - default value: `false`
 * - type: `boolean`
 */
export const useReloadDashboardsOnParamsChange = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('reloadDashboardsOnParamsChange', false, options);
};

/**
 * Enables reload of dashboards on scopes, time range and variables changes
 *
 * **Details:**
 * - flag key: `reloadDashboardsOnParamsChange`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseReloadDashboardsOnParamsChange = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('reloadDashboardsOnParamsChange', false, options);
};

/**
 * Uses JWT-based auth for rendering instead of relying on remote cache
 *
 * **Details:**
 * - flag key: `renderAuthJWT`
 * - default value: `false`
 * - type: `boolean`
 */
export const useRenderAuthJwt = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('renderAuthJWT', false, options);
};

/**
 * Uses JWT-based auth for rendering instead of relying on remote cache
 *
 * **Details:**
 * - flag key: `renderAuthJWT`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseRenderAuthJwt = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('renderAuthJWT', false, options);
};

/**
 * Disable pre-loading app plugins when the request is coming from the renderer
 *
 * **Details:**
 * - flag key: `rendererDisableAppPluginsPreload`
 * - default value: `false`
 * - type: `boolean`
 */
export const useRendererDisableAppPluginsPreload = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('rendererDisableAppPluginsPreload', false, options);
};

/**
 * Disable pre-loading app plugins when the request is coming from the renderer
 *
 * **Details:**
 * - flag key: `rendererDisableAppPluginsPreload`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseRendererDisableAppPluginsPreload = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('rendererDisableAppPluginsPreload', false, options);
};

/**
 * Enables CSV encoding options in the reporting feature
 *
 * **Details:**
 * - flag key: `reportingCsvEncodingOptions`
 * - default value: `false`
 * - type: `boolean`
 */
export const useReportingCsvEncodingOptions = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('reportingCsvEncodingOptions', false, options);
};

/**
 * Enables CSV encoding options in the reporting feature
 *
 * **Details:**
 * - flag key: `reportingCsvEncodingOptions`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseReportingCsvEncodingOptions = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('reportingCsvEncodingOptions', false, options);
};

/**
 * Enable v2 dashboard layout support in reports (auto-grid, tabs, rows)
 *
 * **Details:**
 * - flag key: `reportingV2Layouts`
 * - default value: `false`
 * - type: `boolean`
 */
export const useReportingV2Layouts = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('reportingV2Layouts', false, options);
};

/**
 * Enable v2 dashboard layout support in reports (auto-grid, tabs, rows)
 *
 * **Details:**
 * - flag key: `reportingV2Layouts`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseReportingV2Layouts = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('reportingV2Layouts', false, options);
};

/**
 * Enables restore deleted dashboards feature
 *
 * **Details:**
 * - flag key: `restoreDashboards`
 * - default value: `false`
 * - type: `boolean`
 */
export const useRestoreDashboards = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('restoreDashboards', false, options);
};

/**
 * Enables restore deleted dashboards feature
 *
 * **Details:**
 * - flag key: `restoreDashboards`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseRestoreDashboards = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('restoreDashboards', false, options);
};

/**
 * Enables sharing a list of APIs with a list of plugins
 *
 * **Details:**
 * - flag key: `restrictedPluginApis`
 * - default value: `true`
 * - type: `boolean`
 */
export const useRestrictedPluginApis = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('restrictedPluginApis', true, options);
};

/**
 * Enables sharing a list of APIs with a list of plugins
 *
 * **Details:**
 * - flag key: `restrictedPluginApis`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseRestrictedPluginApis = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('restrictedPluginApis', true, options);
};

/**
 * Enables the new role picker drawer design
 *
 * **Details:**
 * - flag key: `rolePickerDrawer`
 * - default value: `false`
 * - type: `boolean`
 */
export const useRolePickerDrawer = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('rolePickerDrawer', false, options);
};

/**
 * Enables the new role picker drawer design
 *
 * **Details:**
 * - flag key: `rolePickerDrawer`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseRolePickerDrawer = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('rolePickerDrawer', false, options);
};

/**
 * Enables the new version of rudderstack
 *
 * **Details:**
 * - flag key: `rudderstackUpgrade`
 * - default value: `false`
 * - type: `boolean`
 */
export const useRudderstackUpgrade = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('rudderstackUpgrade', false, options);
};

/**
 * Enables the new version of rudderstack
 *
 * **Details:**
 * - flag key: `rudderstackUpgrade`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseRudderstackUpgrade = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('rudderstackUpgrade', false, options);
};

/**
 * Enables Saved queries (query library) RBAC permissions
 *
 * **Details:**
 * - flag key: `savedQueriesRBAC`
 * - default value: `false`
 * - type: `boolean`
 */
export const useSavedQueriesRbac = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('savedQueriesRBAC', false, options);
};

/**
 * Enables Saved queries (query library) RBAC permissions
 *
 * **Details:**
 * - flag key: `savedQueriesRBAC`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseSavedQueriesRbac = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('savedQueriesRBAC', false, options);
};

/**
 * Enable fallback parsing behavior when scan row encounters invalid dashboard JSON
 *
 * **Details:**
 * - flag key: `scanRowInvalidDashboardParseFallbackEnabled`
 * - default value: `false`
 * - type: `boolean`
 */
export const useScanRowInvalidDashboardParseFallbackEnabled = (
  options?: ReactFlagEvaluationOptions
): FlagQuery<boolean> => {
  return useFlag('scanRowInvalidDashboardParseFallbackEnabled', false, options);
};

/**
 * Enable fallback parsing behavior when scan row encounters invalid dashboard JSON
 *
 * **Details:**
 * - flag key: `scanRowInvalidDashboardParseFallbackEnabled`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseScanRowInvalidDashboardParseFallbackEnabled = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('scanRowInvalidDashboardParseFallbackEnabled', false, options);
};

/**
 * In-development feature flag for the scope api using the app platform.
 *
 * **Details:**
 * - flag key: `scopeApi`
 * - default value: `false`
 * - type: `boolean`
 */
export const useScopeApi = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('scopeApi', false, options);
};

/**
 * In-development feature flag for the scope api using the app platform.
 *
 * **Details:**
 * - flag key: `scopeApi`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseScopeApi = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('scopeApi', false, options);
};

/**
 * Enables the use of scope filters in Grafana
 *
 * **Details:**
 * - flag key: `scopeFilters`
 * - default value: `false`
 * - type: `boolean`
 */
export const useScopeFilters = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('scopeFilters', false, options);
};

/**
 * Enables the use of scope filters in Grafana
 *
 * **Details:**
 * - flag key: `scopeFilters`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseScopeFilters = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('scopeFilters', false, options);
};

/**
 * Enable scope search to include all levels of the scope node tree
 *
 * **Details:**
 * - flag key: `scopeSearchAllLevels`
 * - default value: `false`
 * - type: `boolean`
 */
export const useScopeSearchAllLevels = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('scopeSearchAllLevels', false, options);
};

/**
 * Enable scope search to include all levels of the scope node tree
 *
 * **Details:**
 * - flag key: `scopeSearchAllLevels`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseScopeSearchAllLevels = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('scopeSearchAllLevels', false, options);
};

/**
 * Enable the Secrets Keeper management UI for configuring external secret storage
 *
 * **Details:**
 * - flag key: `secretsKeeperUI`
 * - default value: `false`
 * - type: `boolean`
 */
export const useSecretsKeeperUi = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('secretsKeeperUI', false, options);
};

/**
 * Enable the Secrets Keeper management UI for configuring external secret storage
 *
 * **Details:**
 * - flag key: `secretsKeeperUI`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseSecretsKeeperUi = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('secretsKeeperUI', false, options);
};

/**
 * Enables the creation of keepers that manage secrets stored on AWS secrets manager
 *
 * **Details:**
 * - flag key: `secretsManagementAppPlatformAwsKeeper`
 * - default value: `false`
 * - type: `boolean`
 */
export const useSecretsManagementAppPlatformAwsKeeper = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('secretsManagementAppPlatformAwsKeeper', false, options);
};

/**
 * Enables the creation of keepers that manage secrets stored on AWS secrets manager
 *
 * **Details:**
 * - flag key: `secretsManagementAppPlatformAwsKeeper`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseSecretsManagementAppPlatformAwsKeeper = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('secretsManagementAppPlatformAwsKeeper', false, options);
};

/**
 * Enable the secrets management app platform UI
 *
 * **Details:**
 * - flag key: `secretsManagementAppPlatformUI`
 * - default value: `false`
 * - type: `boolean`
 */
export const useSecretsManagementAppPlatformUi = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('secretsManagementAppPlatformUI', false, options);
};

/**
 * Enable the secrets management app platform UI
 *
 * **Details:**
 * - flag key: `secretsManagementAppPlatformUI`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseSecretsManagementAppPlatformUi = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('secretsManagementAppPlatformUI', false, options);
};

/**
 * Enables image sharing functionality for dashboards
 *
 * **Details:**
 * - flag key: `sharingDashboardImage`
 * - default value: `true`
 * - type: `boolean`
 */
export const useSharingDashboardImage = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('sharingDashboardImage', true, options);
};

/**
 * Enables image sharing functionality for dashboards
 *
 * **Details:**
 * - flag key: `sharingDashboardImage`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseSharingDashboardImage = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('sharingDashboardImage', true, options);
};

/**
 * Enables the ASAP smoothing transformation for time series data
 *
 * **Details:**
 * - flag key: `smoothingTransformation`
 * - default value: `false`
 * - type: `boolean`
 */
export const useSmoothingTransformation = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('smoothingTransformation', false, options);
};

/**
 * Enables the ASAP smoothing transformation for time series data
 *
 * **Details:**
 * - flag key: `smoothingTransformation`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseSmoothingTransformation = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('smoothingTransformation', false, options);
};

/**
 * Enables SQL Expressions, which can execute SQL queries against data source results.
 *
 * **Details:**
 * - flag key: `sqlExpressions`
 * - default value: `false`
 * - type: `boolean`
 */
export const useSqlExpressions = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('sqlExpressions', false, options);
};

/**
 * Enables SQL Expressions, which can execute SQL queries against data source results.
 *
 * **Details:**
 * - flag key: `sqlExpressions`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseSqlExpressions = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('sqlExpressions', false, options);
};

/**
 * Enables column autocomplete for SQL Expressions
 *
 * **Details:**
 * - flag key: `sqlExpressionsColumnAutoComplete`
 * - default value: `false`
 * - type: `boolean`
 */
export const useSqlExpressionsColumnAutoComplete = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('sqlExpressionsColumnAutoComplete', false, options);
};

/**
 * Enables column autocomplete for SQL Expressions
 *
 * **Details:**
 * - flag key: `sqlExpressionsColumnAutoComplete`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseSqlExpressionsColumnAutoComplete = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('sqlExpressionsColumnAutoComplete', false, options);
};

/**
 * Send query to the same datasource in a single request when using server side expressions. The `cloudWatchBatchQueries` feature toggle should be enabled if this used with CloudWatch.
 *
 * **Details:**
 * - flag key: `sseGroupByDatasource`
 * - default value: `false`
 * - type: `boolean`
 */
export const useSseGroupByDatasource = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('sseGroupByDatasource', false, options);
};

/**
 * Send query to the same datasource in a single request when using server side expressions. The `cloudWatchBatchQueries` feature toggle should be enabled if this used with CloudWatch.
 *
 * **Details:**
 * - flag key: `sseGroupByDatasource`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseSseGroupByDatasource = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('sseGroupByDatasource', false, options);
};

/**
 * populate star status from apiserver
 *
 * **Details:**
 * - flag key: `starsFromAPIServer`
 * - default value: `false`
 * - type: `boolean`
 */
export const useStarsFromApiserver = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('starsFromAPIServer', false, options);
};

/**
 * populate star status from apiserver
 *
 * **Details:**
 * - flag key: `starsFromAPIServer`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseStarsFromApiserver = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('starsFromAPIServer', false, options);
};

/**
 * Configurable storage for dashboards, datasources, and resources
 *
 * **Details:**
 * - flag key: `storage`
 * - default value: `false`
 * - type: `boolean`
 */
export const useStorage = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('storage', false, options);
};

/**
 * Configurable storage for dashboards, datasources, and resources
 *
 * **Details:**
 * - flag key: `storage`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseStorage = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('storage', false, options);
};

/**
 * Displays datasource provisioned and community dashboards in dashboard empty page, only when coming from datasource configuration page
 *
 * **Details:**
 * - flag key: `suggestedDashboards`
 * - default value: `false`
 * - type: `boolean`
 */
export const useSuggestedDashboards = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('suggestedDashboards', false, options);
};

/**
 * Displays datasource provisioned and community dashboards in dashboard empty page, only when coming from datasource configuration page
 *
 * **Details:**
 * - flag key: `suggestedDashboards`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseSuggestedDashboards = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('suggestedDashboards', false, options);
};

/**
 * Enables shared crosshair in table panel
 *
 * **Details:**
 * - flag key: `tableSharedCrosshair`
 * - default value: `false`
 * - type: `boolean`
 */
export const useTableSharedCrosshair = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('tableSharedCrosshair', false, options);
};

/**
 * Enables shared crosshair in table panel
 *
 * **Details:**
 * - flag key: `tableSharedCrosshair`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseTableSharedCrosshair = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('tableSharedCrosshair', false, options);
};

/**
 * Use fixed-width numbers globally in the UI
 *
 * **Details:**
 * - flag key: `tabularNumbers`
 * - default value: `false`
 * - type: `boolean`
 */
export const useTabularNumbers = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('tabularNumbers', false, options);
};

/**
 * Use fixed-width numbers globally in the UI
 *
 * **Details:**
 * - flag key: `tabularNumbers`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseTabularNumbers = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('tabularNumbers', false, options);
};

/**
 * Enables team folders functionality
 *
 * **Details:**
 * - flag key: `teamFolders`
 * - default value: `false`
 * - type: `boolean`
 */
export const useTeamFolders = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('teamFolders', false, options);
};

/**
 * Enables team folders functionality
 *
 * **Details:**
 * - flag key: `teamFolders`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseTeamFolders = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('teamFolders', false, options);
};

/**
 * Use the Kubernetes TeamLBACRule API for team HTTP headers on datasource query requests
 *
 * **Details:**
 * - flag key: `teamHttpHeadersFromAppPlatform`
 * - default value: `false`
 * - type: `boolean`
 */
export const useTeamHttpHeadersFromAppPlatform = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('teamHttpHeadersFromAppPlatform', false, options);
};

/**
 * Use the Kubernetes TeamLBACRule API for team HTTP headers on datasource query requests
 *
 * **Details:**
 * - flag key: `teamHttpHeadersFromAppPlatform`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseTeamHttpHeadersFromAppPlatform = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('teamHttpHeadersFromAppPlatform', false, options);
};

/**
 * Enables LBAC for datasources for Tempo to apply LBAC filtering of traces to the client requests for users in teams
 *
 * **Details:**
 * - flag key: `teamHttpHeadersTempo`
 * - default value: `false`
 * - type: `boolean`
 */
export const useTeamHttpHeadersTempo = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('teamHttpHeadersTempo', false, options);
};

/**
 * Enables LBAC for datasources for Tempo to apply LBAC filtering of traces to the client requests for users in teams
 *
 * **Details:**
 * - flag key: `teamHttpHeadersTempo`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseTeamHttpHeadersTempo = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('teamHttpHeadersTempo', false, options);
};

/**
 * Enables creating alerts from Tempo data source
 *
 * **Details:**
 * - flag key: `tempoAlerting`
 * - default value: `false`
 * - type: `boolean`
 */
export const useTempoAlerting = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('tempoAlerting', false, options);
};

/**
 * Enables creating alerts from Tempo data source
 *
 * **Details:**
 * - flag key: `tempoAlerting`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseTempoAlerting = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('tempoAlerting', false, options);
};

/**
 * Enables time comparison option in supported panels
 *
 * **Details:**
 * - flag key: `timeComparison`
 * - default value: `false`
 * - type: `boolean`
 */
export const useTimeComparison = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('timeComparison', false, options);
};

/**
 * Enables time comparison option in supported panels
 *
 * **Details:**
 * - flag key: `timeComparison`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseTimeComparison = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('timeComparison', false, options);
};

/**
 * Enables time range panning functionality
 *
 * **Details:**
 * - flag key: `timeRangePan`
 * - default value: `true`
 * - type: `boolean`
 */
export const useTimeRangePan = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('timeRangePan', true, options);
};

/**
 * Enables time range panning functionality
 *
 * **Details:**
 * - flag key: `timeRangePan`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseTimeRangePan = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('timeRangePan', true, options);
};

/**
 * Enables time pickers sync
 *
 * **Details:**
 * - flag key: `timeRangeProvider`
 * - default value: `false`
 * - type: `boolean`
 */
export const useTimeRangeProvider = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('timeRangeProvider', false, options);
};

/**
 * Enables time pickers sync
 *
 * **Details:**
 * - flag key: `timeRangeProvider`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseTimeRangeProvider = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('timeRangeProvider', false, options);
};

/**
 * Show transformation quick-start cards in empty transformations state
 *
 * **Details:**
 * - flag key: `transformationsEmptyPlaceholder`
 * - default value: `false`
 * - type: `boolean`
 */
export const useTransformationsEmptyPlaceholder = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('transformationsEmptyPlaceholder', false, options);
};

/**
 * Show transformation quick-start cards in empty transformations state
 *
 * **Details:**
 * - flag key: `transformationsEmptyPlaceholder`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseTransformationsEmptyPlaceholder = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('transformationsEmptyPlaceholder', false, options);
};

/**
 * Enable TTL plugin instance manager
 *
 * **Details:**
 * - flag key: `ttlPluginInstanceManager`
 * - default value: `false`
 * - type: `boolean`
 */
export const useTtlPluginInstanceManager = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('ttlPluginInstanceManager', false, options);
};

/**
 * Enable TTL plugin instance manager
 *
 * **Details:**
 * - flag key: `ttlPluginInstanceManager`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseTtlPluginInstanceManager = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('ttlPluginInstanceManager', false, options);
};

/**
 * Enables unified navbars
 *
 * **Details:**
 * - flag key: `unifiedNavbars`
 * - default value: `false`
 * - type: `boolean`
 */
export const useUnifiedNavbars = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('unifiedNavbars', false, options);
};

/**
 * Enables unified navbars
 *
 * **Details:**
 * - flag key: `unifiedNavbars`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseUnifiedNavbars = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('unifiedNavbars', false, options);
};

/**
 * Enables to save big objects in blob storage
 *
 * **Details:**
 * - flag key: `unifiedStorageBigObjectsSupport`
 * - default value: `false`
 * - type: `boolean`
 */
export const useUnifiedStorageBigObjectsSupport = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('unifiedStorageBigObjectsSupport', false, options);
};

/**
 * Enables to save big objects in blob storage
 *
 * **Details:**
 * - flag key: `unifiedStorageBigObjectsSupport`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseUnifiedStorageBigObjectsSupport = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('unifiedStorageBigObjectsSupport', false, options);
};

/**
 * Enables the unified storage grpc connection pool
 *
 * **Details:**
 * - flag key: `unifiedStorageGrpcConnectionPool`
 * - default value: `false`
 * - type: `boolean`
 */
export const useUnifiedStorageGrpcConnectionPool = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('unifiedStorageGrpcConnectionPool', false, options);
};

/**
 * Enables the unified storage grpc connection pool
 *
 * **Details:**
 * - flag key: `unifiedStorageGrpcConnectionPool`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseUnifiedStorageGrpcConnectionPool = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('unifiedStorageGrpcConnectionPool', false, options);
};

/**
 * Enable dual reader for unified storage search
 *
 * **Details:**
 * - flag key: `unifiedStorageSearchDualReaderEnabled`
 * - default value: `false`
 * - type: `boolean`
 */
export const useUnifiedStorageSearchDualReaderEnabled = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('unifiedStorageSearchDualReaderEnabled', false, options);
};

/**
 * Enable dual reader for unified storage search
 *
 * **Details:**
 * - flag key: `unifiedStorageSearchDualReaderEnabled`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseUnifiedStorageSearchDualReaderEnabled = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('unifiedStorageSearchDualReaderEnabled', false, options);
};

/**
 * Enable unified storage search UI
 *
 * **Details:**
 * - flag key: `unifiedStorageSearchUI`
 * - default value: `false`
 * - type: `boolean`
 */
export const useUnifiedStorageSearchUi = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('unifiedStorageSearchUI', false, options);
};

/**
 * Enable unified storage search UI
 *
 * **Details:**
 * - flag key: `unifiedStorageSearchUI`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseUnifiedStorageSearchUi = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('unifiedStorageSearchUI', false, options);
};

/**
 * Enables unlimited dashboard panel grouping
 *
 * **Details:**
 * - flag key: `unlimitedLayoutsNesting`
 * - default value: `false`
 * - type: `boolean`
 */
export const useUnlimitedLayoutsNesting = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('unlimitedLayoutsNesting', false, options);
};

/**
 * Enables unlimited dashboard panel grouping
 *
 * **Details:**
 * - flag key: `unlimitedLayoutsNesting`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseUnlimitedLayoutsNesting = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('unlimitedLayoutsNesting', false, options);
};

/**
 * Routes short url requests from /api to the /apis endpoint in the frontend. Depends on kubernetesShortURLs
 *
 * **Details:**
 * - flag key: `useKubernetesShortURLsAPI`
 * - default value: `false`
 * - type: `boolean`
 */
export const useUseKubernetesShortUrlsApi = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('useKubernetesShortURLsAPI', false, options);
};

/**
 * Routes short url requests from /api to the /apis endpoint in the frontend. Depends on kubernetesShortURLs
 *
 * **Details:**
 * - flag key: `useKubernetesShortURLsAPI`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseUseKubernetesShortUrlsApi = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('useKubernetesShortURLsAPI', false, options);
};

/**
 * Enables plugins decoupling from bootdata
 *
 * **Details:**
 * - flag key: `useMTPlugins`
 * - default value: `false`
 * - type: `boolean`
 */
export const useUseMtplugins = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('useMTPlugins', false, options);
};

/**
 * Enables plugins decoupling from bootdata
 *
 * **Details:**
 * - flag key: `useMTPlugins`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseUseMtplugins = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('useMTPlugins', false, options);
};

/**
 * Makes the frontend use the 'names' param for fetching multiple scope nodes at once
 *
 * **Details:**
 * - flag key: `useMultipleScopeNodesEndpoint`
 * - default value: `false`
 * - type: `boolean`
 */
export const useUseMultipleScopeNodesEndpoint = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('useMultipleScopeNodesEndpoint', false, options);
};

/**
 * Makes the frontend use the 'names' param for fetching multiple scope nodes at once
 *
 * **Details:**
 * - flag key: `useMultipleScopeNodesEndpoint`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseUseMultipleScopeNodesEndpoint = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('useMultipleScopeNodesEndpoint', false, options);
};

/**
 * Use the new datasource API groups for datasource CRUD requests
 *
 * **Details:**
 * - flag key: `useNewAPIsForDatasourceCRUD`
 * - default value: `false`
 * - type: `boolean`
 */
export const useUseNewApisForDatasourceCrud = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('useNewAPIsForDatasourceCRUD', false, options);
};

/**
 * Use the new datasource API groups for datasource CRUD requests
 *
 * **Details:**
 * - flag key: `useNewAPIsForDatasourceCRUD`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseUseNewApisForDatasourceCrud = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('useNewAPIsForDatasourceCRUD', false, options);
};

/**
 * Use the single node endpoint for the scope api. This is used to fetch the scope parent node.
 *
 * **Details:**
 * - flag key: `useScopeSingleNodeEndpoint`
 * - default value: `false`
 * - type: `boolean`
 */
export const useUseScopeSingleNodeEndpoint = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('useScopeSingleNodeEndpoint', false, options);
};

/**
 * Use the single node endpoint for the scope api. This is used to fetch the scope parent node.
 *
 * **Details:**
 * - flag key: `useScopeSingleNodeEndpoint`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseUseScopeSingleNodeEndpoint = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('useScopeSingleNodeEndpoint', false, options);
};

/**
 * Use the scopes navigation endpoint instead of the dashboardbindings endpoint
 *
 * **Details:**
 * - flag key: `useScopesNavigationEndpoint`
 * - default value: `false`
 * - type: `boolean`
 */
export const useUseScopesNavigationEndpoint = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('useScopesNavigationEndpoint', false, options);
};

/**
 * Use the scopes navigation endpoint instead of the dashboardbindings endpoint
 *
 * **Details:**
 * - flag key: `useScopesNavigationEndpoint`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseUseScopesNavigationEndpoint = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('useScopesNavigationEndpoint', false, options);
};

/**
 * Use session storage for handling the redirection after login
 *
 * **Details:**
 * - flag key: `useSessionStorageForRedirection`
 * - default value: `true`
 * - type: `boolean`
 */
export const useUseSessionStorageForRedirection = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('useSessionStorageForRedirection', true, options);
};

/**
 * Use session storage for handling the redirection after login
 *
 * **Details:**
 * - flag key: `useSessionStorageForRedirection`
 * - default value: `true`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseUseSessionStorageForRedirection = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('useSessionStorageForRedirection', true, options);
};

/**
 * Allows authenticated API calls in actions
 *
 * **Details:**
 * - flag key: `vizActionsAuth`
 * - default value: `false`
 * - type: `boolean`
 */
export const useVizActionsAuth = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('vizActionsAuth', false, options);
};

/**
 * Allows authenticated API calls in actions
 *
 * **Details:**
 * - flag key: `vizActionsAuth`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseVizActionsAuth = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('vizActionsAuth', false, options);
};

/**
 * Enable visualization presets
 *
 * **Details:**
 * - flag key: `vizPresets`
 * - default value: `false`
 * - type: `boolean`
 */
export const useVizPresets = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('vizPresets', false, options);
};

/**
 * Enable visualization presets
 *
 * **Details:**
 * - flag key: `vizPresets`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseVizPresets = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('vizPresets', false, options);
};

/**
 * Use openFGA as authorization engine.
 *
 * **Details:**
 * - flag key: `zanzana`
 * - default value: `false`
 * - type: `boolean`
 */
export const useZanzana = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('zanzana', false, options);
};

/**
 * Use openFGA as authorization engine.
 *
 * **Details:**
 * - flag key: `zanzana`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseZanzana = (options?: ReactFlagEvaluationNoSuspenseOptions): FlagQuery<boolean> => {
  return useSuspenseFlag('zanzana', false, options);
};

/**
 * Use openFGA as main authorization engine and disable legacy RBAC clietn.
 *
 * **Details:**
 * - flag key: `zanzanaNoLegacyClient`
 * - default value: `false`
 * - type: `boolean`
 */
export const useZanzanaNoLegacyClient = (options?: ReactFlagEvaluationOptions): FlagQuery<boolean> => {
  return useFlag('zanzanaNoLegacyClient', false, options);
};

/**
 * Use openFGA as main authorization engine and disable legacy RBAC clietn.
 *
 * **Details:**
 * - flag key: `zanzanaNoLegacyClient`
 * - default value: `false`
 * - type: `boolean`
 *
 * Equivalent to useFlag with options: `{ suspend: true }`
 * @experimental — Suspense is an experimental feature subject to change in future versions.
 */
export const useSuspenseZanzanaNoLegacyClient = (
  options?: ReactFlagEvaluationNoSuspenseOptions
): FlagQuery<boolean> => {
  return useSuspenseFlag('zanzanaNoLegacyClient', false, options);
};
