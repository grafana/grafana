import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

/**
 * One action per verb, matching what the apiserver enforces: read/create/write/delete
 * (pkg/registry/apis/folders/sub_access.go). The fixed reader and writer roles bundle them, so these
 * only come apart for a custom role — where checking the wrong one both hides affordances a user is
 * entitled to and offers ones the backend will deny.
 *
 * All org-level rather than per-notebook: the list response carries no per-resource access info, so
 * there is nothing to check a single notebook against.
 */

/**
 * Not interchangeable with `DashboardScene.canEditDashboard()`, which also requires `!isEmbedded`.
 * Notebook scenes are always embedded, so that helper is false for every notebook.
 */
export function canEditNotebooks(): boolean {
  return contextSrv.hasPermission(AccessControlAction.NotebooksWrite);
}

/**
 * `notebooks:create` is granted on `folders:*` rather than `notebooks:*`, the create verb resolving
 * root to the general folder. It still answers here, because hasPermission ignores scope.
 */
export function canCreateNotebooks(): boolean {
  return contextSrv.hasPermission(AccessControlAction.NotebooksCreate);
}

/** Separate from write: editing a notebook does not imply being allowed to remove it. */
export function canDeleteNotebooks(): boolean {
  return contextSrv.hasPermission(AccessControlAction.NotebooksDelete);
}

/**
 * Either is enough to open the picker, which offers two routes: adding to a notebook that already
 * exists needs write, creating one needs create. The modal hides whichever tab the user cannot use.
 */
export function canAddPanelToNotebook(): boolean {
  return canEditNotebooks() || canCreateNotebooks();
}
