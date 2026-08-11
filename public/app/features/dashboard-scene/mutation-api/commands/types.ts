/**
 * Command infrastructure types and permission checks.
 *
 * Provides the MutationCommand interface used by every command file,
 * plus the MutationContext passed to handlers and reusable permission checks.
 */

import type * as z from 'zod';

import { config } from '@grafana/runtime';

import type { DashboardScene } from '../../scene/DashboardScene';
import type { MutationResult } from '../types';

/**
 * The scene a command operates on. Defaults to DashboardScene so a dashboard command file names
 * neither type parameter; a notebook command sets it to NotebookScene.
 */
export interface MutationContext<TScene = DashboardScene> {
  scene: TScene;
}

export type PermissionCheckResult = { allowed: true } | { allowed: false; error: string };

type PermissionCheck<TScene = DashboardScene> = (scene: TScene) => PermissionCheckResult;

/**
 * A complete mutation command: schema, handler, permission, and metadata.
 *
 * Each command file exports a single MutationCommand. A registry collects the commands for one
 * resource and SceneMutationClient iterates over them generically.
 *
 * `TScene` is what makes one client able to serve two document types: a command is only ever
 * dispatched by a client holding the scene it was typed for, so a dashboard handler cannot be
 * handed a notebook. A command that reads nothing off the scene (CREATE_NOTEBOOK_SPEC) types it
 * `unknown`, which — parameters being contravariant — makes it assignable to both registries.
 */
export interface MutationCommand<T = unknown, TScene = DashboardScene> {
  /** Command name -- must be UPPER_CASE. Used as the MutationType value. */
  name: string;
  /** Human-readable description. */
  description: string;
  /** Zod schema for runtime payload validation. Single source of truth. */
  payloadSchema: z.ZodType<T>;
  /** Permission check run before execution. Must be a pure predicate (no side effects). */
  permission: PermissionCheck<TScene>;
  /** When true, the command only reads state and will not trigger a forceRender. */
  readOnly?: boolean;
  /** The handler function. */
  handler: (payload: T, context: MutationContext<TScene>) => Promise<MutationResult>;
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
