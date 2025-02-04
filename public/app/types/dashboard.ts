import { DataQuery } from '@grafana/data';
import { Dashboard, DataSourceRef } from '@grafana/schema';
import { ObjectMeta } from 'app/features/apiserver/types';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';

export interface HomeDashboardRedirectDTO {
  redirectUri: string;
}

export interface DashboardDTO {
  dashboard: DashboardDataDTO;
  meta: DashboardMeta;
}

export interface ImportDashboardResponseDTO {
  uid: string;
  pluginId: string;
  title: string;
  imported: boolean;
  importedRevision?: number;
  importedUri: string;
  importedUrl: string;
  slug: string;
  dashboardId: number;
  folderId: number;
  folderUid: string;
  description: string;
  path: string;
  removed: boolean;
}

export interface SaveDashboardResponseDTO {
  id: number;
  slug: string;
  status: string;
  uid: string;
  url: string;
  version: number;
}

export interface DashboardMeta {
  slug?: string;
  uid?: string;
  canSave?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  canShare?: boolean;
  canStar?: boolean;
  canAdmin?: boolean;
  url?: string;
  folderUid?: string;
  canMakeEditable?: boolean;
  provisioned?: boolean;
  provisionedExternalId?: string;
  isStarred?: boolean;
  showSettings?: boolean;
  expires?: string;
  isFolder?: boolean;
  isSnapshot?: boolean;
  folderTitle?: string;
  folderUrl?: string;
  folderId?: number;
  created?: string;
  createdBy?: string;
  updated?: string;
  updatedBy?: string;
  fromScript?: boolean;
  fromFile?: boolean;
  hasUnsavedFolderChange?: boolean;
  annotationsPermissions?: AnnotationsPermissions;
  publicDashboardEnabled?: boolean;
  isEmbedded?: boolean;
  isNew?: boolean;
  version?: number;

  // When loaded from kubernetes, we stick the raw metadata here
  // yes weird, but this means all the editor structures can exist unchanged
  // until we use the resource as the main container
  k8s?: Partial<ObjectMeta>;

  // This is a property added specifically for edge cases where dashboards should be reloaded on scopes, time range or variables changes
  // This property is not persisted in the DB but its existence is controlled by the API
  reloadOnParamsChange?: boolean;
}

export interface AnnotationActions {
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface AnnotationsPermissions {
  dashboard: AnnotationActions;
  organization: AnnotationActions;
}

// FIXME: This should not override Dashboard types
export interface DashboardDataDTO extends Dashboard {
  title: string;
  uid: string;
  panels?: any[];
}

export enum DashboardRoutes {
  Home = 'home-dashboard',
  New = 'new-dashboard',
  Normal = 'normal-dashboard',
  Scripted = 'scripted-dashboard',
  Public = 'public-dashboard',
  Embedded = 'embedded-dashboard',
  Report = 'report-dashboard',
}

export enum DashboardInitPhase {
  NotStarted = 'Not started',
  Fetching = 'Fetching',
  Services = 'Services',
  Failed = 'Failed',
  Completed = 'Completed',
}

export interface DashboardInitError {
  message: string;
  error: unknown;
}

export enum KioskMode {
  Full = 'full',
}

export type GetMutableDashboardModelFn = () => DashboardModel | null;

export interface QueriesToUpdateOnDashboardLoad {
  panelId: number;
  queries: DataQuery[];
}

export interface DashboardState {
  getModel: GetMutableDashboardModelFn;
  initPhase: DashboardInitPhase;
  initialDatasource?: DataSourceRef['uid'];
  initError: DashboardInitError | null;
}

export const DASHBOARD_FROM_LS_KEY = 'DASHBOARD_FROM_LS_KEY';

export function isRedirectResponse(dto: DashboardDTO | HomeDashboardRedirectDTO): dto is HomeDashboardRedirectDTO {
  return 'redirectUri' in dto;
}
