import type { z } from 'zod';

import type { DashboardScene } from '../scene/DashboardScene';
import type { UserActionCommand } from '../user-actions/UserActionCommand';

export interface ClientCommandContext {
  scene: DashboardScene;
}

export interface ClientCommandResult {
  success: boolean;
  error?: string;
  locked?: boolean;
  /** Populated by read commands; undefined for writes. */
  data?: unknown;
}

interface ClientCommandBase<T> {
  /** Stable UPPER_CASE identifier used for lookup and as the agent-facing tool name. */
  type: string;
  /** Agent-facing description, surfaced via MutationApiClient.list(). */
  description: string;
  /** Single source of truth for payload shape. Validated by MutationApiClient.execute(). */
  schema: z.ZodType<T>;
}

/**
 * Write commands map a validated JSON payload into a UserActionCommand. The
 * client dispatches the UserActionCommand via dashboardEditActions, which
 * lands on the existing DashboardEditPane undo/redo stack -- no parallel
 * undo system needed.
 */
export interface WriteClientCommand<T = unknown> extends ClientCommandBase<T> {
  kind: 'write';
  toUserAction(payload: T, ctx: ClientCommandContext): UserActionCommand;
}

/**
 * Read commands return data without mutating state. They do not produce a
 * UserActionCommand and do not enter the undo/redo stack. The UI does not
 * consume them -- Scenes subscriptions are the UI's read channel. They
 * exist only for the agent.
 */
export interface ReadClientCommand<T = unknown, R = unknown> extends ClientCommandBase<T> {
  kind: 'read';
  read(payload: T, ctx: ClientCommandContext): R | Promise<R>;
}

export type ClientCommand<T = unknown> = WriteClientCommand<T> | ReadClientCommand<T>;
