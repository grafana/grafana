/**
 * Command infrastructure types and permission checks.
 *
 * Provides the MutationCommand interface used by every command file,
 * plus the MutationContext passed to handlers and reusable permission checks.
 */

import { z } from 'zod';

import type { MutableDashboardScene, MutationResult } from '../types';

export interface MutationContext {
  scene: MutableDashboardScene;
}

export type PermissionCheckResult = { allowed: true } | { allowed: false; error: string };

export type PermissionCheck = (scene: MutableDashboardScene) => PermissionCheckResult;

/**
 * A complete mutation command: schema, handler, permission, and metadata.
 *
 * Each command file exports a single MutationCommand. The registry collects
 * them and the MutationExecutor iterates over them generically.
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
  /** The handler function. */
  handler: (payload: T, context: MutationContext) => Promise<MutationResult>;
}

/**
 * Requires edit permissions on the dashboard (pure check, no side effects).
 */
export function requiresEdit(scene: MutableDashboardScene): PermissionCheckResult {
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
export function readOnly(_scene: MutableDashboardScene): PermissionCheckResult {
  return { allowed: true };
}

/**
 * Enter edit mode if the dashboard is not already editing.
 * Call this at the top of any command handler that modifies the dashboard.
 */
export function enterEditModeIfNeeded(scene: MutableDashboardScene): void {
  if (!scene.state.isEditing) {
    scene.onEnterEditMode();
  }
}
