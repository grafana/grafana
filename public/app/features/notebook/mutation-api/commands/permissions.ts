/**
 * Permission checks for the notebook mutation commands.
 *
 * Much smaller than the dashboard rules in `dashboard-scene/mutation-api/commands/types.ts`, and
 * deliberately so: a notebook has no edit mode to enter, no snapshot state and no `canEditDashboard()`
 * to consult. Nor does any rule here have to ask whether the open document is a notebook — these
 * commands are only registered on a notebook's client, so a dashboard can never reach them.
 */

import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { contextSrv } from 'app/core/services/context_srv';
import { type PermissionCheckResult } from 'app/features/dashboard-scene/mutation-api/commands/types';
import { AccessControlAction } from 'app/types/accessControl';

/**
 * Requires notebooks to be enabled on this instance.
 *
 * Checked by every notebook command rather than left to `NotebookScenePage`, which also gates on the
 * flag. The page's check is about whether a route renders; this one is the API's own gate, and it has
 * to hold for CREATE, which runs from a page that is not a notebook at all.
 */
function requiresNotebooksEnabled(): PermissionCheckResult {
  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.DashboardNotebooks, false)) {
    return {
      allowed: false,
      error: 'Notebooks are not enabled on this instance (feature flag dashboard.notebooks).',
    };
  }
  return { allowed: true };
}

/** Read-only access to the open notebook. */
export function requiresNotebookRead(): PermissionCheckResult {
  return requiresNotebooksEnabled();
}

/**
 * Requires that the open notebook can be edited.
 *
 * The permission is the dashboards write action, matching how the notebook editor gates itself. That
 * is coarse: it is an org-level action, not a check against this notebook's folder.
 * `notebook_authorizer.go` defers to the same authorizer dashboards use and the apiserver authorizes
 * the eventual save per resource, and nothing here is persisted, so the blast radius of the coarseness
 * is a scene the user could not have saved anyway. A notebook-scoped action is the right long-term
 * answer and is tracked with the resource's permission model.
 */
export function requiresNotebookEdit(): PermissionCheckResult {
  const enabled = requiresNotebooksEnabled();
  if (!enabled.allowed) {
    return enabled;
  }
  if (!contextSrv.hasPermission(AccessControlAction.DashboardsWrite)) {
    return { allowed: false, error: 'Cannot edit notebook: insufficient permissions.' };
  }
  return { allowed: true };
}

/**
 * Requires that a notebook can be created.
 *
 * Unlike the other rules this says nothing about the open document, because CREATE is the one notebook
 * command that runs from anywhere — a dashboard, a drilldown, another notebook — there being no blank
 * notebook to open first.
 */
export function requiresNotebookCreate(): PermissionCheckResult {
  const enabled = requiresNotebooksEnabled();
  if (!enabled.allowed) {
    return enabled;
  }
  if (!contextSrv.hasPermission(AccessControlAction.DashboardsCreate)) {
    return { allowed: false, error: 'Cannot create notebook: insufficient permissions.' };
  }
  return { allowed: true };
}
