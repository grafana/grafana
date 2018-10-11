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
  basicAuth: false;
  isDefault: false;
  jsonData: { authType: string; defaultRegion: string };
  readOnly: false;
}

export interface DataSourcesState {
  dataSources: DataSource[];
  searchQuery: string;
  dataSourceTypeSearchQuery: string;
  layoutMode: LayoutMode;
  dataSourcesCount: number;
  dataSourceTypes: Plugin[];
  hasFetched: boolean;
}
