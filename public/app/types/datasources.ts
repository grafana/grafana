import { LayoutMode } from '../core/components/LayoutSelector/LayoutSelector';
import { Plugin } from './plugins';
import { DataSourceSettings } from '@grafana/ui/src/types';

export interface DataSourcesState {
  dataSources: DataSourceSettings[];
  searchQuery: string;
  dataSourceTypeSearchQuery: string;
  layoutMode: LayoutMode;
  dataSourcesCount: number;
  dataSourceTypes: Plugin[];
  dataSource: DataSourceSettings;
  dataSourceMeta: Plugin;
  hasFetched: boolean;
  isLoadingDataSources: boolean;
}
