import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

/**
 * Notebooks deliberately reuse dashboard RBAC rather than defining their own actions: the backend's
 * notebook authorizer only adds the feature-flag gate and otherwise defers to the same authorizer
 * every other dashboard resource uses.
 *
 * This is an org-level check, not a per-notebook one — the list response carries no per-resource
 * access info, so there is nothing to check a single notebook against. It mirrors how the list page
 * already gates creation on `dashboards:create`.
 *
 * Note this is not interchangeable with `DashboardScene.canEditDashboard()`, which also requires
 * `!isEmbedded`. Notebook scenes are always embedded, so that helper is false for every notebook.
 */
export function canEditNotebooks(): boolean {
  return contextSrv.hasPermission(AccessControlAction.DashboardsWrite);
}
