import { DataQuery } from '@grafana/data';
import { Dashboard } from '@grafana/schema';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';

import { DashboardAcl } from './acl';

export interface DashboardDTO {
  redirectUri?: string;
  dashboard: DashboardDataDTO;
  meta: DashboardMeta;
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
  folderId?: number;
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
  created?: string;
  createdBy?: string;
  updated?: string;
  updatedBy?: string;
  fromScript?: boolean;
  fromFile?: boolean;
  hasUnsavedFolderChange?: boolean;
  annotationsPermissions?: AnnotationsPermissions;
  publicDashboardAccessToken?: string;
  publicDashboardUid?: string;
  publicDashboardEnabled?: boolean;
  dashboardNotFound?: boolean;
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
  Path = 'path-dashboard',
  Scripted = 'scripted-dashboard',
  Public = 'public-dashboard',
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
  TV = 'tv',
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
  initError: DashboardInitError | null;
  permissions: DashboardAcl[];
}
