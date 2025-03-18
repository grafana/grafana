import { ActionModel, Field, InterpolateFunction, LinkModel } from '@grafana/data';
import { DataFrame } from '@grafana/data/';
import { config } from '@grafana/runtime';
import { getActions } from 'app/features/actions/utils';

export const getDataLinks = (field: Field, rowIdx: number) => {
  const links: Array<LinkModel<Field>> = [];

  if ((field.config.links?.length ?? 0) > 0 && field.getLinks != null) {
    const v = field.values[rowIdx];
    const disp = field.display ? field.display(v) : { text: `${v}`, numeric: +v };

    const linkLookup = new Set<string>();

    field.getLinks({ calculatedValue: disp, valueRowIndex: rowIdx }).forEach((link) => {
      const key = `${link.title}/${link.href}`;
      if (!linkLookup.has(key)) {
        links.push(link);
        linkLookup.add(key);
      }
    });
  }

  return links;
};

export const getFieldActions = (
  dataFrame: DataFrame,
  field: Field,
  replaceVars: InterpolateFunction,
  rowIndex: number
) => {
  if (!config.featureToggles?.vizActions) {
    return [];
  }

  const actions: Array<ActionModel<Field>> = [];
  const actionLookup = new Set<string>();

  const actionsModel = getActions(dataFrame, field, field.state!.scopedVars!, replaceVars, field.config.actions ?? [], {
    valueRowIndex: rowIndex,
  });

  actionsModel.forEach((action) => {
    const key = `${action.title}`;
    if (!actionLookup.has(key)) {
      actions.push(action);
      actionLookup.add(key);
    }
  });

  return actions;
};
