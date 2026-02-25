/**
 * Command infrastructure types and permission checks.
 *
 * Provides the MutationCommand interface used by every command file,
 * plus the MutationContext passed to handlers and reusable permission checks.
 */

import { z } from 'zod';

import { config } from '@grafana/runtime';

import type { DashboardScene } from '../../scene/DashboardScene';
import type { MutationResult } from '../types';

export interface MutationContext {
  scene: DashboardScene;
}

export type PermissionCheckResult = { allowed: true } | { allowed: false; error: string };

export type PermissionCheck = (scene: DashboardScene) => PermissionCheckResult;

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
 * Enter edit mode if the dashboard is not already editing.
 * Call this at the top of any command handler that modifies the dashboard.
 */
export function enterEditModeIfNeeded(scene: DashboardScene): void {
  if (!scene.state.isEditing) {
    scene.onEnterEditMode();
  }
}
