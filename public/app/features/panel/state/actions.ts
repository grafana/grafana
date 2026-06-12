import { type DataTransformerConfig, type FieldConfigSource, getPanelOptionsWithDefaults } from '@grafana/data';
import { type PanelModel } from 'app/features/dashboard/state/PanelModel';
import { loadPanelPlugin } from 'app/features/plugins/admin/state/actions';
import { type ThunkResult } from 'app/types/store';

import { panelModelAndPluginReady, removePanel } from './reducers';

export function cleanUpPanelState(panelKey: string): ThunkResult<void> {
  return (dispatch) => {
    dispatch(removePanel({ key: panelKey }));
  };
}

export interface ChangePanelPluginAndOptionsArgs {
  panel: PanelModel;
  pluginId: string;
  options?: Record<string, unknown>;
  fieldConfig?: FieldConfigSource;
  transformations?: DataTransformerConfig[];
}

export function changePanelPlugin({
  panel,
  pluginId,
  options,
  fieldConfig,
  transformations,
}: ChangePanelPluginAndOptionsArgs): ThunkResult<void> {
  return async (dispatch, getStore) => {
    // ignore action is no change
    if (panel.type === pluginId && !options && !fieldConfig && !transformations) {
      return;
    }

    const store = getStore();
    let plugin = store.plugins.panels[pluginId];

    if (!plugin) {
      plugin = await dispatch(loadPanelPlugin(pluginId));
    }

    if (panel.type !== pluginId) {
      panel.changePlugin(plugin);
    }

    if (options || fieldConfig || transformations) {
      const newOptions = getPanelOptionsWithDefaults({
        plugin,
        currentOptions: options || panel.options,
        currentFieldConfig: fieldConfig || panel.fieldConfig,
        isAfterPluginChange: false,
      });

      panel.options = newOptions.options;
      panel.fieldConfig = newOptions.fieldConfig;
      panel.transformations = transformations || panel.transformations;
      panel.configRev++;
    }

    panel.generateNewKey();

    dispatch(panelModelAndPluginReady({ key: panel.key, plugin }));
  };
}
