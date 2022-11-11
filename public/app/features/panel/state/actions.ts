import { DataTransformerConfig, FieldConfigSource } from '@grafana/data';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { getPanelOptionsWithDefaults } from 'app/features/dashboard/state/getPanelOptionsWithDefaults';
import { getLibraryPanel } from 'app/features/library-panels/state/api';
import { LibraryElementDTO } from 'app/features/library-panels/types';
import { getPanelPluginNotFound } from 'app/features/panel/components/PanelPluginError';
import { loadPanelPlugin } from 'app/features/plugins/admin/state/actions';
import { ThunkResult } from 'app/types';
import { PanelOptionsChangedEvent, PanelQueriesChangedEvent } from 'app/types/events';

import { changePanelKey, panelModelAndPluginReady, removePanel } from './reducers';

export function initPanelState(panel: PanelModel): ThunkResult<void> {
  return async (dispatch, getStore) => {
    if (panel.libraryPanel?.uid && !('model' in panel.libraryPanel)) {
      // this will call init with a loaded libary panel if it loads succesfully
      dispatch(loadLibraryPanelAndUpdate(panel));
      return;
    }

    let pluginToLoad = panel.type;
    let plugin = getStore().plugins.panels[pluginToLoad];

    if (!plugin) {
      try {
        plugin = await dispatch(loadPanelPlugin(pluginToLoad));
      } catch (e) {
        // When plugin not found
        plugin = getPanelPluginNotFound(pluginToLoad, pluginToLoad === 'row');
      }
    }

    if (!panel.plugin) {
      panel.pluginLoaded(plugin);
    }

    dispatch(panelModelAndPluginReady({ key: panel.key, plugin }));
  };
}

export function cleanUpPanelState(panelKey: string): ThunkResult<void> {
  return (dispatch) => {
    dispatch(removePanel({ key: panelKey }));
  };
}

export interface ChangePanelPluginAndOptionsArgs {
  panel: PanelModel;
  pluginId: string;
  options?: any;
  fieldConfig?: FieldConfigSource;
  transformations?: DataTransformerConfig[];
}

export function changePanelPlugin({
  panel,
  pluginId,
  options,
  fieldConfig,
}: ChangePanelPluginAndOptionsArgs): ThunkResult<void> {
  return async (dispatch, getStore) => {
    // ignore action is no change
    if (panel.type === pluginId && !options && !fieldConfig) {
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

    if (options || fieldConfig) {
      const newOptions = getPanelOptionsWithDefaults({
        plugin,
        currentOptions: options || panel.options,
        currentFieldConfig: fieldConfig || panel.fieldConfig,
        isAfterPluginChange: false,
      });

      panel.options = newOptions.options;
      panel.fieldConfig = newOptions.fieldConfig;
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

      panel.pluginLoaded(plugin);
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

export function loadLibraryPanelAndUpdate(panel: PanelModel): ThunkResult<void> {
  return async (dispatch) => {
    const uid = panel.libraryPanel!.uid!;
    try {
      const libPanel = await getLibraryPanel(uid, true);
      panel.initLibraryPanel(libPanel);
      dispatch(initPanelState(panel));
    } catch (ex) {
      console.log('ERROR: ', ex);
      dispatch(
        panelModelAndPluginReady({
          key: panel.key,
          plugin: getPanelPluginNotFound('Unable to load library panel: ' + uid, false),
        })
      );
    }
  };
}
