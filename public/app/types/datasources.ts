import { type DataSourcePluginMeta, type DataSourceSettings, type LayoutMode } from '@grafana/data';
import { type TestingStatus } from '@grafana/runtime';
import { type GenericDataSourcePlugin } from 'app/features/datasources/types';

export interface DataSourcesState {
  dataSources: DataSourceSettings[];
  searchQuery: string;
  dataSourceTypeSearchQuery: string;
  layoutMode: LayoutMode;
  dataSourcesCount: number;
  dataSource: DataSourceSettings;
  dataSourceMeta: DataSourcePluginMeta;
  isLoadingDataSources: boolean;
  isLoadingDataSourcePlugins: boolean;
  plugins: DataSourcePluginMeta[];
  categories: DataSourcePluginCategory[];
  isSortAscending: boolean;
}

export interface DataSourceSettingsState {
  plugin?: GenericDataSourcePlugin | null;
  testingStatus?: TestingStatus;
  loadError?: string | null;
  /** Set when the load failed because the plugin of the data source is not installed. */
  orphanedDataSource?: OrphanedDataSource;
  loading: boolean;
}

/** A stored data source whose plugin is not installed. */
export interface OrphanedDataSource {
  uid: string;
  name: string;
  pluginType: string;
}

export interface DataSourcePluginCategory {
  id: string;
  title: string;
  plugins: DataSourcePluginMeta[];
}
