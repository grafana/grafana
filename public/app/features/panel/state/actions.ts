import { type DataTransformerConfig, type FieldConfigSource, getPanelOptionsWithDefaults } from '@grafana/data';
import { type PanelModel } from 'app/features/dashboard/state/PanelModel';
import { type LibraryElementDTO } from 'app/features/library-panels/types';
import { loadPanelPlugin } from 'app/features/plugins/admin/state/actions';
import { PanelOptionsChangedEvent, PanelQueriesChangedEvent } from 'app/types/events';
import { type ThunkResult } from 'app/types/store';

import { changePanelKey, panelModelAndPluginReady, removePanel } from './reducers';

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

export function changeToLibraryPanel(panel: PanelModel, libraryPanel: LibraryElementDTO): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const newPluginId = libraryPanel.model.type;
    const oldType = panel.type;

    // Update model but preserve gridPos & id
    panel.restoreModel({
      ...libraryPanel.model,
      gridPos: panel.gridPos,
      id: panel.id,
      libraryPanel: libraryPanel,
    });

    // a new library panel usually means new queries, clear any current result
    panel.getQueryRunner().clearLastResult();

    // Handle plugin change
    if (oldType !== newPluginId) {
      const store = getStore();
      let plugin = store.plugins.panels[newPluginId];

      if (!plugin) {
        plugin = await dispatch(loadPanelPlugin(newPluginId));
      }

      await panel.pluginLoaded(plugin);
      panel.generateNewKey();

      await dispatch(panelModelAndPluginReady({ key: panel.key, plugin }));
    } else {
      // Even if the plugin is the same, we want to change the key
      // to force a rerender
      const oldKey = panel.key;
      panel.generateNewKey();
      dispatch(changePanelKey({ oldKey, newKey: panel.key }));
    }

    panel.configRev = 0;
    panel.hasSavedPanelEditChange = true;
    panel.refresh();

    panel.events.publish(PanelQueriesChangedEvent);
    panel.events.publish(PanelOptionsChangedEvent);
  };
}
