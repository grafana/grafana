/**
 * Dashboard Mutation API - Core Types
 *
 * Shared framework types used across the mutation system.
 * Command-specific payload types are defined in their respective command files
 * and inferred from Zod schemas.
 *
 * The public types (MutationResult, MutationChange) are re-exported from
 * @grafana/runtime. This file adds internal-only extensions.
 */

import { DashboardMutationAPI } from '@grafana/runtime';

/**
 * Internal mutation representation.
 */
export interface Mutation {
  type: string;
  payload: unknown;
}

/**
 * Re-export MutationChange from the public API for internal use.
 */
export type MutationChange = DashboardMutationAPI.MutationChange;

/**
 * Internal MutationResult re-exports the public type for internal use.
 */
export type MutationResult = DashboardMutationAPI.MutationResult;

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
