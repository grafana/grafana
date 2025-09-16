import { PromVisualQueryOperationCategory } from '../../types';
import { PrometheusVisualQuery, QueryBuilderOperation, QueryBuilderOperationDef } from '../types';

/**
 * Renders operations
 */
export function renderOperations(
  queryString: string,
  operations: QueryBuilderOperation[],
  operationsRegistry: Map<string, QueryBuilderOperationDef>
): string {
  for (const operation of operations) {
    const def = operationsRegistry.get(operation.id);
    if (!def) {
      throw new Error(`Could not find operation ${operation.id} in the registry`);
    }
    queryString = def.renderer(operation, def, queryString);
  }

  return queryString;
}

/**
 * Checks if query has binary operation
 */
export function hasBinaryOp(
  query: PrometheusVisualQuery,
  operationsRegistry: Map<string, QueryBuilderOperationDef>
): boolean {
  return (
    query.operations.find((op) => {
      const def = operationsRegistry.get(op.id);
      return def?.category === PromVisualQueryOperationCategory.BinaryOps;
    }) !== undefined
  );
}
