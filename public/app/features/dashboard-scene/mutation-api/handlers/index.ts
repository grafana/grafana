/**
 * Mutation Handlers
 *
 * Pure functions that implement dashboard mutations.
 * Each handler receives a payload and context, and returns a MutationResult.
 */

import type { DashboardScene } from '../../scene/DashboardScene';
import type { MutationResult, MutationChange, MutationTransaction } from '../types';

/**
 * Context passed to all mutation handlers
 */
export interface MutationContext {
  scene: DashboardScene;
  transaction: MutationTransactionInternal;
}

/**
 * Internal transaction type with mutable changes array
 */
export interface MutationTransactionInternal extends MutationTransaction {
  changes: MutationChange[];
}

/**
 * A mutation handler function.
 * The executor validates the payload before calling, so it's safe to treat as the expected type.
 */
export type MutationHandler = (payload: unknown, context: MutationContext) => Promise<MutationResult>;

/**
 * Create a typed handler that satisfies the MutationHandler signature.
 *
 * The executor validates the payload with Zod before calling the handler,
 * so the cast is safe. This eliminates the need for `as XPayload` casts
 * inside every handler.
 */
export function createHandler<T>(
  handler: (payload: T, context: MutationContext) => Promise<MutationResult>
): MutationHandler {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- safe: executor validates with Zod before dispatch
  return handler as MutationHandler;
}

/**
 * Result of a permission check for a command.
 * When not allowed, includes the reason and what permissions are needed.
 */
export type PermissionCheckResult = { allowed: true } | { allowed: false; error: string };

/**
 * Checks whether the current scene allows executing a command.
 * Each command defines its own permission requirements.
 */
export type PermissionCheck = (scene: DashboardScene) => PermissionCheckResult;

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

// eslint-disable-next-line no-barrel-files/no-barrel-files
export { handleAddPanel, handleRemovePanel, handleUpdatePanel } from './panelHandlers';
// eslint-disable-next-line no-barrel-files/no-barrel-files
export { handleAddVariable, handleRemoveVariable, handleUpdateVariable, handleListVariables } from './variableHandlers';
// eslint-disable-next-line no-barrel-files/no-barrel-files
export {
  handleUpdateTimeSettings,
  handleUpdateDashboardMeta,
  handleGetDashboardInfo,
  handleEnterEditMode,
} from './dashboardHandlers';
