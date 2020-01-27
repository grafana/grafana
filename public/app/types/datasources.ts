import { LayoutMode } from '../core/components/LayoutSelector/LayoutSelector';
import { DataSourceSettings, DataSourcePluginMeta } from '@grafana/data';
import { GenericDataSourcePlugin } from 'app/features/datasources/settings/PluginSettings';

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
  plugin?: GenericDataSourcePlugin;
  testingStatus?: {
    message?: string;
    status?: string;
  };
  loadError?: string;
}

export interface DataSourcePluginCategory {
  id: string;
  title: string;
  plugins: DataSourcePluginMeta[];
}
