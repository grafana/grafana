import { type ActionModel, type DataFrame, type Field, type InterpolateFunction } from '@grafana/data';

/**
 * The real implementation delegates to app/features/actions/utils, which imports
 * @grafana/runtime. Field actions are an app feature; an embedded panel gets none.
 */
export const getFieldActions = (
  _frame: DataFrame,
  _field: Field,
  _replaceVars?: InterpolateFunction,
  _actionsCount?: number
): ActionModel[] => [];
