/**
 * Dashboard Mutation Client
 *
 * API for programmatic dashboard mutations. The client owns:
 *   - command lookup,
 *   - permission + lock checks,
 *   - payload validation (Zod),
 *   - per-undoDomain serialization (the "execute queue").
 *
 * Snapshot/restore + history publishing are delegated to MutationRecorder
 * on DashboardScene. That keeps this class focused on dispatch concerns
 * and lets other callers (plugin host, future MCP gateway) share the same
 * recorder without going through this class.
 */

import type { DashboardScene } from '../scene/DashboardScene';

import { ALL_COMMANDS, validatePayload } from './commands/registry';
import type { MutationCommand, MutationContext, UndoDomain } from './commands/types';
import type { MutationClient, MutationRequest, MutationResult } from './types';

type MutationHandler = (payload: unknown, context: MutationContext) => Promise<MutationResult>;

interface CommandRegistration {
  handler: MutationHandler;
  canExecute: (scene: DashboardScene) => { allowed: true } | { allowed: false; error: string };
  readOnly: boolean;
  // Normalized: always an array internally even if the command declared a single domain.
  undoDomains: UndoDomain[];
  lockTarget?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- predicate signature is per-command
  canCoalesceWith?: (previousPayload: any, gapMs: number) => boolean;
}

export class DashboardMutationClient implements MutationClient {
  private scene: DashboardScene;
  private commands: Map<string, CommandRegistration> = new Map();
  /**
   * Per-domain promise queue. Concept: two `execute()` calls on the same
   * `undoDomain` must run sequentially. Otherwise both calls snapshot the
   * same pre-execution state and the second mutation's undo entry would
   * silently revert the first. Commands without an undoDomain bypass the
   * queue.
   */
  private domainQueues: Map<UndoDomain, Promise<unknown>> = new Map();

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

    // Serialize per undoDomain to avoid the snapshot race. If a command
    // declares multiple domains, chain after all of them.
    if (registration.undoDomains.length > 0) {
      const previous = registration.undoDomains.map((d) => this.domainQueues.get(d) ?? Promise.resolve());
      const next = Promise.all(previous).then(() => this.executeInner(mutation, registration));
      const settled = next.catch(() => {});
      for (const d of registration.undoDomains) {
        this.domainQueues.set(d, settled);
      }
      return next;
    }
    return this.executeInner(mutation, registration);
  }

  private async executeInner(mutation: MutationRequest, registration: CommandRegistration): Promise<MutationResult> {
    const type = mutation.type.toUpperCase();

    const permissionResult = registration.canExecute(this.scene);
    if (!permissionResult.allowed) {
      return { success: false, error: permissionResult.error, changes: [] };
    }

    if (registration.lockTarget && this.scene.isWriteLocked(registration.lockTarget)) {
      return {
        success: false,
        locked: true,
        error: `Target '${registration.lockTarget}' is locked`,
        changes: [],
      };
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
      payload = registration.readOnly ? validationResult.data : structuredClone(validationResult.data);
    }

    const context: MutationContext = { scene: this.scene };

    // Delegate snapshot + publish to the recorder. The recorder runs the
    // handler between the before/after snapshots and handles coalescing,
    // conflict detection, and event publishing.
    const recorderOptions = {
      type,
      payload,
      undoDomains: registration.undoDomains,
      canCoalesceWith: registration.canCoalesceWith,
    };

    try {
      const result = await this.scene.mutationRecorder.record(recorderOptions, () =>
        registration.handler(payload, context)
      );

      if (result.success && !registration.readOnly) {
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

  getAvailableCommands(): string[] {
    return Array.from(this.commands.keys());
  }

  private registerCommand(cmd: MutationCommand): void {
    const undoDomains: UndoDomain[] = cmd.undoDomain
      ? Array.isArray(cmd.undoDomain)
        ? cmd.undoDomain
        : [cmd.undoDomain]
      : [];
    this.commands.set(cmd.name, {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- safe: client validates with Zod before dispatch
      handler: cmd.handler as MutationHandler,
      canExecute: cmd.permission,
      readOnly: cmd.readOnly ?? false,
      undoDomains,
      lockTarget: cmd.lockTarget,
      canCoalesceWith: cmd.canCoalesceWith,
    });
  }
}
