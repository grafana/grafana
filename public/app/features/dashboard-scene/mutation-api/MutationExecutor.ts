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

import {
  handleAddPanel,
  handleRemovePanel,
  handleUpdatePanel,
  handleAddVariable,
  handleRemoveVariable,
  handleUpdateVariable,
  handleListVariables,
  handleUpdateTimeSettings,
  handleUpdateDashboardMeta,
  handleGetDashboardInfo,
  handleEnterEditMode,
  requiresEdit,
  readOnly,
  MutationContext,
  MutationTransactionInternal,
  MutationHandler,
  PermissionCheck,
} from './handlers';
import { validatePayload } from './schemas';
import { Mutation, MutationType, MutationResult, MutationEvent, MUTATION_TYPES } from './types';

/**
 * Type guard that validates a string is a valid MutationType.
 */
function isMutationType(type: string): type is MutationType {
  return MUTATION_TYPES.some((t) => t === type);
}

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
  private scene!: DashboardScene;
  private commands: Map<MutationType, CommandRegistration> = new Map();
  private eventBus = new MutationEventBus();
  private _currentTransaction: MutationTransactionInternal | null = null;

  constructor() {
    this.registerDefaultHandlers();
  }

  /**
   * Set the dashboard scene to operate on
   */
  setScene(scene: DashboardScene): void {
    this.scene = scene;
  }

  /**
   * Subscribe to mutation events
   */
  onMutation(listener: MutationEventListener): () => void {
    return this.eventBus.subscribe(listener);
  }

  /**
   * Execute a single mutation.
   * Accepts the loose public API input type and validates at runtime.
   */
  async execute(mutation: DashboardMutationAPI.MutationRequest): Promise<MutationResult> {
    const results = await this.executeBatch([mutation]);
    return results[0];
  }

  /**
   * Execute multiple mutations atomically.
   * Accepts the loose public API input type and validates at runtime.
   */
  async executeBatch(requests: DashboardMutationAPI.MutationRequest[]): Promise<MutationResult[]> {
    if (!this.scene) {
      throw new Error('No scene set. Call setScene() first.');
    }

    // Normalize request types to UPPER_CASE (schemas may use different casing)
    const normalizedRequests = requests.map((r) => ({
      ...r,
      type: r.type.toUpperCase(),
    }));

    // Convert requests to internal mutations, validating types
    const mutations: Mutation[] = [];
    for (const request of normalizedRequests) {
      if (!isMutationType(request.type)) {
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
    const context: MutationContext = { scene: this.scene, transaction };

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

        // Validate payload using schema validators
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

      // Emit failure event
      if (mutations.length > 0) {
        this.eventBus.emit({
          type: 'mutation_failed',
          mutation: mutations[0],
          result: { success: false, error: errorMessage, changes: [] },
          transaction,
          timestamp: Date.now(),
          source: 'assistant',
        });
      }

      // Mark ALL results as failed
      results.length = 0;
      for (const _mutation of mutations) {
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
   * Get current transaction (for debugging)
   */
  get currentTransaction(): MutationTransactionInternal | null {
    return this._currentTransaction;
  }

  private registerDefaultHandlers(): void {
    // Panel operations
    this.registerCommand('ADD_PANEL', handleAddPanel, requiresEdit);
    this.registerCommand('REMOVE_PANEL', handleRemovePanel, requiresEdit);
    this.registerCommand('UPDATE_PANEL', handleUpdatePanel, requiresEdit);

    // Variable operations
    this.registerCommand('ADD_VARIABLE', handleAddVariable, requiresEdit);
    this.registerCommand('REMOVE_VARIABLE', handleRemoveVariable, requiresEdit);
    this.registerCommand('UPDATE_VARIABLE', handleUpdateVariable, requiresEdit);
    this.registerCommand('LIST_VARIABLES', handleListVariables, readOnly);

    // Dashboard settings
    this.registerCommand('UPDATE_TIME_SETTINGS', handleUpdateTimeSettings, requiresEdit);
    this.registerCommand('UPDATE_DASHBOARD_META', handleUpdateDashboardMeta, requiresEdit);

    // Read-only
    this.registerCommand('GET_DASHBOARD_INFO', handleGetDashboardInfo, readOnly);

    // Edit mode
    this.registerCommand('ENTER_EDIT_MODE', handleEnterEditMode, requiresEdit);
  }

  /**
   * Register a command with its handler and permission check.
   */
  private registerCommand(type: MutationType, handler: MutationHandler, canExecute: PermissionCheck): void {
    this.commands.set(type, { handler, canExecute });
  }
}
