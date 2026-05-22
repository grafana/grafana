import type { DashboardScene } from '../scene/DashboardScene';
import type { UserActionExecuteResult, UserActionsService } from '../user-actions/UserActionsService';

export interface ClientCommandContext {
  scene: DashboardScene;
  userActionsService: UserActionsService;
}

export interface ClientCommandResult {
  success: boolean;
  error?: string;
  locked?: boolean;
}

/**
 * Agent-facing command interface.
 *
 * Each ClientCommand is responsible for:
 *   1. Validating the raw JSON payload (Zod).
 *   2. Mapping JSON to UserActionCommand inputs (JSON-to-Scene conversion).
 *   3. Delegating execution to UserActionsService.
 *
 * ClientCommands never mutate Scene state directly.
 */
export interface ClientCommand<T = unknown> {
  handler(payload: T, context: ClientCommandContext): Promise<ClientCommandResult>;
}

export function toClientResult(result: UserActionExecuteResult): ClientCommandResult {
  return { success: result.success, error: result.error, locked: result.locked };
}
