/**
 * Dashboard Mutation API - Core Types
 *
 * Shared framework types used across the mutation system.
 * Command-specific payload types are defined in their respective command files
 * and inferred from Zod schemas.
 */

/**
 * Internal mutation representation.
 */
export interface Mutation {
  type: string;
  payload: unknown;
}

export interface MutationResult {
  success: boolean;
  /** Mutation to apply to undo this change */
  inverseMutation?: Mutation;
  /** Changes that were applied */
  changes: MutationChange[];
  /** Error message if failed */
  error?: string;
  /** Warnings (non-fatal issues) */
  warnings?: string[];
  /** Data returned by read-only operations */
  data?: unknown;
}

export interface MutationChange {
  path: string;
  previousValue: unknown;
  newValue: unknown;
}

export interface MutationTransaction {
  id: string;
  mutations: Mutation[];
  status: 'pending' | 'committed' | 'failed';
  startedAt: number;
  completedAt?: number;
}

export interface MutationEvent {
  type: 'mutation_applied' | 'mutation_failed';
  mutation: Mutation;
  result: MutationResult;
  transaction?: MutationTransaction;
  timestamp: number;
  source: 'assistant' | 'ui' | 'api';
}
