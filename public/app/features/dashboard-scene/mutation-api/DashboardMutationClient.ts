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

    // Snapshot variable state before the mutation for undo/redo wiring.
    // This follows the same snapshot pattern used by dashboardEditActions in shared.ts.
    const varsBefore = this.scene.state.$variables?.state.variables.slice() ?? [];
    const varSetBefore = this.scene.state.$variables;

    try {
      const result = await registration.handler(payload, context);

      if (result.success && !registration.readOnly) {
        this.scene.forceRender();

        // Wire into the DashboardEditPane undo/redo history system when the variable
        // set changed. Mutation was already applied inside the handler, so perform()
        // skips its first call and re-applies on subsequent redo calls.
        const varSetAfter = this.scene.state.$variables;
        if (varSetAfter !== varSetBefore && typeof this.scene.publishEvent === 'function') {
          const varsAfter = varSetAfter!.state.variables.slice();
          const scene = this.scene;
          let alreadyPerformed = true;

          this.scene.publishEvent(
            new DashboardEditActionEvent({
              source: this.scene,
              description: type,
              perform() {
                if (alreadyPerformed) {
                  alreadyPerformed = false;
                  return;
                }
                scene.state.$variables?.setState({ variables: varsAfter });
              },
              undo() {
                scene.state.$variables?.setState({ variables: varsBefore });
              },
            }),
            true
          );
        }
      }

      return result;
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
