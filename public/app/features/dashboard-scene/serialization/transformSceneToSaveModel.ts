import { SceneGridItem, SceneGridLayout, VizPanel } from '@grafana/scenes';
import { Dashboard, defaultDashboard, FieldConfigSource, Panel } from '@grafana/schema';
import { sortedDeepCloneWithoutNulls } from 'app/core/utils/object';

import { DashboardScene } from '../scene/DashboardScene';
import { PanelTimeRange } from '../scene/PanelTimeRange';
import { getPanelIdForVizPanel } from '../utils/utils';

export function transformSceneToSaveModel(scene: DashboardScene): Dashboard {
  const state = scene.state;
  const timeRange = state.$timeRange!.state;
  const body = state.body;
  const panels: Panel[] = [];

  if (body instanceof SceneGridLayout) {
    for (const child of body.state.children) {
      if (child instanceof SceneGridItem) {
        panels.push(gridItemToPanel(child));
      }
    }
  }

  const dashboard: Dashboard = {
    ...defaultDashboard,
    title: state.title,
    uid: state.uid,
    time: {
      from: timeRange.from,
      to: timeRange.to,
    },
    panels,
  };

  return sortedDeepCloneWithoutNulls(dashboard);
}

export function gridItemToPanel(gridItem: SceneGridItem): Panel {
  const vizPanel = gridItem.state.body;
  if (!(vizPanel instanceof VizPanel)) {
    throw new Error('SceneGridItem body expected to be VizPanel');
  }

  const panel: Panel = {
    id: getPanelIdForVizPanel(vizPanel),
    type: vizPanel.state.pluginId,
    title: vizPanel.state.title,
    gridPos: {
      x: gridItem.state.x ?? 0,
      y: gridItem.state.y ?? 0,
      w: gridItem.state.width ?? 0,
      h: gridItem.state.height ?? 0,
    },
    options: vizPanel.state.options,
    fieldConfig: (vizPanel.state.fieldConfig as FieldConfigSource) ?? { defaults: {}, overrides: [] },
    transformations: [],
    transparent: false,
  };

  const panelTime = vizPanel.state.$timeRange;

  if (panelTime instanceof PanelTimeRange) {
    panel.timeFrom = panelTime.state.timeFrom;
    panel.timeShift = panelTime.state.timeShift;
    panel.hideTimeOverride = panelTime.state.hideTimeOverride;
  }

  if (vizPanel.state.displayMode === 'transparent') {
    panel.transparent = true;
  }

  return panel;
}
