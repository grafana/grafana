import { LayoutMode } from '../core/components/LayoutSelector/LayoutSelector';

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

export interface DataSourceType {
  name: string;
  type: string;
}

export interface DataSourcesState {
  dataSources: DataSource[];
  searchQuery: string;
  layoutMode: LayoutMode;
  dataSourcesCount: number;
  dataSourceTypes: DataSourceType[];
}
