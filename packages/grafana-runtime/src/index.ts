/**
 * A library containing services, configurations etc. used to interact with the Grafana engine.
 *
 * @packageDocumentation
 */
export * from './services';
export * from './config';
export * from './analytics/types';
export { loadPluginCss, type PluginCssOptions, setPluginImportUtils, getPluginImportUtils } from './utils/plugin';
export { reportMetaAnalytics, reportInteraction, reportPageview, reportExperimentView } from './analytics/utils';
export { featureEnabled } from './utils/licensing';
export { logInfo, logDebug, logWarning, logError, createMonitoringLogger } from './utils/logging';
export {
  DataSourceWithBackend,
  HealthCheckError,
  type HealthCheckResult,
  type HealthCheckResultDetails,
  HealthStatus,
  type StreamOptionsProvider,
  isExpressionReference,
} from './utils/DataSourceWithBackend';
export {
  toDataQueryResponse,
  frameToMetricFindValue,
  type BackendDataSourceResponse,
  type DataResponse,
  type TestingStatus,
} from './utils/queryResponse';
export { PanelRenderer, type PanelRendererProps } from './components/PanelRenderer';
export { PanelDataErrorView, type PanelDataErrorViewProps } from './components/PanelDataErrorView';
export { toDataQueryError } from './utils/toDataQueryError';
export {
  setQueryRunnerFactory,
  createQueryRunner,
  type QueryRunnerFactory,
  setRunRequest,
  getRunRequest,
} from './services/QueryRunner';
export { PluginPage } from './components/PluginPage';
export type { PluginPageType, PluginPageProps } from './components/PluginPage';
export {
  DataSourcePicker,
  type DataSourcePickerProps,
  type DataSourcePickerState,
} from './components/DataSourcePicker';
export {
  type PluginEventProperties,
  createPluginEventProperties,
  type DataSourcePluginEventProperties,
  createDataSourcePluginEventProperties,
} from './analytics/plugins/eventProperties';
export { usePluginInteractionReporter } from './analytics/plugins/usePluginInteractionReporter';
export { setReturnToPreviousHook, useReturnToPrevious } from './utils/returnToPrevious';
export { setChromeHeaderHeightHook, useChromeHeaderHeight } from './utils/chromeHeaderHeight';
export { type EmbeddedDashboardProps, EmbeddedDashboard, setEmbeddedDashboard } from './components/EmbeddedDashboard';
export { hasPermission, hasPermissionInMetadata, hasAllPermissions, hasAnyPermission } from './utils/rbac';
export { QueryEditorWithMigration } from './components/QueryEditorWithMigration';
export { type MigrationHandler, isMigrationHandler, migrateQuery, migrateRequest } from './utils/migrationHandler';
export { usePluginUserStorage } from './utils/userStorage';
