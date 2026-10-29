/**
 * Permission checks for the notebook mutation commands. Much smaller than the dashboard rules in
 * `dashboard-scene/mutation-api/commands/types.ts`: a notebook has no edit mode to enter, no snapshot
 * state and no `canEditDashboard()` to consult.
 */

import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { contextSrv } from 'app/core/services/context_srv';
import { type PermissionCheckResult } from 'app/features/dashboard-scene/mutation-api/commands/types';
import { AccessControlAction } from 'app/types/accessControl';

/**
 * Checked here as well as by `NotebookScenePage`, whose check is only about whether a route renders: this
 * one has to hold for CREATE, which runs from a page that is not a notebook at all.
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

export function requiresNotebookRead(): PermissionCheckResult {
  const enabled = requiresNotebooksEnabled();
  if (!enabled.allowed) {
    return enabled;
  }
  if (!contextSrv.hasPermission(AccessControlAction.NotebooksRead)) {
    return { allowed: false, error: 'Cannot read notebook: insufficient permissions.' };
  }
  return { allowed: true };
}

/**
 * This is an org-level action, not a check against this notebook's folder: nothing here is persisted,
 * so the blast radius of a false positive is a scene the user could not have saved anyway — the
 * apiserver still authorizes the eventual save per resource.
 */
export function requiresNotebookEdit(): PermissionCheckResult {
  const enabled = requiresNotebooksEnabled();
  if (!enabled.allowed) {
    return enabled;
  }
  if (!contextSrv.hasPermission(AccessControlAction.NotebooksWrite)) {
    return { allowed: false, error: 'Cannot edit notebook: insufficient permissions.' };
  }
  return { allowed: true };
}

/**
 * Says nothing about the open document: CREATE runs from anywhere. Checked against
 * `notebooks:create`, which is the action the apiserver authorizes the create verb with.
 */
export function requiresNotebookCreate(): PermissionCheckResult {
  const enabled = requiresNotebooksEnabled();
  if (!enabled.allowed) {
    return enabled;
  }
  if (!contextSrv.hasPermission(AccessControlAction.NotebooksCreate)) {
    return { allowed: false, error: 'Cannot create notebook: insufficient permissions.' };
  }
  return { allowed: true };
}
