import { DataQuery } from '@grafana/data';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { VariableModel } from 'app/features/variables/types';

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
  submenuEnabled?: boolean;
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
  publicDashboardEnabled?: boolean;
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

export interface DashboardDataDTO {
  title: string;
  uid: string;
  templating: {
    list: VariableModel[];
  };
  panels?: any[];

  /** @deprecated -- components should key on uid rather than id */
  id?: number;
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
  error: any;
}

export enum KioskMode {
  Off = 'off',
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
