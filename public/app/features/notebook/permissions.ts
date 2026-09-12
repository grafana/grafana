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

/** Creating a notebook is its own action, and the picker offers it as a separate route. */
export function canCreateNotebooks(): boolean {
  return contextSrv.hasPermission(AccessControlAction.DashboardsCreate);
}

/**
 * Delete is a separate action from write: a user who may edit a notebook is not automatically allowed
 * to remove it. Org-level for the same reason canEditNotebooks is — the list carries no per-resource
 * access info, so there is nothing to check a single notebook against.
 */
export function canDeleteNotebooks(): boolean {
  return contextSrv.hasPermission(AccessControlAction.DashboardsDelete);
}

/**
 * Either permission is enough to open the picker, because it offers two routes: adding to a notebook
 * that already exists needs write, and creating one needs create. The modal hides whichever tab the
 * user cannot use.
 */
export function canAddPanelToNotebook(): boolean {
  return canEditNotebooks() || canCreateNotebooks();
}
