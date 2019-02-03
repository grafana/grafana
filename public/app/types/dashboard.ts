import { DashboardAcl } from './acl';

export interface MutableDashboard {
  meta: {
    fullscreen: boolean;
    isEditing: boolean;
  }
}

export enum DashboardLoadingState {
  NotStarted = 'Not started',
  Fetching  = 'Fetching',
  Initializing = 'Initializing',
  Error = 'Error',
  Done = 'Done',
}

export interface DashboardState {
  model: MutableDashboard | null;
  loadingState: DashboardLoadingState;
  permissions: DashboardAcl[] | null;
}
