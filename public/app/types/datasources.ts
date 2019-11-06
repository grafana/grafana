import { LayoutMode } from '../core/components/LayoutSelector/LayoutSelector';
import { DataSourceSettings, DataSourcePluginMeta } from '@grafana/data';

export interface DataSourcesState {
  dataSources: DataSourceSettings[];
  searchQuery: string;
  dataSourceTypeSearchQuery: string;
  layoutMode: LayoutMode;
  dataSourcesCount: number;
  dataSourceTypes: DataSourcePluginMeta[];
  dataSource: DataSourceSettings;
  dataSourceMeta: DataSourcePluginMeta;
  hasFetched: boolean;
  isLoadingDataSources: boolean;
}
