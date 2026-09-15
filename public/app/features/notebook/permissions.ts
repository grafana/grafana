import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

/**
 * This is an org-level check, not a per-notebook one — the list response carries no per-resource
 * access info, so there is nothing to check a single notebook against.
 *
 * Note this is not interchangeable with `DashboardScene.canEditDashboard()`, which also requires
 * `!isEmbedded`. Notebook scenes are always embedded, so that helper is false for every notebook.
 */
export function canEditNotebooks(): boolean {
  return contextSrv.hasPermission(AccessControlAction.NotebooksWrite);
}

/**
 * Notebooks only have two fixed roles, reader and writer: there is no separate creator role, so
 * creating gates on the same write action as editing.
 */
export function canCreateNotebooks(): boolean {
  return contextSrv.hasPermission(AccessControlAction.NotebooksWrite);
}

/**
 * Same reasoning as canCreateNotebooks: there is no separate deleter role, only reader and writer, so
 * delete gates on write too.
 */
export function canDeleteNotebooks(): boolean {
  return contextSrv.hasPermission(AccessControlAction.NotebooksWrite);
}

/** canEditNotebooks and canCreateNotebooks are the same check today, but call sites name the one they mean. */
export function canAddPanelToNotebook(): boolean {
  return canEditNotebooks();
}
