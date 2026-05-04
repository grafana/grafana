import { type DataSourceInstanceSettings } from '@grafana/data';
import { type Dashboard } from '@grafana/schema';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type SaveDashboardCommand } from 'app/features/dashboard/components/SaveDashboard/types';

import { type ExternalDashboard } from '../dashboard/components/DashExportModal/DashboardExporter';
import { type LibraryElementDTO } from '../library-panels/types';

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

// Provisioning-optional fields (ref, path, comment, workflow, repo) are appended here rather
// than running a second useForm, because ImportForm's prop type is Pick<UseFormReturn<ImportDashboardDTO>, ...>
// and register is invariant in its key parameter — a second form would require rewiring every
// shared field. The fields are only rendered and validated when the target folder is repo-managed.
export interface ImportDashboardDTO {
  title: string;
  uid: string;
  gnetId: number | string;
  constants: string[];
  dataSources: DataSourceInstanceSettings[];
  elements: LibraryElementDTO[];
  folder: { uid: string; title?: string };
  // Provisioning fields — only used when importing into a repo-managed folder
  ref?: string;
  path?: string;
  comment?: string;
  workflow?: string;
  repo?: string;
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

// Provisioning-optional fields are widened on the Record<string, unknown> side so the same
// useForm instance can drive both standard and provisioned import paths.
export type ImportFormDataV2 = SaveDashboardCommand<DashboardV2Spec> &
  Record<string, unknown> & {
    ref?: string;
    path?: string;
    comment?: string;
    workflow?: string;
    repo?: string;
  };
