import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

/**
 * Whether the current user may read (browse/use) custom dashboard templates. Mirrors the
 * backend authorizer, which evaluates the `dashboardtemplates:read` RBAC action.
 */
export const canReadDashboardTemplates = (): boolean =>
  contextSrv.hasPermission(AccessControlAction.DashboardTemplatesRead);

/**
 * Whether the current user may manage (create/edit/delete) custom dashboard templates. Mirrors
 * the backend authorizer, which evaluates the `dashboardtemplates:write` RBAC action.
 */
export const canManageDashboardTemplates = (): boolean =>
  contextSrv.hasPermission(AccessControlAction.DashboardTemplatesWrite);
