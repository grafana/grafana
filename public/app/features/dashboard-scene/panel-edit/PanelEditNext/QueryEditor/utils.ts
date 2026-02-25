import { AlertState, DataTransformerConfig, GrafanaTheme2, TransformerCategory } from '@grafana/data';
import { t } from '@grafana/i18n';
import { CustomTransformerDefinition } from '@grafana/scenes';
import { DataQuery } from '@grafana/schema';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { ExpressionQuery } from 'app/features/expressions/types';

import { getAlertStateColor, QUERY_EDITOR_COLORS, QUERY_EDITOR_TYPE_CONFIG, QueryEditorType } from '../constants';

import { AlertRule, Transformation } from './types';

export function getEditorType(
  card: DataQuery | ExpressionQuery | Transformation | null
): Exclude<QueryEditorType, QueryEditorType.Alert> {
  if (!card) {
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
/**
 * Resolves the display type for the content header icon and border color.
 * Alert takes priority — if an alert is selected we're in alert view regardless
 * of what the data card type is.
 */
export function getDisplayType(
  selectedAlert: AlertRule | null,
  selectedTransformation: Transformation | null,
  selectedQuery: DataQuery | null,
  selectedExpression: ExpressionQuery | null
): QueryEditorType {
  if (selectedAlert) {
    return QueryEditorType.Alert;
  }
  if (selectedTransformation) {
    return QueryEditorType.Transformation;
  }
  if (selectedExpression) {
    return QueryEditorType.Expression;
  }
  return QueryEditorType.Query;
}

export function getEditorBorderColor({
  theme,
  editorType,
  alertState,
  isError,
}: {
  theme: GrafanaTheme2;
  editorType: QueryEditorType;
  alertState?: AlertState | null;
  isError?: boolean;
}): string {
  if (isError) {
    return QUERY_EDITOR_COLORS.error;
  }

  if (editorType === QueryEditorType.Alert && alertState) {
    return getAlertStateColor(theme, alertState);
  }
  return QUERY_EDITOR_TYPE_CONFIG[editorType].color;
}

export interface TransformerCategoryOption {
  slug: TransformerCategory;
  label: string;
}

export function getTransformerCategories(): TransformerCategoryOption[] {
  return [
    { slug: TransformerCategory.Combine, label: t('transformers.utils.get-categories-labels.combine', 'Combine') },
    {
      slug: TransformerCategory.CalculateNewFields,
      label: t('transformers.utils.get-categories-labels.calculate-new-fields', 'Calculate new fields'),
    },
    {
      slug: TransformerCategory.CreateNewVisualization,
      label: t('transformers.utils.get-categories-labels.create-new-visualization', 'Create new visualization'),
    },
    { slug: TransformerCategory.Filter, label: t('transformers.utils.get-categories-labels.filter', 'Filter') },
    {
      slug: TransformerCategory.PerformSpatialOperations,
      label: t('transformers.utils.get-categories-labels.perform-spatial-operations', 'Perform spatial operations'),
    },
    { slug: TransformerCategory.Reformat, label: t('transformers.utils.get-categories-labels.reformat', 'Reformat') },
    {
      slug: TransformerCategory.ReorderAndRename,
      label: t('transformers.utils.get-categories-labels.reorder-and-rename', 'Reorder and rename'),
    },
  ];
}
