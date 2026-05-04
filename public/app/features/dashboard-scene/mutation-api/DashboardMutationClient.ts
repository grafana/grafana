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

import { type SceneVariable } from '@grafana/scenes';

import { DashboardEditActionEvent } from '../edit-pane/events';
import type { DashboardScene } from '../scene/DashboardScene';

import { ALL_COMMANDS, validatePayload } from './commands/registry';
import type { MutationCommand, MutationContext, UndoDomain } from './commands/types';
import { replaceVariableSet } from './commands/variableUtils';
import type { MutationClient, MutationRequest, MutationResult } from './types';

type MutationHandler = (payload: unknown, context: MutationContext) => Promise<MutationResult>;

interface CommandRegistration {
  handler: MutationHandler;
  canExecute: (scene: DashboardScene) => { allowed: true } | { allowed: false; error: string };
  readOnly: boolean;
  undoDomain?: UndoDomain;
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

    // Snapshot the declared domain before the handler runs.
    const { undoDomain } = registration;
    const beforeSnapshot = undoDomain ? this.snapshotDomain(undoDomain) : undefined;

    try {
      const result = await registration.handler(payload, context);

      if (result.success && !registration.readOnly) {
        this.scene.forceRender();

        // Register undo/redo entry when the command declared a snapshot domain.
        // perform() is called immediately by DashboardEditPane.handleEditAction —
        // the mutation is already applied so we skip that first call.
        if (undoDomain && beforeSnapshot && typeof this.scene.publishEvent === 'function') {
          const afterSnapshot = this.snapshotDomain(undoDomain);
          let firstPerform = true;

          this.scene.publishEvent(
            new DashboardEditActionEvent({
              source: this.scene,
              description: type,
              perform: () => {
                if (firstPerform) {
                  firstPerform = false;
                  return;
                }
                this.restoreDomain(undoDomain, afterSnapshot);
              },
              undo: () => this.restoreDomain(undoDomain, beforeSnapshot),
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

  private snapshotDomain(domain: UndoDomain): SceneVariable[] {
    if (domain === 'variables') {
      return this.scene.state.$variables?.state.variables.slice() ?? [];
    }
    return [];
  }

  private restoreDomain(domain: UndoDomain, snapshot: SceneVariable[]): void {
    if (domain === 'variables') {
      replaceVariableSet(this.scene, snapshot);
    }
  }

  private registerCommand(cmd: MutationCommand): void {
    this.commands.set(cmd.name, {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- safe: client validates with Zod before dispatch
      handler: cmd.handler as MutationHandler,
      canExecute: cmd.permission,
      readOnly: cmd.readOnly ?? false,
      undoDomain: cmd.undoDomain,
    });
  }
}
