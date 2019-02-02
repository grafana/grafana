import { DashboardAcl } from './acl';

export interface Dashboard {
}

export enum DashboardLoadingState {
  NotStarted = 'Not started',
  Fetching  = 'Fetching',
  Initializing = 'Initializing',
  Error = 'Error',
  Done = 'Done',
}

export interface DashboardState {
  dashboard: Dashboard | null;
  loadingState: DashboardLoadingState;
  permissions: DashboardAcl[] | null;
}
