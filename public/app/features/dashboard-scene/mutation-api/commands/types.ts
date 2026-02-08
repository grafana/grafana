/**
 * Command infrastructure types and permission checks.
 *
 * Provides the MutationCommand interface used by every command file,
 * plus the MutationContext passed to handlers and reusable permission checks.
 */

import { z } from 'zod';

import type { DashboardScene } from '../../scene/DashboardScene';
import type { MutationChange, MutationResult, MutationTransaction } from '../types';

/**
 * Context passed to all mutation handlers.
 */
export interface MutationContext {
  scene: DashboardScene;
  transaction: MutationTransactionInternal;
}

/**
 * Internal transaction type with mutable changes array.
 */
export interface MutationTransactionInternal extends MutationTransaction {
  changes: MutationChange[];
}

export type PermissionCheckResult = { allowed: true } | { allowed: false; error: string };

/**
 * Checks whether the current scene allows executing a command.
 */
export type PermissionCheck = (scene: DashboardScene) => PermissionCheckResult;

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
  /** Permission check run before execution. */
  permission: PermissionCheck;
  /** The handler function. */
  handler: (payload: T, context: MutationContext) => Promise<MutationResult>;
}

/**
 * Requires edit permissions on the dashboard.
 * Also enters edit mode if not already editing.
 */
export function requiresEdit(scene: DashboardScene): PermissionCheckResult {
  if (!scene.canEditDashboard()) {
    return {
      allowed: false,
      error: 'Cannot edit dashboard: insufficient permissions or dashboard is a snapshot',
    };
  }
  if (!scene.state.isEditing) {
    scene.onEnterEditMode();
  }
  return { allowed: true };
}

/**
 * No permission requirements -- read-only operations.
 */
export function readOnly(): PermissionCheckResult {
  return { allowed: true };
}
