import { getPanelPluginNotFound } from 'app/features/panel/components/PanelPluginError';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { loadPanelPlugin } from 'app/features/plugins/state/actions';
import { ThunkResult } from 'app/types';
import { panelModelAndPluginReady } from './reducers';
import { LibraryElementDTO } from 'app/features/library-panels/types';
import { toPanelModelLibraryPanel } from 'app/features/library-panels/utils';
import { PanelOptionsChangedEvent, PanelQueriesChangedEvent } from 'app/types/events';

export function initPanelOnMount(panel: PanelModel): ThunkResult<void> {
  return async (dispatch, getStore) => {
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
      dispatch(panelModelAndPluginReady({ key: panel.key, plugin }));
    }
  };
}

export function changePanelPlugin(panel: PanelModel, pluginId: string): ThunkResult<void> {
  return async (dispatch, getStore) => {
    // ignore action is no change
    if (panel.type === pluginId) {
      return;
    }

    const store = getStore();
    let plugin = store.plugins.panels[pluginId];

    if (!plugin) {
      plugin = await dispatch(loadPanelPlugin(pluginId));
    }

    panel.changePlugin(plugin);

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
      libraryPanel: toPanelModelLibraryPanel(libraryPanel.model),
    });

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
    }

    panel.configRev = 0;
    panel.getQueryRunner().clearLastResult();
    panel.refresh();

    panel.events.publish(PanelQueriesChangedEvent);
    panel.events.publish(PanelOptionsChangedEvent);
  };
}
