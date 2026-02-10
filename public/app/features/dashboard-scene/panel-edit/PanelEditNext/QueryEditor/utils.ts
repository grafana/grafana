import { DataTransformerConfig } from '@grafana/data';
import { CustomTransformerDefinition } from '@grafana/scenes';
import { DataQuery } from '@grafana/schema';
import { isExpressionQuery } from 'app/features/expressions/guards';

import { QueryEditorType } from '../constants';

import { Transformation } from './types';

export function getEditorType(card: DataQuery | Transformation | null): QueryEditorType {
  if (!card) {
    // Default to query type if no card is provided
    return QueryEditorType.Query;
  }

  if ('transformId' in card) {
    return QueryEditorType.Transformation;
  }

  if (isExpressionQuery(card)) {
    return QueryEditorType.Expression;
  }

  return QueryEditorType.Query;
}

export function isDataTransformerConfig(
  transformation: DataTransformerConfig | DataQuery | CustomTransformerDefinition | null
): transformation is DataTransformerConfig {
  return transformation !== null && 'id' in transformation && !('refId' in transformation);
}

/**
 * Filters an array of transformations to only include DataTransformerConfig items since
 * the UI does not support CustomTransformerDefinition items.
 * @param transformations - The array of transformations to filter.
 * @returns An array of DataTransformerConfig items.
 */
export const filterDataTransformerConfigs = (
  transformations: Array<DataTransformerConfig | CustomTransformerDefinition>
): DataTransformerConfig[] => {
  return transformations.filter((t): t is DataTransformerConfig => isDataTransformerConfig(t));
};
