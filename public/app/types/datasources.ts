import { type DataSourcePluginMeta, type DataSourceSettings, type LayoutMode } from '@grafana/data';
import { type TestingStatus } from '@grafana/runtime';
import { type DataSourceListItem } from 'app/features/datasources/api';
import { type GenericDataSourcePlugin } from 'app/features/datasources/types';

export interface DataSourcesState {
  dataSources: DataSourceListItem[];
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
  loading: boolean;
}

export interface DataSourcePluginCategory {
  id: string;
  title: string;
  plugins: DataSourcePluginMeta[];
}
