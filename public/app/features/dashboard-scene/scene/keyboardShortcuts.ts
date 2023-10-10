import { locationService } from '@grafana/runtime';
import { sceneGraph, VizPanel } from '@grafana/scenes';
import { KeybindingSet } from 'app/core/services/KeybindingSet';

import { getDashboardUrl, getViewPanelUrl, tryGetExploreUrlForPanel } from '../utils/urlBuilders';
import { getPanelIdForVizPanel } from '../utils/utils';

import { DashboardScene } from './DashboardScene';

export function setupKeyboardShortcuts(scene: DashboardScene) {
  const keybindings = new KeybindingSet();

  // View panel
  keybindings.addBinding({
    key: 'v',
    onTrigger: withFocusedPanel(scene, (vizPanel: VizPanel) => {
      if (!scene.state.viewPanelKey) {
        locationService.push(getViewPanelUrl(vizPanel.state.key!));
      }
    }),
  });

  // Panel edit
  keybindings.addBinding({
    key: 'e',
    onTrigger: withFocusedPanel(scene, async (vizPanel: VizPanel) => {
      const sceneRoot = vizPanel.getRoot();
      if (sceneRoot instanceof DashboardScene) {
        const panelId = getPanelIdForVizPanel(vizPanel);
        locationService.push(
          getDashboardUrl({
            uid: sceneRoot.state.uid,
            subPath: `/panel-edit/${panelId}`,
            currentQueryParams: location.search,
          })
        );
      }
    }),
  });

  // Got to Explore for panel
  keybindings.addBinding({
    key: 'p x',
    onTrigger: withFocusedPanel(scene, async (vizPanel: VizPanel) => {
      const url = await tryGetExploreUrlForPanel(vizPanel);
      if (url) {
        locationService.push(url);
      }
    }),
  });

  return () => keybindings.removeAll;
}

export function withFocusedPanel(scene: DashboardScene, fn: (vizPanel: VizPanel) => void) {
  return () => {
    const elements = document.querySelectorAll(':hover');

    for (let i = elements.length - 1; i > 0; i--) {
      const element = elements[i];

      if (element instanceof HTMLElement && element.dataset?.vizPanelKey) {
        const panelKey = element.dataset?.vizPanelKey;
        const vizPanel = sceneGraph.findObject(scene, (o) => o.state.key === panelKey);

        if (vizPanel && vizPanel instanceof VizPanel) {
          fn(vizPanel);
          return;
        }
      }
    }
  };
}
