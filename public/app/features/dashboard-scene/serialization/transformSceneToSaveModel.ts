import { SceneGridItem, SceneGridItemLike, SceneGridLayout, VizPanel } from '@grafana/scenes';
import { Dashboard, defaultDashboard, FieldConfigSource, Panel } from '@grafana/schema';
import { sortedDeepCloneWithoutNulls } from 'app/core/utils/object';

import { DashboardScene } from '../scene/DashboardScene';
import { PanelRepeaterGridItem } from '../scene/PanelRepeaterGridItem';
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

export function gridItemToPanel(gridItem: SceneGridItemLike): Panel {
  let vizPanel: VizPanel | undefined;
  let x = 0,
    y = 0,
    w = 0,
    h = 0;

  if (gridItem instanceof SceneGridItem) {
    if (!(gridItem.state.body instanceof VizPanel)) {
      throw new Error('SceneGridItem body expected to be VizPanel');
    }

    vizPanel = gridItem.state.body;
    x = gridItem.state.x ?? 0;
    y = gridItem.state.y ?? 0;
    w = gridItem.state.width ?? 0;
    h = gridItem.state.height ?? 0;
  }

  if (gridItem instanceof PanelRepeaterGridItem) {
    vizPanel = gridItem.state.source;

    x = gridItem.state.x ?? 0;
    y = gridItem.state.y ?? 0;
    w = gridItem.state.width ?? 0;
    h = gridItem.state.height ?? 0;
  }

  if (!vizPanel) {
    throw new Error('Unsupported grid item type');
  }

  const panel: Panel = {
    id: getPanelIdForVizPanel(vizPanel),
    type: vizPanel.state.pluginId,
    title: vizPanel.state.title,
    gridPos: { x, y, w, h },
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

  if (gridItem instanceof PanelRepeaterGridItem) {
    panel.repeat = gridItem.state.variableName;
    panel.maxPerRow = gridItem.state.maxPerRow;
    panel.repeatDirection = gridItem.getRepeatDirection();
  }

  return panel;
}
