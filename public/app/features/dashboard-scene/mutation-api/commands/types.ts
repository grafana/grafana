/**
 * Command infrastructure types and permission checks.
 *
 * Provides the MutationCommand interface used by every command file,
 * plus the MutationContext passed to handlers and reusable permission checks.
 */

import { type z } from 'zod';

import { config } from '@grafana/runtime';
import type { SceneObject } from '@grafana/scenes';

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
/**
 * Declares which state slice a command modifies.
 * DashboardMutationClient snapshots this slice before execution and registers
 * perform/undo callbacks automatically — no per-handler undo logic required.
 * Extend with new literals as new command domains are wired up.
 */
export type UndoDomain = 'variables';

/**
 * Discriminated input the client hands to a command's transformer: either a
 * Zod-validated agent payload, or a scenes-native carrier wrapping a SceneObject.
 */
export type CommandInput<TInput> = TInput | { __scenesPayload: SceneObject };

export interface MutationCommand<TInput = unknown, TScene = TInput> {
  /** Command name -- must be UPPER_CASE. Used as the MutationType value. */
  name: string;
  /** Human-readable description. */
  description: string;
  /** Zod schema for runtime payload validation. Single source of truth. */
  payloadSchema: z.ZodType<TInput>;
  /** Permission check run before execution. Must be a pure predicate (no side effects). */
  permission: PermissionCheck;
  /** When true, the command only reads state and will not trigger a forceRender. */
  readOnly?: boolean;
  /** Declares which state slice(s) this command modifies. When set, the client
   *  snapshots each domain before execution and registers an undo/redo history entry.
   *  Pass an array for commands that touch multiple slices (e.g. removing a panel
   *  that also drops referencing variables). */
  undoDomain?: UndoDomain | UndoDomain[];
  /** Optional write-lock target this command operates against (e.g. 'variables').
   *  If the target is locked at execute() time, DashboardMutationClient short-circuits
   *  with { success: false, locked: true } without running the handler. */
  lockTarget?: string;
  /** Optional coalescing hint. If the previous undo entry was the same command
   *  and this predicate returns true, the client merges the two into one entry
   *  (keeps the original beforeSnapshot, updates the afterSnapshot). Useful for
   *  rapid mutations like typing in a label field. `gapMs` is the milliseconds
   *  since the previous entry was registered. */
  canCoalesceWith?: (previousPayload: TScene, gapMs: number) => boolean;
  /**
   * Normalize the raw input the client receives into the shape the handler
   * needs. Called by DashboardMutationClient between Zod validation and the
   * handler, so every command sees a single payload shape regardless of
   * whether the caller is the agent (validated payload) or the UI (scenes
   * payload). Default identity when omitted (TScene defaults to TInput).
   *
   * Lives on the command, not in the handler, so the two-shape fork is
   * declared in one place per command instead of branching at the top of
   * every handler.
   */
  transformPayloadToScene?: (payload: CommandInput<TInput>) => TScene;
  /** The handler function. Receives the normalized payload (TScene). */
  handler: (payload: TScene, context: MutationContext) => Promise<MutationResult>;
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
