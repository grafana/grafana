import { LayoutMode } from '../core/components/LayoutSelector/LayoutSelector';
import { Plugin } from './plugins';

export interface DataSource {
  id: number;
  orgId: number;
  name: string;
  typeLogoUrl: string;
  type: string;
  access: string;
  url: string;
  password: string;
  user: string;
  database: string;
  basicAuth: boolean;
  isDefault: boolean;
  jsonData: { authType: string; defaultRegion: string };
  readOnly: boolean;
}

export interface DataSourcesState {
  dataSources: DataSource[];
  searchQuery: string;
  dataSourceTypeSearchQuery: string;
  layoutMode: LayoutMode;
  dataSourcesCount: number;
  dataSourceTypes: Plugin[];
  dataSource: DataSource;
  dataSourceMeta: Plugin;
  hasFetched: boolean;
}
