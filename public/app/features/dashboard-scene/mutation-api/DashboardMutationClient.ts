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
import { replaceVariableSet } from './commands/variableUtils';
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

    let payload: unknown;
    if ('__scenesPayload' in mutation) {
      // UI path: SceneObject passed directly — skip Zod validation and forward transformer.
      payload = { __scenesPayload: mutation.__scenesPayload };
    } else {
      const validationResult = validatePayload(type, mutation.payload);
      if (!validationResult.success) {
        return { success: false, error: validationResult.error, changes: [] };
      }
      // Zod may return frozen or shared default objects. Deep-clone write payloads
      // so downstream code (e.g. getPanelOptionsWithDefaults) can mutate in-place.
      payload = registration.readOnly ? validationResult.data : structuredClone(validationResult.data);
    }

    const context: MutationContext = { scene: this.scene };

    // Capture the variable set reference and variable array before the handler runs.
    // replaceVariableSet (used by all variable commands) always creates a new
    // SceneVariableSet instance, so identity comparison detects any variable mutation.
    const varSetBefore = this.scene.state.$variables;
    const varsBefore = varSetBefore?.state.variables.slice() ?? [];

    try {
      const result = await registration.handler(payload, context);

      if (result.success && !registration.readOnly) {
        this.scene.forceRender();

        // Register undo/redo when the variable set was replaced by the handler.
        // Both callbacks use replaceVariableSet to ensure proper SceneVariableSet
        // lifecycle (child variable activation) on each undo/redo cycle.
        const varSetAfter = this.scene.state.$variables;
        if (varSetAfter !== varSetBefore && typeof this.scene.publishEvent === 'function') {
          const varsAfter = varSetAfter!.state.variables.slice();
          const scene = this.scene;
          // The mutation is already applied; skip the first perform() call from handleEditAction.
          let firstPerform = true;

          this.scene.publishEvent(
            new DashboardEditActionEvent({
              source: this.scene,
              description: type,
              perform() {
                if (firstPerform) {
                  firstPerform = false;
                  return;
                }
                replaceVariableSet(scene, varsAfter);
              },
              undo() {
                replaceVariableSet(scene, varsBefore);
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
