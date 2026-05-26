import { dashboardEditActions } from '../edit-pane/shared';
import type { DashboardScene } from '../scene/DashboardScene';

import { type ClientCommand, type ClientCommandContext, type ClientCommandResult } from './ClientCommand';
import { addVariableClientCommand } from './commands/AddVariableClientCommand';
import { removeVariableClientCommand } from './commands/RemoveVariableClientCommand';
import { listVariablesClientCommand } from './commands/listVariables';

/**
 * Registry of agent-facing dashboard commands. Each entry is a data record
 * (not a class) declaring its type, description, Zod schema, and either a
 * `toUserAction` mapper (writes) or a `read` function.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous registry; each entry is typed internally
export const CLIENT_COMMANDS: Array<ClientCommand<any>> = [
  addVariableClientCommand,
  removeVariableClientCommand,
  listVariablesClientCommand,
];

export interface MutationApiRequest {
  type: string;
  payload: unknown;
}

export interface ClientCommandSummary {
  type: string;
  description: string;
  kind: 'write' | 'read';
}

/**
 * Agent-facing entry point for the dashboard Mutation API.
 *
 * Three responsibilities:
 *
 *   1. Discover  -- `list()` returns the available commands so the Assistant
 *                   can introspect the tool surface.
 *   2. Validate  -- `execute()` runs the request payload through the
 *                   command's Zod schema.
 *   3. Dispatch  -- read commands return data; write commands construct a
 *                   UserActionCommand and hand it to dashboardEditActions.
 *                   executeUserAction, which is the same entry point the UI
 *                   uses, so the existing DashboardEditActionEvent stack
 *                   handles undo/redo for both.
 */
export class MutationApiClient {
  private registry = new Map<string, ClientCommand>();

  constructor(private scene: DashboardScene) {
    for (const cmd of CLIENT_COMMANDS) {
      this.registry.set(cmd.type, cmd);
    }
  }

  list(): ClientCommandSummary[] {
    return [...this.registry.values()].map((cmd) => ({
      type: cmd.type,
      description: cmd.description,
      kind: cmd.kind,
    }));
  }

  async execute({ type, payload }: MutationApiRequest): Promise<ClientCommandResult> {
    const cmd = this.registry.get(type.toUpperCase());
    if (!cmd) {
      return { success: false, error: `Unknown command type: ${type}` };
    }

    const validation = cmd.schema.safeParse(payload);
    if (!validation.success) {
      const issues = validation.error.issues
        .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
        .join(', ');
      return { success: false, error: `Validation failed: ${issues}` };
    }

    const ctx: ClientCommandContext = { scene: this.scene };

    if (cmd.kind === 'read') {
      try {
        const data = await cmd.read(validation.data, ctx);
        return { success: true, data };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    }

    let userAction;
    try {
      userAction = cmd.toUserAction(validation.data, ctx);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
    return dashboardEditActions.executeUserAction(this.scene, userAction);
  }
}
