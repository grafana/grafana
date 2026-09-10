import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

/**
 * Whether the current user can read saved queries from the query library.
 * With the savedQueriesRBAC toggle on this requires the queries:read permission;
 * otherwise any signed-in user can read. Kept in one place so the many call sites
 * that gate query library UI stay in sync if the access rules change.
 */
export const hasSavedQueryReadPermissions = () => {
  return config.featureToggles.savedQueriesRBAC
    ? contextSrv.hasPermission(AccessControlAction.QueriesRead)
    : contextSrv.isSignedIn;
};
