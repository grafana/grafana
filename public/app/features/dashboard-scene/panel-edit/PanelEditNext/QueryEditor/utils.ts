import { DataTransformerConfig } from '@grafana/data';
import { DataQuery } from '@grafana/schema';
import { isExpressionQuery } from 'app/features/expressions/guards';

import { QueryEditorType } from '../constants';

export function getEditorType(card: DataQuery | DataTransformerConfig | null): QueryEditorType {
  if (!card) {
    // Default to query type if no card is provided
    return QueryEditorType.Query;
  }

  if (!('refId' in card)) {
    return QueryEditorType.Transformation;
  }

  if (isExpressionQuery(card)) {
    return QueryEditorType.Expression;
  }

  return QueryEditorType.Query;
}
