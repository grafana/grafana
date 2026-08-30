import { type DataFrame, type ActionModel, type Field, type InterpolateFunction } from '@grafana/data';
import { getActions } from 'app/features/actions/utils';

export const getFieldActions = (
  dataFrame: DataFrame,
  field: Field,
  replaceVars: InterpolateFunction,
  rowIndex: number,
  visualizationType?: string
) => {
  const actions: Array<ActionModel<Field>> = [];

  if (field.state?.scopedVars) {
    const actionLookup = new Set<string>();

    const actionsModel = getActions(
      dataFrame,
      field,
      field.state.scopedVars,
      replaceVars,
      field.config.actions ?? [],
      {
        valueRowIndex: rowIndex,
      },
      visualizationType
    );

    actionsModel.forEach((action) => {
      const key = `${action.title}`;
      if (!actionLookup.has(key)) {
        actions.push(action);
        actionLookup.add(key);
      }
    });
  }

  return actions;
};
