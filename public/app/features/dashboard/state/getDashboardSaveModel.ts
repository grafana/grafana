import { sortedDeepCloneWithoutNulls } from 'app/core/utils/object';
import { variableAdapters } from 'app/features/variables/adapters';
import { getVariables } from 'app/features/variables/state/selectors';
import { DashboardDataDTO, StoreState } from 'app/types';
import { cloneDeep, find } from 'lodash';
import { DashboardModel } from './DashboardModel';
import { PanelModel } from './PanelModel';

export interface CloneOptions {
  saveVariables?: boolean;
  saveTimerange?: boolean;
  message?: string;
}

export function getDashboardSaveModel(state: StoreState, options?: CloneOptions): DashboardDataDTO {
  const dashboard = state.dashboard.getModel();
  if (!dashboard) {
    throw Error('No dashboard found in state');
  }

  // Deep clone properties from DashboardModel
  let copy: any = {};
  for (const property in dashboard) {
    if (DashboardModel.nonPersistedProperties[property] || !dashboard.hasOwnProperty(property)) {
      continue;
    }

    copy[property] = cloneDeep((dashboard as any)[property]);
  }

  // Simple test fo where transition from some state in DashboardModel and redux and glue it together here
  copy.title = state.dashboard.attributes.title;
  copy.description = state.dashboard.attributes.description;

  // Update templating
  const shouldSaveVariables = options?.saveVariables ?? true;
  const originalVariables = dashboard.originalTemplating;
  const currentVariables = getVariables(state);

  copy.templating = {
    list: currentVariables.map((variable) =>
      variableAdapters.get(variable.type).getSaveModel(variable, shouldSaveVariables)
    ),
  };

  if (!shouldSaveVariables) {
    for (let i = 0; i < copy.templating.list.length; i++) {
      const current = copy.templating.list[i];
      const original: any = find(originalVariables, { name: current.name, type: current.type });

      if (!original) {
        continue;
      }

      if (current.type === 'adhoc') {
        copy.templating.list[i].filters = original.filters;
      } else {
        copy.templating.list[i].current = original.current;
      }
    }
  }

  const shouldSaveTimeRange = options?.saveTimerange ?? true;
  if (!shouldSaveTimeRange) {
    copy.time = dashboard.originalTime;
  }

  // get panel save models
  copy.panels = getPanelSaveModels(dashboard);

  //  sort by keys
  copy = sortedDeepCloneWithoutNulls(copy);

  return copy;
}

function getPanelSaveModels(dashboard: DashboardModel) {
  return dashboard.panels
    .filter((panel: PanelModel) => {
      if (dashboard.snapshot) {
        return true;
      }
      if (panel.type === 'add-panel') {
        return false;
      }
      // skip repeated panels in the saved model
      if (panel.repeatPanelId) {
        return false;
      }
      // skip repeated rows in the saved model
      if (panel.repeatedByRow) {
        return false;
      }
      return true;
    })
    .map((panel: PanelModel) => {
      // If we save while editing we should include the panel in edit mode instead of the
      // unmodified source panel
      if (dashboard.panelInEdit && dashboard.panelInEdit.id === panel.id) {
        return dashboard.panelInEdit.getSaveModel();
      }
      return panel.getSaveModel();
    })
    .map((model: any) => {
      if (dashboard.snapshot) {
        return model;
      }
      // Clear any scopedVars from persisted mode. This cannot be part of getSaveModel as we need to be able to copy
      // panel models with preserved scopedVars, for example when going into edit mode.
      delete model.scopedVars;

      // Clear any repeated panels from collapsed rows
      if (model.type === 'row' && model.panels && model.panels.length > 0) {
        model.panels = model.panels
          .filter((rowPanel: PanelModel) => !rowPanel.repeatPanelId)
          .map((model: PanelModel) => {
            delete model.scopedVars;
            return model;
          });
      }

      return model;
    });
}
