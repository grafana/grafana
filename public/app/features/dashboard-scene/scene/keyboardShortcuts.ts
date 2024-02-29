import { locationService } from '@grafana/runtime';
import { sceneGraph, VizPanel } from '@grafana/scenes';
import { KeybindingSet } from 'app/core/services/KeybindingSet';

import { ShareModal } from '../sharing/ShareModal';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { getEditPanelUrl, getInspectUrl, getViewPanelUrl, tryGetExploreUrlForPanel } from '../utils/urlBuilders';
import { getPanelIdForVizPanel } from '../utils/utils';

import { DashboardScene } from './DashboardScene';
import { removePanel, toggleVizPanelLegend } from './PanelMenuBehavior';

export function setupKeyboardShortcuts(scene: DashboardScene) {
  const keybindings = new KeybindingSet();

  // View panel
  keybindings.addBinding({
    key: 'v',
    onTrigger: withFocusedPanel(scene, (vizPanel: VizPanel) => {
      if (!scene.state.viewPanelScene) {
        locationService.push(getViewPanelUrl(vizPanel));
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
        if (!scene.state.editPanel) {
          locationService.push(getEditPanelUrl(panelId));
        }
      }
    }),
  });

  // Panel share
  keybindings.addBinding({
    key: 'p s',
    onTrigger: withFocusedPanel(scene, async (vizPanel: VizPanel) => {
      scene.showModal(new ShareModal({ panelRef: vizPanel.getRef(), dashboardRef: scene.getRef() }));
    }),
  });

  // Panel inspect
  keybindings.addBinding({
    key: 'i',
    onTrigger: withFocusedPanel(scene, async (vizPanel: VizPanel) => {
      locationService.push(getInspectUrl(vizPanel));
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

  // Toggle legend
  keybindings.addBinding({
    key: 'p l',
    onTrigger: withFocusedPanel(scene, toggleVizPanelLegend),
  });

  // Refresh
  keybindings.addBinding({
    key: 'd r',
    onTrigger: () => sceneGraph.getTimeRange(scene).onRefresh(),
  });

  // Zoom out
  keybindings.addBinding({
    key: 't z',
    onTrigger: () => {
      handleZoomOut(scene);
    },
  });
  keybindings.addBinding({
    key: 'ctrl+z',
    onTrigger: () => {
      handleZoomOut(scene);
    },
  });

  keybindings.addBinding({
    key: 't left',
    onTrigger: () => {
      handleTimeRangeShift(scene, 'left');
    },
  });

  keybindings.addBinding({
    key: 't right',
    onTrigger: () => {
      handleTimeRangeShift(scene, 'right');
    },
  });

  // Dashboard settings
  keybindings.addBinding({
    key: 'd s',
    onTrigger: scene.onOpenSettings,
  });

  keybindings.addBinding({
    key: 'mod+s',
    onTrigger: () => scene.openSaveDrawer({}),
  });

  // toggle all panel legends (TODO)
  // delete panel
  keybindings.addBinding({
    key: 'p r',
    onTrigger: withFocusedPanel(scene, (vizPanel: VizPanel) => {
      removePanel(scene, vizPanel, true);
    }),
  });

  // duplicate panel
  keybindings.addBinding({
    key: 'p d',
    onTrigger: withFocusedPanel(scene, (vizPanel: VizPanel) => {
      scene.duplicatePanel(vizPanel);
    }),
  });

  // toggle all exemplars (TODO)
  // collapse all rows (TODO)
  // expand all rows (TODO)

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

function handleZoomOut(scene: DashboardScene) {
  const timePicker = dashboardSceneGraph.getTimePicker(scene);
  timePicker?.onZoom();
}

function handleTimeRangeShift(scene: DashboardScene, direction: 'left' | 'right') {
  const timePicker = dashboardSceneGraph.getTimePicker(scene);

  if (!timePicker) {
    return;
  }

  if (direction === 'left') {
    timePicker.onMoveBackward();
  }
  if (direction === 'right') {
    timePicker.onMoveForward();
  }
}
