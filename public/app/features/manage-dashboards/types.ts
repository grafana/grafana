import { DataSourceInstanceSettings } from '@grafana/data';
import { Dashboard } from '@grafana/schema';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import { SaveDashboardCommand } from 'app/features/dashboard/components/SaveDashboard/types';

import { ExternalDashboard } from '../dashboard/components/DashExportModal/DashboardExporter';
import { LibraryElementDTO } from '../library-panels/types';

// Dashboard JSON type for import
export type DashboardJson = ExternalDashboard & Omit<Dashboard, 'panels'>;

export type DeleteDashboardResponse = {
  id: number;
  message: string;
  title: string;
};

export interface PublicDashboardListWithPaginationResponse {
  publicDashboards: PublicDashboardListResponse[];
  page: number;
  perPage: number;
  totalCount: number;
}

export interface PublicDashboardListResponse {
  uid: string;
  accessToken: string;
  dashboardUid: string;
  title: string;
  slug: string;
  isEnabled: boolean;
}

export interface PublicDashboardListWithPagination extends PublicDashboardListWithPaginationResponse {
  totalPages: number;
}

// Import-related types
export enum DashboardSource {
  Gcom = 0,
  Json = 1,
}

export interface ImportDashboardDTO {
  title: string;
  uid: string;
  gnetId: string;
  constants: string[];
  dataSources: DataSourceInstanceSettings[];
  elements: LibraryElementDTO[];
  folder: { uid: string; title?: string };
}

export enum InputType {
  DataSource = 'datasource',
  Constant = 'constant',
  LibraryPanel = 'libraryPanel',
}

export enum LibraryPanelInputState {
  New = 'new',
  Exists = 'exists',
  Different = 'different',
}

export interface DashboardInput {
  name: string;
  label: string;
  description?: string;
  info: string;
  value: string;
  type: InputType;
}

export interface DataSourceInput extends DashboardInput {
  pluginId: string;
}

export interface LibraryPanelInput {
  model: LibraryElementDTO;
  state: LibraryPanelInputState;
}

export interface DashboardInputs {
  dataSources: DataSourceInput[];
  constants: DashboardInput[];
  libraryPanels: LibraryPanelInput[];
}

export type DatasourceSelection = { uid: string; type: string; name?: string };

export type ImportFormDataV2 = SaveDashboardCommand<DashboardV2Spec> & Record<string, unknown>;
