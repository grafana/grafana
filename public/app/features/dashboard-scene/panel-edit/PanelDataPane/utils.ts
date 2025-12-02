import { CustomTransformerDefinition, SceneDataQuery } from '@grafana/scenes';
import { DataQuery, DataTransformerConfig } from '@grafana/schema';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { ExpressionQueryType } from 'app/features/expressions/types';

export function findSqlExpression(queries: DataQuery[]) {
  return queries.find((query) => {
    return typeof query === 'object' && query !== null && 'type' in query && query.type === ExpressionQueryType.sql;
  });
}

export function scrollToQueryRow(refId: string) {
  // Query rows use uniqueId(refId + '_') for their internal id
  // The aria-controls attribute will be like "A_1" for refId "A"
  // So we need to search for aria-controls starting with "refId_"
  const queryRowHeader = document.querySelector(`[aria-controls^="${refId}_"]`);

  if (queryRowHeader) {
    // Find the parent query row wrapper
    const queryRow = queryRowHeader.closest('[data-testid="query-editor-row"]');

    if (queryRow instanceof HTMLElement) {
      queryRow.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

export const queryItemId = (query: SceneDataQuery) =>
  isExpressionQuery(query) ? `expression-${query.refId}` : `query-${query.refId}`;
export const transformItemId = (index: number) => `transform-${index}`;

export const isDataTransformerConfig = (
  t: DataTransformerConfig | CustomTransformerDefinition
): t is DataTransformerConfig => t !== null && typeof t === 'object' && 'id' in t && typeof t.id === 'string';
