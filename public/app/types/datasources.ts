import { LayoutMode } from '../core/components/LayoutSelector/LayoutSelector';
import { DataSourcePluginMeta, DataSourceSettings } from '@grafana/data';
import { GenericDataSourcePlugin } from 'app/features/datasources/settings/PluginSettings';
import { HealthCheckResult } from '@grafana/runtime';

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

export interface DataSourceSettingsState {
  plugin?: GenericDataSourcePlugin | null;
  testingStatus?: {
    message?: string | null;
    status?: string | null;
    details?: HealthCheckResult['details'];
  };
  loadError?: string | null;
}

export interface DataSourcePluginCategory {
  id: string;
  title: string;
  plugins: DataSourcePluginMeta[];
}
