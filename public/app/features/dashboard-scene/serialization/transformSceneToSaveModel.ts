import { isEmptyObject, TimeRange } from '@grafana/data';
import {
  SceneDataLayers,
  SceneGridItem,
  SceneGridItemLike,
  SceneGridLayout,
  SceneGridRow,
  VizPanel,
  SceneQueryRunner,
  SceneDataTransformer,
  SceneVariableSet,
  AdHocFilterSet,
} from '@grafana/scenes';
import {
  AnnotationQuery,
  Dashboard,
  DataTransformerConfig,
  defaultDashboard,
  FieldConfigSource,
  Panel,
  RowPanel,
  VariableModel,
  VariableRefresh,
} from '@grafana/schema';
import { sortedDeepCloneWithoutNulls } from 'app/core/utils/object';
import { getPanelDataFrames } from 'app/features/dashboard/components/HelpWizard/utils';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard';
import { GrafanaQueryType } from 'app/plugins/datasource/grafana/types';

import { DashboardScene } from '../scene/DashboardScene';
import { LibraryVizPanel } from '../scene/LibraryVizPanel';
import { PanelRepeaterGridItem } from '../scene/PanelRepeaterGridItem';
import { PanelTimeRange } from '../scene/PanelTimeRange';
import { RowRepeaterBehavior } from '../scene/RowRepeaterBehavior';
import { ShareQueryDataProvider } from '../scene/ShareQueryDataProvider';
import { getPanelIdForVizPanel } from '../utils/utils';

import { GRAFANA_DATASOURCE_REF } from './const';
import { dataLayersToAnnotations } from './dataLayersToAnnotations';
import { sceneVariablesSetToVariables } from './sceneVariablesSetToVariables';

export function transformSceneToSaveModel(scene: DashboardScene, isSnapshot = false): Dashboard {
  const state = scene.state;
  const timeRange = state.$timeRange!.state;
  const data = state.$data;
  const variablesSet = state.$variables;
  const body = state.body;
  const panels: Panel[] = [];

  let variables: VariableModel[] = [];

  if (body instanceof SceneGridLayout) {
    for (const child of body.state.children) {
      if (child instanceof SceneGridItem) {
        panels.push(gridItemToPanel(child, isSnapshot));
      }

      if (child instanceof SceneGridRow) {
        // Skip repeat clones
        if (child.state.key!.indexOf('-clone-') > 0) {
          continue;
        }
        gridRowToSaveModel(child, panels, isSnapshot);
      }
    }
  }

  let annotations: AnnotationQuery[] = [];
  if (data instanceof SceneDataLayers) {
    const layers = data.state.layers;

    annotations = dataLayersToAnnotations(layers);
  }

  if (variablesSet instanceof SceneVariableSet) {
    variables = sceneVariablesSetToVariables(variablesSet);
  }

  if (state.controls) {
    for (const control of state.controls) {
      if (control instanceof AdHocFilterSet) {
        variables.push({
          name: control.state.name!,
          type: 'adhoc',
          datasource: control.state.datasource,
        });
      }
    }
  }

  const dashboard: Dashboard = {
    ...defaultDashboard,
    title: state.title,
    uid: state.uid,
    id: state.id,
    time: {
      from: timeRange.from,
      to: timeRange.to,
    },
    panels,
    annotations: {
      list: annotations,
    },
    templating: {
      list: variables,
    },
    timezone: timeRange.timeZone,
    fiscalYearStartMonth: timeRange.fiscalYearStartMonth,
    weekStart: timeRange.weekStart,
  };

  return sortedDeepCloneWithoutNulls(dashboard);
}

