/**
 * Dashboard Mutation Client
 *
 * API for programmatic dashboard mutations. Provides
 * a declarative, command-based API where callers describe *what* to
 * change (e.g. ADD_VARIABLE, UPDATE_VARIABLE) and the client handles Scenes
 * internals, payload validation (via Zod schemas), permission checks, and
 * transactional execution with structured error responses.
 *
 * Each mutation goes through:
 * 1. Command lookup (is it a registered command?)
 * 2. Permission check (can the user edit this dashboard?)
 * 3. Payload validation (does the payload match the Zod schema?)
 */

import { DashboardEditActionEvent } from '../edit-pane/events';
import type { DashboardScene } from '../scene/DashboardScene';

import { ALL_COMMANDS, validatePayload } from './commands/registry';
import type { MutationCommand, MutationContext } from './commands/types';
import type { MutationClient, MutationRequest, MutationResult } from './types';

type MutationHandler = (payload: unknown, context: MutationContext) => Promise<MutationResult>;

interface CommandRegistration {
  handler: MutationHandler;
  canExecute: (scene: DashboardScene) => { allowed: true } | { allowed: false; error: string };
  readOnly: boolean;
}

export class DashboardMutationClient implements MutationClient {
  private scene: DashboardScene;
  private commands: Map<string, CommandRegistration> = new Map();

  constructor(scene: DashboardScene) {
    this.scene = scene;
    for (const cmd of ALL_COMMANDS) {
      this.registerCommand(cmd);
    }
  }

  async execute(mutation: MutationRequest): Promise<MutationResult> {
    const type = mutation.type.toUpperCase();

    const registration = this.commands.get(type);
    if (!registration) {
      return { success: false, error: `Unknown command type: ${type}`, changes: [] };
    }

    const permissionResult = registration.canExecute(this.scene);
    if (!permissionResult.allowed) {
      return { success: false, error: permissionResult.error, changes: [] };
    }

    const validationResult = validatePayload(type, mutation.payload);
    if (!validationResult.success) {
      return { success: false, error: validationResult.error, changes: [] };
    }

    // Zod may return frozen or shared default objects. Deep-clone write payloads
    // so downstream code (e.g. getPanelOptionsWithDefaults) can mutate in-place.
    const payload = registration.readOnly ? validationResult.data : structuredClone(validationResult.data);

    const context: MutationContext = { scene: this.scene };

    try {
      const result = await registration.handler(payload, context);

      if (result.success && !registration.readOnly) {
        this.scene.forceRender();
      }

      // Wire undo/redo into the DashboardEditPane event system when the command
      // provides an _undo callback. The mutation has already been applied at this
      // point, so perform() is a no-op for the initial registration. The DashboardEditPane
      // handleEditAction calls perform() immediately then pushes to undoStack.
      // When redo is invoked, performAction calls perform() again -- at that point
      // the _undo has already restored the previous state, so perform() must
      // re-apply the mutation. We capture the current variables state here to
      // use as the "redo" snapshot (state after the mutation).
      if (result.success && result._undo && typeof this.scene.publishEvent === 'function') {
        const undoFn = result._undo;
        const description = result._description ?? mutation.type;
        // Capture the post-mutation variable state for redo.
        const varSet = this.scene.state.$variables;
        const variablesAfterMutation = varSet ? varSet.state.variables.slice() : [];
        const scene = this.scene;

        let alreadyPerformed = true;

        this.scene.publishEvent(
          new DashboardEditActionEvent({
            source: this.scene,
            description,
            perform: () => {
              // First call is a no-op because mutation was already applied.
              if (alreadyPerformed) {
                alreadyPerformed = false;
                return;
              }
              // Subsequent calls (redo): restore the post-mutation state.
              if (scene.state.$variables) {
                scene.state.$variables.setState({ variables: variablesAfterMutation });
              }
            },
            undo: undoFn,
          }),
          true
        );
      }

      // Strip internal fields before returning to callers.
      const { _undo: _u, _description: _d, ...publicResult } = result;
      return publicResult;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        changes: [],
      };
    }
  }

  getAvailableCommands(): string[] {
    return Array.from(this.commands.keys());
  }

  private registerCommand(cmd: MutationCommand): void {
    this.commands.set(cmd.name, {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- safe: client validates with Zod before dispatch
      handler: cmd.handler as MutationHandler,
      canExecute: cmd.permission,
      readOnly: cmd.readOnly ?? false,
    });
  }
}
