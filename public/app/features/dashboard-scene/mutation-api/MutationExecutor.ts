/**
 * Mutation Executor
 *
 * Executes dashboard mutations with transaction support and event emission.
 *
 * @internal This class is not part of the public API surface.
 * Use the DashboardMutationClient via getDashboardMutationAPI() instead.
 */

import { v4 as uuidv4 } from 'uuid';

import { DashboardMutationAPI } from '@grafana/runtime';

import type { DashboardScene } from '../scene/DashboardScene';

import { ALL_COMMANDS, MUTATION_TYPES, validatePayload } from './commands/registry';
import type { MutationCommand, MutationContext, MutationTransactionInternal, PermissionCheck } from './commands/types';
import type { Mutation, MutationResult, MutationEvent } from './types';

/**
 * Type guard that validates a string is a valid command name.
 */
function isValidCommandType(type: string): boolean {
  return MUTATION_TYPES.includes(type);
}

type MutationHandler = (payload: unknown, context: MutationContext) => Promise<MutationResult>;

/**
 * A registered command: handler + permission check.
 */
interface CommandRegistration {
  handler: MutationHandler;
  canExecute: PermissionCheck;
}

type MutationEventListener = (event: MutationEvent) => void;

class MutationEventBus {
  private listeners: Set<MutationEventListener> = new Set();

  subscribe(listener: MutationEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: MutationEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error('Event listener error:', error);
      }
    });
  }
}

export class MutationExecutor {
  private scene: DashboardScene;
  private commands: Map<string, CommandRegistration> = new Map();
  private eventBus = new MutationEventBus();
  private _currentTransaction: MutationTransactionInternal | null = null;

  constructor(scene: DashboardScene) {
    this.scene = scene;
    this.registerDefaultHandlers();
  }

  /**
   * Subscribe to mutation events.
   */
  onMutation(listener: MutationEventListener): () => void {
    return this.eventBus.subscribe(listener);
  }

  /**
   * Execute a single mutation.
   */
  async execute(mutation: DashboardMutationAPI.MutationRequest): Promise<MutationResult> {
    const results = await this.executeBatch([mutation]);
    return results[0];
  }

  /**
   * Execute multiple mutations atomically.
   */
  async executeBatch(requests: DashboardMutationAPI.MutationRequest[]): Promise<MutationResult[]> {
    if (!this.scene) {
      throw new Error('No scene set. Call setScene() first.');
    }

    // Normalize request types to UPPER_CASE
    const normalizedRequests = requests.map((r) => ({
      ...r,
      type: r.type.toUpperCase(),
    }));

    // Convert requests to internal mutations, validating types
    const mutations: Mutation[] = [];
    for (const request of normalizedRequests) {
      if (!isValidCommandType(request.type)) {
        return normalizedRequests.map(() => ({
          success: false,
          error: `Unknown command type: ${request.type}`,
          changes: [],
        }));
      }
      mutations.push({ type: request.type, payload: request.payload });
    }

    const transaction: MutationTransactionInternal = {
      id: uuidv4(),
      mutations,
      status: 'pending',
      startedAt: Date.now(),
      changes: [],
    };

    this._currentTransaction = transaction;

    const results: MutationResult[] = [];
    const availableCommands = Array.from(this.commands.keys());
    const context: MutationContext = { scene: this.scene, transaction, availableCommands };

    try {
      for (let i = 0; i < mutations.length; i++) {
        const mutation = mutations[i];

        const registration = this.commands.get(mutation.type);
        if (!registration) {
          results.push({
            success: false,
            error: `No handler registered for command type: ${mutation.type}`,
            changes: [],
          });
          throw new Error(`No handler registered for command type: ${mutation.type}`);
        }

        // Check command-level permissions
        const permissionResult = registration.canExecute(this.scene);
        if (!permissionResult.allowed) {
          results.push({
            success: false,
            error: permissionResult.error,
            changes: [],
          });
          throw new Error(permissionResult.error);
        }

        // Validate payload using Zod schema
        const validationResult = validatePayload(mutation.type, mutation.payload);
        if (!validationResult.success) {
          results.push({
            success: false,
            error: validationResult.error,
            changes: [],
          });
          throw new Error(validationResult.error);
        }

        // Execute the handler with validated payload
        const result = await registration.handler(validationResult.data, context);
        results.push(result);

        if (!result.success) {
          throw new Error(result.error || `Mutation ${mutation.type} failed`);
        }

        // Emit success event
        this.eventBus.emit({
          type: 'mutation_applied',
          mutation,
          result,
          transaction,
          timestamp: Date.now(),
          source: 'assistant',
        });
      }

      // Commit transaction
      transaction.status = 'committed';
      transaction.completedAt = Date.now();

      // Trigger scene refresh
      this.scene.forceRender();

      return results;
    } catch (error) {
      console.error('Mutation batch failed:', error);

      transaction.status = 'failed';
      transaction.completedAt = Date.now();

      const errorMessage = error instanceof Error ? error.message : String(error);

      // Emit failure event for the mutation that caused the failure
      const failedIndex = results.length > 0 ? results.length - 1 : 0;
      if (mutations.length > 0) {
        this.eventBus.emit({
          type: 'mutation_failed',
          mutation: mutations[failedIndex],
          result: { success: false, error: errorMessage, changes: [] },
          transaction,
          timestamp: Date.now(),
          source: 'assistant',
        });
      }

      // Pad remaining (unexecuted) mutations with failure results.
      // Already-executed results are preserved so callers know the real state.
      for (let i = results.length; i < mutations.length; i++) {
        results.push({
          success: false,
          error: `Transaction failed: ${errorMessage}`,
          changes: [],
        });
      }

      return results;
    } finally {
      this._currentTransaction = null;
    }
  }

  /**
   * Get current transaction (for debugging).
   */
  get currentTransaction(): MutationTransactionInternal | null {
    return this._currentTransaction;
  }

  private registerDefaultHandlers(): void {
    for (const cmd of ALL_COMMANDS) {
      this.registerCommand(cmd);
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
