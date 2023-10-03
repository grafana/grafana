import {
  SceneDataLayers,
  SceneGridItem,
  SceneGridItemLike,
  SceneGridLayout,
  SceneGridRow,
  VizPanel,
  dataLayers,
  SceneDataLayerProvider,
} from '@grafana/scenes';
import { AnnotationQuery, Dashboard, defaultDashboard, FieldConfigSource, Panel, RowPanel } from '@grafana/schema';
import { sortedDeepCloneWithoutNulls } from 'app/core/utils/object';

import { DashboardScene } from '../scene/DashboardScene';
import { PanelRepeaterGridItem } from '../scene/PanelRepeaterGridItem';
import { PanelTimeRange } from '../scene/PanelTimeRange';
import { RowRepeaterBehavior } from '../scene/RowRepeaterBehavior';
import { getPanelIdForVizPanel } from '../utils/utils';

export function transformSceneToSaveModel(scene: DashboardScene): Dashboard {
  const state = scene.state;
  const timeRange = state.$timeRange!.state;
  const data = state.$data;
  const body = state.body;
  const panels: Panel[] = [];

  if (body instanceof SceneGridLayout) {
    for (const child of body.state.children) {
      if (child instanceof SceneGridItem) {
        panels.push(gridItemToPanel(child));
      }

      if (child instanceof SceneGridRow) {
        // Skip repeat clones
        if (child.state.key!.indexOf('-clone-') > 0) {
          continue;
        }
        gridRowToSaveModel(child, panels);
      }
    }
  }

  let annotations: AnnotationQuery[] = [];
  if (data instanceof SceneDataLayers) {
    const layers = data.state.layers;

    annotations = dataLayersToAnnotations(layers);
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
    annotations: {
      list: annotations,
    },
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

export function gridRowToSaveModel(gridRow: SceneGridRow, panelsArray: Array<Panel | RowPanel>) {
  const rowPanel: RowPanel = {
    type: 'row',
    id: getPanelIdForVizPanel(gridRow),
    title: gridRow.state.title,
    gridPos: {
      x: gridRow.state.x ?? 0,
      y: gridRow.state.y ?? 0,
      w: gridRow.state.width ?? 24,
      h: gridRow.state.height ?? 1,
    },
    collapsed: Boolean(gridRow.state.isCollapsed),
    panels: [],
  };

  if (gridRow.state.$behaviors?.length) {
    const behavior = gridRow.state.$behaviors[0];

    if (behavior instanceof RowRepeaterBehavior) {
      rowPanel.repeat = behavior.state.variableName;
    }
  }

  panelsArray.push(rowPanel);

  const panelsInsideRow = gridRow.state.children.map(gridItemToPanel);

  if (gridRow.state.isCollapsed) {
    rowPanel.panels = panelsInsideRow;
  } else {
    panelsArray.push(...panelsInsideRow);
  }
}

export function dataLayersToAnnotations(layers: SceneDataLayerProvider[]) {
  const annotations: AnnotationQuery[] = [];
  for (const layer of layers) {
    if (!(layer instanceof dataLayers.AnnotationsDataLayer)) {
      continue;
    }

    annotations.push({
      ...layer.state.query,
      enable: Boolean(layer.state.isEnabled),
      hide: Boolean(layer.state.isHidden),
    });
  }

  return annotations;
}
