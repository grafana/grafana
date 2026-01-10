/**
 * Shared types for mutation handlers
 */

import type { DashboardScene } from '../../scene/DashboardScene';
import type { MutationResult, MutationChange, MutationType, MutationPayloadMap, MutationTransaction } from '../types';

/**
 * Context passed to all mutation handlers
 */
export interface MutationContext {
  scene: DashboardScene;
  transaction: MutationTransactionInternal;
}

/**
 * Internal transaction type with mutable changes array
 */
export interface MutationTransactionInternal extends MutationTransaction {
  changes: MutationChange[];
}

/**
 * A mutation handler function
 */
export type MutationHandler<T extends MutationType = MutationType> = (
  payload: MutationPayloadMap[T],
  context: MutationContext
) => Promise<MutationResult>;
