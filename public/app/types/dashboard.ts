import { DashboardAcl } from './acl';

export interface MutableDashboard {
  title: string;
  meta: DashboardMeta;
  destroy: () => void;
}

export interface DashboardDTO {
  redirectUri?: string;
  dashboard: DashboardDataDTO;
  meta: DashboardMeta;
}

export interface DashboardMeta {
  canSave?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
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
  provisionedExternalId?: string;
  focusPanelId?: number;
  isStarred?: boolean;
  showSettings?: boolean;
  expires?: string;
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

export const KIOSK_MODE_TV = 'tv';
export type KioskUrlValue = 'tv' | '1' | true;

export interface DashboardState {
  model: MutableDashboard | null;
  initPhase: DashboardInitPhase;
  isInitSlow: boolean;
  initError?: DashboardInitError;
  permissions: DashboardAcl[] | null;
}
