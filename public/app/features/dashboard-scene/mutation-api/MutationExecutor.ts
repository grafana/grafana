/**
 * Mutation Executor
 *
 * Executes dashboard mutations with transaction support and event emission.
 */

import { v4 as uuidv4 } from 'uuid';

import type { DashboardScene } from '../scene/DashboardScene';

import {
  handleAddPanel,
  handleRemovePanel,
  handleUpdatePanel,
  handleMovePanel,
  handleAddVariable,
  handleRemoveVariable,
  handleAddRow,
  handleUpdateTimeSettings,
  handleUpdateDashboardMeta,
  handleGetDashboardInfo,
  type MutationContext,
  type MutationTransactionInternal,
  type MutationHandler,
} from './handlers';
import {
  type Mutation,
  type MutationType,
  type MutationResult,
  type MutationEvent,
  type MutationPayloadMap,
} from './types';

// ============================================================================
// Event Bus
// ============================================================================

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

// ============================================================================
// Mutation Executor
// ============================================================================

export class MutationExecutor {
  private scene!: DashboardScene;
  private handlers: Map<MutationType, MutationHandler> = new Map();
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
   * Execute a single mutation
   */
  async execute(mutation: Mutation): Promise<MutationResult> {
    const results = await this.executeBatch([mutation]);
    return results[0];
  }

  /**
   * Execute multiple mutations atomically
   */
  async executeBatch(mutations: Mutation[]): Promise<MutationResult[]> {
    if (!this.scene) {
      throw new Error('No scene set. Call setScene() first.');
    }

    // Create transaction
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
      // Execute each mutation
      for (const mutation of mutations) {
        const handler = this.handlers.get(mutation.type);
        if (!handler) {
          throw new Error(`No handler registered for mutation type: ${mutation.type}`);
        }

        const result = await handler(mutation.payload, context);
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
      // Probably need a rollback mechanism here... but skipping this for POC
      console.error('Mutation batch failed:', error);

      transaction.status = 'rolled_back';
      transaction.completedAt = Date.now();

      // Emit failure event
      this.eventBus.emit({
        type: 'mutation_rolled_back',
        mutation: mutations[0],
        result: { success: false, error: String(error), changes: [] },
        transaction,
        timestamp: Date.now(),
        source: 'assistant',
      });

      // Return error results for remaining mutations
      const errorMessage = error instanceof Error ? error.message : String(error);
      while (results.length < mutations.length) {
        results.push({
          success: false,
          error: errorMessage,
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

  // ==========================================================================
  // Handler Registration
  // ==========================================================================

  private registerDefaultHandlers(): void {
    // Panel operations
    this.registerHandler('ADD_PANEL', handleAddPanel);
    this.registerHandler('REMOVE_PANEL', handleRemovePanel);
    this.registerHandler('UPDATE_PANEL', handleUpdatePanel);
    this.registerHandler('MOVE_PANEL', handleMovePanel);
    this.registerHandler('DUPLICATE_PANEL', this.notImplemented('DUPLICATE_PANEL'));

    // Variable operations
    this.registerHandler('ADD_VARIABLE', handleAddVariable);
    this.registerHandler('REMOVE_VARIABLE', handleRemoveVariable);
    this.registerHandler('UPDATE_VARIABLE', this.notImplemented('UPDATE_VARIABLE'));

    // Row operations
    this.registerHandler('ADD_ROW', handleAddRow);
    this.registerHandler('REMOVE_ROW', this.notImplemented('REMOVE_ROW'));
    this.registerHandler('COLLAPSE_ROW', this.notImplemented('COLLAPSE_ROW'));

    // Tab operations
    this.registerHandler('ADD_TAB', this.notImplemented('ADD_TAB'));
    this.registerHandler('REMOVE_TAB', this.notImplemented('REMOVE_TAB'));

    // Library panel operations
    this.registerHandler('ADD_LIBRARY_PANEL', this.notImplemented('ADD_LIBRARY_PANEL'));
    this.registerHandler('UNLINK_LIBRARY_PANEL', this.notImplemented('UNLINK_LIBRARY_PANEL'));
    this.registerHandler('SAVE_AS_LIBRARY_PANEL', this.notImplemented('SAVE_AS_LIBRARY_PANEL'));

    // Repeat configuration
    this.registerHandler('CONFIGURE_PANEL_REPEAT', this.notImplemented('CONFIGURE_PANEL_REPEAT'));
    this.registerHandler('CONFIGURE_ROW_REPEAT', this.notImplemented('CONFIGURE_ROW_REPEAT'));

    // Conditional rendering
    this.registerHandler('SET_CONDITIONAL_RENDERING', this.notImplemented('SET_CONDITIONAL_RENDERING'));

    // Layout
    this.registerHandler('CHANGE_LAYOUT_TYPE', this.notImplemented('CHANGE_LAYOUT_TYPE'));

    // Annotation operations
    this.registerHandler('ADD_ANNOTATION', this.notImplemented('ADD_ANNOTATION'));
    this.registerHandler('UPDATE_ANNOTATION', this.notImplemented('UPDATE_ANNOTATION'));
    this.registerHandler('REMOVE_ANNOTATION', this.notImplemented('REMOVE_ANNOTATION'));

    // Link operations
    this.registerHandler('ADD_DASHBOARD_LINK', this.notImplemented('ADD_DASHBOARD_LINK'));
    this.registerHandler('REMOVE_DASHBOARD_LINK', this.notImplemented('REMOVE_DASHBOARD_LINK'));
    this.registerHandler('ADD_PANEL_LINK', this.notImplemented('ADD_PANEL_LINK'));
    this.registerHandler('ADD_DATA_LINK', this.notImplemented('ADD_DATA_LINK'));

    // Field configuration
    this.registerHandler('ADD_FIELD_OVERRIDE', this.notImplemented('ADD_FIELD_OVERRIDE'));
    this.registerHandler('ADD_VALUE_MAPPING', this.notImplemented('ADD_VALUE_MAPPING'));
    this.registerHandler('ADD_TRANSFORMATION', this.notImplemented('ADD_TRANSFORMATION'));

    // Dashboard settings
    this.registerHandler('UPDATE_TIME_SETTINGS', handleUpdateTimeSettings);
    this.registerHandler('UPDATE_DASHBOARD_META', handleUpdateDashboardMeta);

    // Dashboard management (backend operations)
    this.registerHandler('MOVE_TO_FOLDER', this.notImplemented('MOVE_TO_FOLDER'));
    this.registerHandler('TOGGLE_FAVORITE', this.notImplemented('TOGGLE_FAVORITE'));

    // Version management (backend operations)
    this.registerHandler('LIST_VERSIONS', this.notImplemented('LIST_VERSIONS'));
    this.registerHandler('COMPARE_VERSIONS', this.notImplemented('COMPARE_VERSIONS'));
    this.registerHandler('RESTORE_VERSION', this.notImplemented('RESTORE_VERSION'));

    // Read-only operations
    this.registerHandler('GET_DASHBOARD_INFO', handleGetDashboardInfo);
  }

  /**
   * Create a stub handler for not-yet-implemented mutations
   */
  private notImplemented(mutationType: string): MutationHandler {
    return async (): Promise<MutationResult> => {
      return {
        success: false,
        changes: [],
        error: `${mutationType} is not fully implemented in POC`,
      };
    };
  }

  /**
   * Register a mutation handler
   */
  private registerHandler<T extends MutationType>(
    type: T,
    handler: (payload: MutationPayloadMap[T], context: MutationContext) => Promise<MutationResult>
  ): void {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    this.handlers.set(type, handler as MutationHandler);
  }
}
