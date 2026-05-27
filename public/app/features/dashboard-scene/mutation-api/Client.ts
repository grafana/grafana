import { dashboardEditActions } from '../edit-pane/shared';
import type { DashboardScene } from '../scene/DashboardScene';

import { type ClientCommand, type ClientCommandContext, type ClientCommandResult } from './ClientCommand';
import type { UserActionCommand } from './UserActionCommand';
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

function isUserActionCommand(input: unknown): input is UserActionCommand {
  return (
    typeof input === 'object' &&
    input !== null &&
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- runtime narrowing
    typeof (input as UserActionCommand).perform === 'function' &&
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    typeof (input as UserActionCommand).undo === 'function'
  );
}

/**
 * Single entry point for dashboard mutations -- used by both the UI and the agent.
 *
 *   - `list()`               -- the Assistant introspects the tool surface.
 *   - `execute(cmd)`         -- UI path. Pre-built UserActionCommand goes
 *                               straight to dispatch (no JSON round-trip).
 *   - `execute(request)`     -- agent path. Validates the JSON payload against
 *                               the registered command's Zod schema, calls
 *                               toUserAction to translate JSON -> SceneObjects
 *                               -> UserActionCommand, then dispatches the same
 *                               way the UI path does.
 *
 * Internal dispatch (`#dispatch`) checks permission and write lock, enters
 * edit mode, pre-performs synchronously (so errors are reported), and
 * registers the action with the existing dashboardEditActions.edit pipe so
 * DashboardEditPane records it on the undo stack. The "edit" event seam is
 * an implementation detail of this class; UI callers never construct one
 * themselves.
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

  async execute(input: MutationApiRequest | UserActionCommand): Promise<ClientCommandResult> {
    // UI path: command is already built, dispatch it directly.
    if (isUserActionCommand(input)) {
      return this.#dispatch(input);
    }

    // Agent path: validate JSON, translate to Scene objects, then dispatch.
    const cmd = this.registry.get(input.type.toUpperCase());
    if (!cmd) {
      return { success: false, error: `Unknown command type: ${input.type}` };
    }

    const validation = cmd.schema.safeParse(input.payload);
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

    let userAction;
    try {
      userAction = cmd.toUserAction!(validation.data, ctx);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
    return this.#dispatch(userAction);
  }

  #dispatch(cmd: UserActionCommand): ClientCommandResult {
    if (!this.scene.canEditDashboard()) {
      return { success: false, error: 'Cannot edit dashboard: insufficient permissions or dashboard is a snapshot' };
    }
    if (cmd.lockTarget && this.scene.isWriteLocked(cmd.lockTarget)) {
      return { success: false, locked: true, error: `Target '${cmd.lockTarget}' is locked` };
    }
    if (!this.scene.state.isEditing) {
      this.scene.onEnterEditMode();
    }

    // Pre-perform so the caller gets a synchronous error if perform throws.
    // DashboardEditPane will call perform again on first publish; skip that
    // one so we do not double-apply.
    try {
      cmd.perform();
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }

    let firstPerform = true;
    dashboardEditActions.edit({
      source: this.scene,
      description: cmd.title,
      perform: () => {
        if (firstPerform) {
          firstPerform = false;
          return;
        }
        cmd.perform();
      },
      undo: () => cmd.undo(),
    });

    return { success: true };
  }
}
