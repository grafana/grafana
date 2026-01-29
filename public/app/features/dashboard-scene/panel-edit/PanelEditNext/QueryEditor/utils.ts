import { DataTransformerConfig } from '@grafana/data';
import { t } from '@grafana/i18n';
import { CustomTransformerDefinition } from '@grafana/scenes';
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

export const getEditorTypeText = (editorType: QueryEditorType) => {
  switch (editorType) {
    case QueryEditorType.Transformation:
      return t('query-editor-next.sidebar.transformation', 'Transformation');
    case QueryEditorType.Expression:
      return t('query-editor-next.sidebar.expression', 'Expression');
    default:
      return t('query-editor-next.sidebar.query', 'Query');
  }
};

export function isDataTransformerConfig(
  transformation: DataTransformerConfig | DataQuery | CustomTransformerDefinition | null
): transformation is DataTransformerConfig {
  return transformation !== null && 'id' in transformation && !('refId' in transformation);
}
