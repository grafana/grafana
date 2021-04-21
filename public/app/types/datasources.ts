import { DataSourcePluginMeta, DataSourceSettings, LayoutMode } from '@grafana/data';
import { GenericDataSourcePlugin } from 'app/features/datasources/settings/PluginSettings';
import { HealthCheckResultDetails } from '@grafana/runtime/src/utils/DataSourceWithBackend';

export interface DataSourcesState {
  dataSources: DataSourceSettings[];
  searchQuery: string;
  dataSourceTypeSearchQuery: string;
  layoutMode: LayoutMode;
  dataSourcesCount: number;
  dataSource: DataSourceSettings;
  dataSourceMeta: DataSourcePluginMeta;
  hasFetched: boolean;
  isLoadingDataSources: boolean;
  plugins: DataSourcePluginMeta[];
  categories: DataSourcePluginCategory[];
}

export interface TestingStatus {
  message?: string | null;
  status?: string | null;
  details?: HealthCheckResultDetails;
}

export interface DataSourceSettingsState {
  plugin?: GenericDataSourcePlugin | null;
  testingStatus?: TestingStatus;
  loadError?: string | null;
}

export interface DataSourcePluginCategory {
  id: string;
  title: string;
  plugins: DataSourcePluginMeta[];
}
