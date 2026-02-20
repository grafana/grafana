/**
 * Dashboard Mutation Client
 *
 * Validates and executes dashboard mutation commands. Each mutation goes through:
 * 1. Command lookup (is it a registered command?)
 * 2. Permission check (can the user edit this dashboard?)
 * 3. Payload validation (does the payload match the Zod schema?)
 * 4. Handler execution (apply the change to the Scenes model)
 *
 * This class is created by DashboardMutationBehavior on scene activation
 * and stored in the module-level dashboardMutationStore -- never on the
 * scene tree itself.
 */

import { ALL_COMMANDS, validatePayload } from './commands/registry';
import type { MutationCommand, MutationContext } from './commands/types';
import type { MutableDashboardScene, MutationClient, MutationRequest, MutationResult } from './types';

type MutationHandler = (payload: unknown, context: MutationContext) => Promise<MutationResult>;

interface CommandRegistration {
  handler: MutationHandler;
  canExecute: (scene: MutableDashboardScene) => { allowed: true } | { allowed: false; error: string };
}

export class DashboardMutationClient implements MutationClient {
  private scene: MutableDashboardScene;
  private commands: Map<string, CommandRegistration> = new Map();

  constructor(scene: MutableDashboardScene) {
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

    const context: MutationContext = { scene: this.scene };

    try {
      const result = await registration.handler(validationResult.data, context);

      if (result.success) {
        this.scene.forceRender();
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

  private registerCommand(cmd: MutationCommand): void {
    this.commands.set(cmd.name, {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- safe: executor validates with Zod before dispatch
      handler: cmd.handler as MutationHandler,
      canExecute: cmd.permission,
    });
  }
}
