import { dashboardEditActions } from '../edit-pane/shared';
import type { DashboardScene } from '../scene/DashboardScene';

import { type ClientCommand, type ClientCommandContext, type ClientCommandResult } from './ClientCommand';
import { addVariableClientCommand } from './commands/addVariable';
import { listVariablesClientCommand } from './commands/listVariables';
import { removeVariableClientCommand } from './commands/removeVariable';

/** All agent-facing commands. Each entry is a data record describing one command. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous registry
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
 *   - `list()`     -- the Assistant introspects the tool surface.
 *   - `execute()`  -- validates JSON against the command's Zod schema, then:
 *                       * read:  call cmd.read, return { success, data }.
 *                       * write: call cmd.toUserAction (which converts the
 *                                JSON payload into Scene objects + builds the
 *                                UserActionCommand class), then run it through
 *                                the existing dashboardEditActions.edit pipe so
 *                                it lands on the DashboardEditPane undo stack.
 *
 * The UI does not use this class. The UI constructs UserActionCommands
 * directly and dispatches via dashboardEditActions.edit -- the same pipe
 * MutationApiClient ends at. Convergence on the existing seam.
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
        const data = await cmd.read!(validation.data, ctx);
        return { success: true, data };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
      }
    }

    // Write path. Permission, lock, edit-mode entry, and sync error reporting
    // are agent-only concerns (the UI is already in edit mode and has no
    // notion of locks); they live here inline.
    if (!this.scene.canEditDashboard()) {
      return { success: false, error: 'Cannot edit dashboard: insufficient permissions or dashboard is a snapshot' };
    }

    let userAction;
    try {
      userAction = cmd.toUserAction!(validation.data, ctx);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }

    if (userAction.lockTarget && this.scene.isWriteLocked(userAction.lockTarget)) {
      return { success: false, locked: true, error: `Target '${userAction.lockTarget}' is locked` };
    }

    if (!this.scene.state.isEditing) {
      this.scene.onEnterEditMode();
    }

    // Pre-perform so the agent gets a synchronous error if perform throws.
    // DashboardEditPane will call perform again on first publish; skip that
    // one so we do not double-apply.
    try {
      userAction.perform();
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }

    let firstPerform = true;
    dashboardEditActions.edit({
      source: this.scene,
      description: userAction.title,
      perform: () => {
        if (firstPerform) {
          firstPerform = false;
          return;
        }
        userAction.perform();
      },
      undo: () => userAction.undo(),
    });

    return { success: true };
  }
}
