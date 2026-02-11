/**
 * Mutation Executor
 *
 * Validates and executes dashboard mutation commands. Each mutation goes through:
 * 1. Command lookup (is it a registered command?)
 * 2. Permission check (can the user edit this dashboard?)
 * 3. Payload validation (does the payload match the Zod schema?)
 * 4. Handler execution (apply the change to the Scenes model)
 *
 * @internal This class is not part of the public API surface.
 */

import type { DashboardScene } from '../scene/DashboardScene';

import { ALL_COMMANDS, validatePayload } from './commands/registry';
import type { MutationCommand, MutationContext } from './commands/types';
import type { MutationRequest, MutationResult } from './types';

type MutationHandler = (payload: unknown, context: MutationContext) => Promise<MutationResult>;

interface CommandRegistration {
  handler: MutationHandler;
  canExecute: (scene: DashboardScene) => { allowed: true } | { allowed: false; error: string };
}

export class MutationExecutor {
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

    const context: MutationContext = { scene: this.scene };
    const result = await registration.handler(validationResult.data, context);

    if (result.success) {
      this.scene.forceRender();
    }

    return result;
  }

  private registerCommand(cmd: MutationCommand): void {
    this.commands.set(cmd.name, {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- safe: executor validates with Zod before dispatch
      handler: cmd.handler as MutationHandler,
      canExecute: cmd.permission,
    });
  }
}
