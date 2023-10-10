import { locationService } from '@grafana/runtime';
import { sceneGraph, VizPanel } from '@grafana/scenes';
import { KeybindingSet } from 'app/core/services/KeybindingSet';

import { getViewPanelUrl } from '../utils/urlBuilders';

import { DashboardScene } from './DashboardScene';

export function setupKeyboardShortcuts(scene: DashboardScene) {
  const keybindings = new KeybindingSet();

  keybindings.addBinding({
    key: 'v',
    onTrigger: withFocusedPanel(scene, (vizPanel: VizPanel) => {
      if (!scene.state.viewPanelKey) {
        locationService.push(getViewPanelUrl(vizPanel.state.key!));
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
