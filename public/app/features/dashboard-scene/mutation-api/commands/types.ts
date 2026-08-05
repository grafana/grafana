/**
 * Command infrastructure types and permission checks.
 *
 * Provides the MutationCommand interface used by every command file,
 * plus the MutationContext passed to handlers and reusable permission checks.
 */

import type * as z from 'zod';

import { config } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import type { DashboardScene } from '../../scene/DashboardScene';
import { isNotebookScene } from '../../serialization/notebookSpecTransform';
import type { MutationResult } from '../types';

export interface MutationContext {
  scene: DashboardScene;
}

export type PermissionCheckResult = { allowed: true } | { allowed: false; error: string };

type PermissionCheck = (scene: DashboardScene) => PermissionCheckResult;

/**
 * A complete mutation command: schema, handler, permission, and metadata.
 *
 * Each command file exports a single MutationCommand. The registry collects
 * them and the DashboardMutationClient iterates over them generically.
 */
export interface MutationCommand<T = unknown> {
  /** Command name -- must be UPPER_CASE. Used as the MutationType value. */
  name: string;
  /** Human-readable description. */
  description: string;
  /** Zod schema for runtime payload validation. Single source of truth. */
  payloadSchema: z.ZodType<T>;
  /** Permission check run before execution. Must be a pure predicate (no side effects). */
  permission: PermissionCheck;
  /** When true, the command only reads state and will not trigger a forceRender. */
  readOnly?: boolean;
  /** The handler function. */
  handler: (payload: T, context: MutationContext) => Promise<MutationResult>;
}

/**
 * Requires edit permissions on the dashboard (pure check, no side effects).
 */
export function requiresEdit(scene: DashboardScene): PermissionCheckResult {
  if (!scene.canEditDashboard()) {
    return {
      allowed: false,
      error: 'Cannot edit dashboard: insufficient permissions or dashboard is a snapshot',
    };
  }
  return { allowed: true };
}

/**
 * No permission requirements -- read-only operations.
 */
export function readOnly(_scene: DashboardScene): PermissionCheckResult {
  return { allowed: true };
}

/**
 * Requires the dashboardNewLayouts feature toggle AND edit permissions.
 * Used by all layout mutation commands (row/tab CRUD, panel movement).
 */
export function requiresNewDashboardLayouts(scene: DashboardScene): PermissionCheckResult {
  if (!config.featureToggles.dashboardNewLayouts) {
    return {
      allowed: false,
      error: 'Layout management requires the "dashboardNewLayouts" feature toggle to be enabled.',
    };
  }
  return requiresEdit(scene);
}

/**
 * Requires the dashboardNewLayouts feature toggle (read-only).
 * Used by GET_LAYOUT and other read-only layout commands.
 */
export function requiresNewDashboardLayoutsReadOnly(_scene: DashboardScene): PermissionCheckResult {
  if (!config.featureToggles.dashboardNewLayouts) {
    return {
      allowed: false,
      error: 'Layout management requires the "dashboardNewLayouts" feature toggle to be enabled.',
    };
  }
  return { allowed: true };
}

/**
 * Requires notebooks to be enabled on this instance. Split out from the resource check because a
 * create runs from any page, so it gates on the flag without requiring an open notebook.
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

/**
 * Requires the scene to be a notebook, on an instance where notebooks are enabled. The rule for the
 * read-only half of the notebook surface, and the base the edit rule builds on.
 */
export function requiresNotebookResource(scene: DashboardScene): PermissionCheckResult {
  const enabled = requiresNotebooksEnabled();
  if (!enabled.allowed) {
    return enabled;
  }
  if (!isNotebookScene(scene)) {
    return { allowed: false, error: 'This command applies to notebooks only: the open document is a dashboard.' };
  }
  return { allowed: true };
}

/**
 * Requires the scene to be a dashboard. The mirror of {@link requiresNotebookResource}, and the
 * reason each command names exactly one spec: a dashboard command asked of a notebook used to
 * answer, either by forwarding or — worse — by serializing the notebook through the dashboard
 * serializer, which silently drops every narrative cell.
 *
 * Deliberately not gated on the notebooks feature flag. The question here is what the open document
 * is, not whether the resource is enabled, and refusing has to work even if a notebook is somehow
 * rendered with the flag off.
 */
export function requiresDashboardResource(scene: DashboardScene): PermissionCheckResult {
  if (isNotebookScene(scene)) {
    return {
      allowed: false,
      error:
        'This command applies to dashboards only: the open document is a notebook. ' +
        'Use GET_NOTEBOOK_SPEC / APPLY_NOTEBOOK_SPEC instead.',
    };
  }
  return { allowed: true };
}

/**
 * Requires notebook editing to be possible: the resource must be enabled and the user must be
 * able to write dashboards.
 *
 * A notebook cannot reuse {@link requiresEdit}. The notebook page marks its scene `isEmbedded`
 * to hide the dashboard edit/share chrome, which makes `canEditDashboard()` false — so the
 * dashboard rule refuses every write to a notebook the user owns and can save. The read-only
 * chrome is a statement about hand editing on that page, not about the resource.
 *
 * The permission is the dashboards write action, matching how the notebook editor gates itself.
 * That is coarse: it is an org-level action, not a check against this notebook's folder. The
 * apiserver authorizes the eventual save per resource, and nothing here is persisted, so the
 * blast radius of the coarseness is a scene the user could not save anyway. A notebook-scoped
 * action is the right long-term answer and is tracked with the resource's permission model.
 */
export function requiresNotebookEdit(scene: DashboardScene): PermissionCheckResult {
  const resource = requiresNotebookResource(scene);
  if (!resource.allowed) {
    return resource;
  }
  if (scene.state.meta.isSnapshot) {
    return { allowed: false, error: 'Cannot edit notebook: it is a snapshot.' };
  }
  if (!contextSrv.hasPermission(AccessControlAction.DashboardsWrite)) {
    return { allowed: false, error: 'Cannot edit notebook: insufficient permissions.' };
  }
  return { allowed: true };
}

/**
 * Requires that a notebook can be created: the resource must be enabled and the user must be able to
 * create dashboards.
 *
 * Unlike the other notebook rules this does NOT require an open notebook. A create is the one
 * notebook command that runs from anywhere — a dashboard, a drilldown, another notebook — because
 * there is no blank notebook to open first.
 */
export function requiresNotebookCreate(_scene: DashboardScene): PermissionCheckResult {
  const enabled = requiresNotebooksEnabled();
  if (!enabled.allowed) {
    return enabled;
  }
  if (!contextSrv.hasPermission(AccessControlAction.DashboardsCreate)) {
    return { allowed: false, error: 'Cannot create notebook: insufficient permissions.' };
  }
  return { allowed: true };
}

/**
 * Write permission for the dashboard full-spec surface (APPLY_SPEC): the dashboard layout rule, plus
 * a refusal when the open document is a notebook.
 */
export function requiresDashboardSpecWrite(scene: DashboardScene): PermissionCheckResult {
  const resource = requiresDashboardResource(scene);
  return resource.allowed ? requiresNewDashboardLayouts(scene) : resource;
}

/**
 * Enter edit mode if the dashboard is not already editing.
 * Call this at the top of any command handler that modifies the dashboard.
 */
export function enterEditModeIfNeeded(scene: DashboardScene): void {
  if (!scene.state.isEditing) {
    scene.onEnterEditMode('assistant');
  }
  // New-layout mutations only run while the sidebar is active, and it may not be mounted here.
  scene.activateSidebar();
}
