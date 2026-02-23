import { AlertState, DataTransformerConfig, GrafanaTheme2 } from '@grafana/data';
import { CustomTransformerDefinition } from '@grafana/scenes';
import { DataQuery } from '@grafana/schema';
import { isExpressionQuery } from 'app/features/expressions/guards';

import { getAlertStateColor, QUERY_EDITOR_TYPE_CONFIG, QueryEditorType } from '../constants';

import { PendingExpression, PendingTransformation } from './QueryEditorContext';
import { AlertRule, Transformation } from './types';

export function getEditorType(
  card: DataQuery | Transformation | AlertRule | null,
  pendingExpression?: PendingExpression | null,
  pendingTransformation?: PendingTransformation | null
): QueryEditorType {
  if (pendingExpression) {
    return QueryEditorType.Expression;
  }

  if (pendingTransformation) {
    return QueryEditorType.Transformation;
  }

  if (!card) {
    // Default to query type if no card is provided
    return QueryEditorType.Query;
  }

  if ('alertId' in card) {
    return QueryEditorType.Alert;
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

export function getTransformId(transformConfigId: string, index: number): string {
  return `${transformConfigId}-${index}`;
}

/**
 * Gets the border color for a query editor card based on its type.
 * For alerts, uses dynamic state-based color; otherwise uses static config color.
 *
 * @param theme - Grafana theme object
 * @param editorType - The type of editor (Query, Expression, Transformation, Alert)
 * @param alertState - Optional alert state (only used when editorType is Alert)
 * @returns The border color string
 */
export function getEditorBorderColor(
  theme: GrafanaTheme2,
  editorType: QueryEditorType,
  alertState?: AlertState | null
): string {
  if (editorType === QueryEditorType.Alert && alertState) {
    return getAlertStateColor(theme, alertState);
  }
  return QUERY_EDITOR_TYPE_CONFIG[editorType].color;
}
