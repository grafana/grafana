import { DashboardAcl } from './acl';

export interface MutableDashboard {
  meta: DashboardMeta;
}

export interface DashboardDTO {
  redirectUri?: string;
  dashboard: DashboardDataDTO;
  meta: DashboardMeta;
}

export interface DashboardMeta {
  canSave?: boolean;
  canEdit?: boolean;
  canShare?: boolean;
  canStar?: boolean;
  canAdmin?: boolean;
  url?: string;
  folderId?: number;
  fullscreen?: boolean;
  isEditing?: boolean;
  canMakeEditable?: boolean;
  submenuEnabled?: boolean;
  provisioned?: boolean;
  focusPanelId?: boolean;
  isStarred?: boolean;
  showSettings?: boolean;
  expires: string;
  isSnapshot?: boolean;
  folderTitle?: string;
  folderUrl?: string;
  created?: string;
}

export interface DashboardDataDTO {
  title: string;
}

export enum DashboardRouteInfo {
  Home = 'home-dashboard',
  New = 'new-dashboard',
  Normal = 'normal-dashboard',
  Scripted = 'scripted-dashboard',
}

export enum DashboardLoadingState {
  NotStarted = 'Not started',
  Fetching = 'Fetching',
  Initializing = 'Initializing',
  Error = 'Error',
  Done = 'Done',
}

export const KIOSK_MODE_TV = 'tv';
export type KioskUrlValue = 'tv' | '1' | true;

export interface DashboardState {
  model: MutableDashboard | null;
  loadingState: DashboardLoadingState;
  isLoadingSlow: boolean;
  permissions: DashboardAcl[] | null;
}
