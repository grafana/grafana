import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { hasAny } from './utils';

// Page-access predicates for the core sections, kept alongside each other so
// nav visibility and the route guards that will consume them can't drift.
// Feature-owned sections keep their own (e.g. alerting's utils/pageAccess).

export const dashboardsCreateAccess = () => contextSrv.hasPermission(AccessControlAction.DashboardsCreate);
export const dashboardVariablesAccess = () =>
  hasAny(AccessControlAction.DashboardsCreate, AccessControlAction.DashboardsWrite);
export const snapshotsAccess = () => contextSrv.hasPermission(AccessControlAction.SnapshotsRead);
export const playlistsAccess = () => contextSrv.hasPermission(AccessControlAction.PlaylistsRead);

export const serviceAccountsAccess = () =>
  hasAny(AccessControlAction.ServiceAccountsRead, AccessControlAction.ServiceAccountsCreate);
export const migrateToCloudAccess = () => contextSrv.hasPermission(AccessControlAction.MigrationAssistantMigrate);
