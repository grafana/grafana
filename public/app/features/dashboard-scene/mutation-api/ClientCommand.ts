import type { z } from 'zod';

import type { DashboardScene } from '../scene/DashboardScene';

import type { UserActionCommand } from './UserActionCommand';

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

/**
 * Agent-facing command record. One interface, two flavors selected by `kind`:
 *
 *   - 'write' commands implement `toUserAction(payload, ctx)` -- the agent layer's
 *     responsibility is validation + translation: Zod parse, then convert the
 *     JSON-shaped payload into Scene objects, then construct the UserActionCommand
 *     that carries the actual mutation logic.
 *   - 'read' commands implement `read(payload, ctx)` -- pure data return, no
 *     UserActionCommand, no undo stack entry. The UI does not consume these
 *     (Scenes subscriptions are its read channel); only the agent does.
 */
export interface ClientCommand<T = unknown> {
  type: string;
  description: string;
  kind: 'read' | 'write';
  schema: z.ZodType<T>;
  /** For write commands: validate-and-translate, then build the UserActionCommand. */
  toUserAction?(payload: T, ctx: ClientCommandContext): UserActionCommand;
  /** For read commands: return data without mutating state. */
  read?(payload: T, ctx: ClientCommandContext): unknown | Promise<unknown>;
}
