import { DashboardAcl } from './acl';

export interface MutableDashboard {
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
