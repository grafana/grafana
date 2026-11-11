import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

/**
 * Whether the current user can read saved queries from the query library (requires the
 * queries:read permission). Kept in one place so the many call sites that gate query
 * library UI stay in sync if the access rules change.
 */
export const hasSavedQueryReadPermissions = () => {
  return contextSrv.hasPermission(AccessControlAction.QueriesRead);
};