export function gridItemToPanel(gridItem: SceneGridItemLike, isSnapshot = false): Panel {
  let vizPanel: VizPanel | undefined;
  let x = 0,
    y = 0,
    w = 0,
    h = 0;

  if (gridItem instanceof SceneGridItem) {
    // Handle library panels, early exit
    if (gridItem.state.body instanceof LibraryVizPanel) {
      x = gridItem.state.x ?? 0;
      y = gridItem.state.y ?? 0;
      w = gridItem.state.width ?? 0;
      h = gridItem.state.height ?? 0;

      return {
        id: getPanelIdForVizPanel(gridItem.state.body),
        title: gridItem.state.body.state.title,
        gridPos: { x, y, w, h },
        libraryPanel: {
          name: gridItem.state.body.state.name,
          uid: gridItem.state.body.state.uid,
        },
      } as Panel;
    }

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
    transparent: vizPanel.state.displayMode === 'transparent',
  };

  const panelTime = vizPanel.state.$timeRange;

  if (panelTime instanceof PanelTimeRange) {
    panel.timeFrom = panelTime.state.timeFrom;
    panel.timeShift = panelTime.state.timeShift;
    panel.hideTimeOverride = panelTime.state.hideTimeOverride;
  }

  const dataProvider = vizPanel.state.$data;

  // Dashboard datasource handling
  if (dataProvider instanceof ShareQueryDataProvider) {
    panel.datasource = {
      type: 'datasource',
      uid: SHARED_DASHBOARD_QUERY,
    };
    panel.targets = [
      {
        datasource: { ...panel.datasource },
        refId: 'A',
        panelId: dataProvider.state.query.panelId,
        topic: dataProvider.state.query.topic,
      },
    ];
  }

  // Regular queries handling
  if (dataProvider instanceof SceneQueryRunner) {
    panel.targets = dataProvider.state.queries;
    panel.maxDataPoints = dataProvider.state.maxDataPoints;
    panel.datasource = dataProvider.state.datasource;
  }

  // Transformations handling
  if (dataProvider instanceof SceneDataTransformer) {
    const panelData = dataProvider.state.$data;
    if (panelData instanceof ShareQueryDataProvider) {
      panel.datasource = {
        type: 'datasource',
        uid: SHARED_DASHBOARD_QUERY,
      };
      panel.targets = [
        {
          datasource: { ...panel.datasource },
          refId: 'A',
          panelId: panelData.state.query.panelId,
          topic: panelData.state.query.topic,
        },
      ];
    }

    if (panelData instanceof SceneQueryRunner) {
      panel.targets = panelData.state.queries;
      panel.maxDataPoints = panelData.state.maxDataPoints;
      panel.datasource = panelData.state.datasource;
    }

    panel.transformations = dataProvider.state.transformations as DataTransformerConfig[];
  }

  if (dataProvider && isSnapshot) {
    panel.datasource = GRAFANA_DATASOURCE_REF;

    let data = getPanelDataFrames(dataProvider.state.data);
    if (dataProvider instanceof SceneDataTransformer) {
      // For transformations the non-transformed data is snapshoted
      data = getPanelDataFrames(dataProvider.state.$data!.state.data);
    }

    panel.targets = [
      {
        refId: 'A',
        datasource: panel.datasource,
        queryType: GrafanaQueryType.Snapshot,
        snapshot: data,
      },
    ];
  }

  if (gridItem instanceof PanelRepeaterGridItem) {
    panel.repeat = gridItem.state.variableName;
    panel.maxPerRow = gridItem.state.maxPerRow;
    panel.repeatDirection = gridItem.getRepeatDirection();
  }

  return panel;
}

export function gridRowToSaveModel(gridRow: SceneGridRow, panelsArray: Array<Panel | RowPanel>, isSnapshot = false) {
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

  const panelsInsideRow = gridRow.state.children.map((c) => gridItemToPanel(c, isSnapshot));

  if (gridRow.state.isCollapsed) {
    rowPanel.panels = panelsInsideRow;
  } else {
    panelsArray.push(...panelsInsideRow);
  }
}

export function trimDashboardForSnapshot(title: string, time: TimeRange, dash: Dashboard, panel?: VizPanel) {
  let result = {
    ...dash,
    title,
    time: {
      from: time.from.toISOString(),
      to: time.to.toISOString(),
    },
    links: [],
  };

  // When VizPanel is present, we are snapshoting a single panel. The rest of the panels is removed from the dashboard,
  // and the panel is resized to 24x20 grid and placed at the top of the dashboard.
  if (panel) {
    // @ts-expect-error Due to legacy panels types. Id is present on such panels too.
    const singlePanel = dash.panels?.find((p) => p.id === getPanelIdForVizPanel(panel));
    if (singlePanel) {
      // @ts-expect-error Due to legacy panels types. Id is present on such panels too.
      singlePanel.gridPos = { w: 24, x: 0, y: 0, h: 20 };
      result = {
        ...result,
        panels: [singlePanel],
      };
    }
  }

  // Remove links from all panels
  result.panels?.forEach((panel) => {
    if ('links' in panel) {
      panel.links = [];
    }
  });

  // Remove annotation queries, attach snapshotData: [] for backwards compatibility
  if (result.annotations) {
    const annotations = result.annotations.list?.filter((annotation) => annotation.enable) || [];
    const trimedAnnotations = annotations.map((annotation) => {
      return {
        name: annotation.name,
        enable: annotation.enable,
        iconColor: annotation.iconColor,
        type: annotation.type,
        builtIn: annotation.builtIn,
        hide: annotation.hide,
        // TODO: Remove when we migrate snapshots to snapshot queries.
        // For now leaving this in here to avoid annotation queries in snapshots.
        // Annotations per panel are part of the snapshot query, so we don't need to store them here.
        snapshotData: [],
      };
    });

    result.annotations.list = trimedAnnotations;
  }

  if (result.templating) {
    result.templating.list?.forEach((variable) => {
      if ('query' in variable) {
        variable.query = '';
      }
      if ('options' in variable) {
        variable.options = variable.current && !isEmptyObject(variable.current) ? [variable.current] : [];
      }

      if ('refresh' in variable) {
        variable.refresh = VariableRefresh.never;
      }
    });
  }

  return result;
}
