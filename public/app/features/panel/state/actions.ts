import { getPanelPluginNotFound } from 'app/features/panel/components/PanelPluginError';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { loadPanelPlugin } from 'app/features/plugins/state/actions';
import { ThunkResult } from 'app/types';
import { panelModelAndPluginReady } from './reducers';

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
    }

    dispatch(panelModelAndPluginReady({ key: panel.key, plugin }));
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

    // clean up angular component (scope / ctrl state)
    const angularComponent = store.panels[panel.key].angularComponent;
    if (angularComponent) {
      angularComponent.destroy();
    }

    panel.changePlugin(plugin);

    dispatch(panelModelAndPluginReady({ key: panel.key, plugin }));
  };
}
