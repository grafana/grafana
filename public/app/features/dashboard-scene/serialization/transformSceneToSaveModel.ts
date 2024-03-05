import { isEqual } from 'lodash';

import { isEmptyObject, ScopedVars, TimeRange } from '@grafana/data';
import {
  behaviors,
  SceneDataLayers,
  SceneGridItem,
  SceneGridItemLike,
  SceneGridLayout,
  SceneGridRow,
  VizPanel,
  SceneDataTransformer,
  SceneVariableSet,
  LocalValueVariable,
} from '@grafana/scenes';
import {
  AnnotationQuery,
  Dashboard,
  DashboardLink,
  DataTransformerConfig,
  defaultDashboard,
  defaultTimePickerConfig,
  FieldConfigSource,
  GridPos,
  Panel,
  RowPanel,
  TimePickerConfig,
  VariableModel,
  VariableRefresh,
} from '@grafana/schema';
import { sortedDeepCloneWithoutNulls } from 'app/core/utils/object';
import { getPanelDataFrames } from 'app/features/dashboard/components/HelpWizard/utils';
import { DASHBOARD_SCHEMA_VERSION } from 'app/features/dashboard/state/DashboardMigrator';
import { GrafanaQueryType } from 'app/plugins/datasource/grafana/types';

import { AddLibraryPanelWidget } from '../scene/AddLibraryPanelWidget';
import { DashboardScene } from '../scene/DashboardScene';
import { LibraryVizPanel } from '../scene/LibraryVizPanel';
import { PanelRepeaterGridItem } from '../scene/PanelRepeaterGridItem';
import { PanelTimeRange } from '../scene/PanelTimeRange';
import { RowRepeaterBehavior } from '../scene/RowRepeaterBehavior';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { getPanelIdForVizPanel, getQueryRunnerFor } from '../utils/utils';

import { GRAFANA_DATASOURCE_REF } from './const';
import { dataLayersToAnnotations } from './dataLayersToAnnotations';
import { sceneVariablesSetToVariables } from './sceneVariablesSetToVariables';

export function transformSceneToSaveModel(scene: DashboardScene, isSnapshot = false): Dashboard {
  const state = scene.state;
  const timeRange = state.$timeRange!.state;
  const data = state.$data;
  const variablesSet = state.$variables;
  const body = state.body;

  let panels: Panel[] = [];
  let graphTooltip = defaultDashboard.graphTooltip;
  let variables: VariableModel[] = [];

  if (body instanceof SceneGridLayout) {
    for (const child of body.state.children) {
      if (child instanceof SceneGridItem) {
        panels.push(gridItemToPanel(child, isSnapshot));
      }

      if (child instanceof PanelRepeaterGridItem) {
        panels = panels.concat(panelRepeaterToPanels(child, isSnapshot));
      }

      if (child instanceof SceneGridRow) {
        // Skip repeat clones or when generating a snapshot
        if (child.state.key!.indexOf('-clone-') > 0 && !isSnapshot) {
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

  const controlsState = state.controls?.state;

  if (state.$behaviors) {
    for (const behavior of state.$behaviors!) {
      if (behavior instanceof behaviors.CursorSync) {
        graphTooltip = behavior.state.sync;
      }
    }
  }

  const timePickerWithoutDefaults = removeDefaults<TimePickerConfig>(
    {
      refresh_intervals: controlsState?.refreshPicker.state.intervals,
      hidden: controlsState?.hideTimeControls,
      nowDelay: timeRange.UNSAFE_nowDelay,
    },
    defaultTimePickerConfig
  );

  const dashboard: Dashboard = {
    ...defaultDashboard,
    title: state.title,
    description: state.description || undefined,
    uid: state.uid,
    id: state.id,
    editable: state.editable,
    time: {
      from: timeRange.from,
      to: timeRange.to,
    },
    timepicker: timePickerWithoutDefaults,
    panels,
    annotations: {
      list: annotations,
    },
    templating: {
      list: variables,
    },
    version: state.version,
    timezone: timeRange.timeZone,
    fiscalYearStartMonth: timeRange.fiscalYearStartMonth,
    weekStart: timeRange.weekStart,
    tags: state.tags,
    links: state.links,
    graphTooltip,
    schemaVersion: DASHBOARD_SCHEMA_VERSION,
  };

  return sortedDeepCloneWithoutNulls(dashboard);
}

export function libraryVizPanelToPanel(libPanel: LibraryVizPanel, gridPos: GridPos): Panel {
  if (!libPanel.state.panel) {
    throw new Error('Library panel has no panel');
  }

  return {
    id: getPanelIdForVizPanel(libPanel.state.panel),
    title: libPanel.state.title,
    gridPos: gridPos,
    libraryPanel: {
      name: libPanel.state.name,
      uid: libPanel.state.uid,
    },
  } as Panel;
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

      return libraryVizPanelToPanel(gridItem.state.body, { x, y, w, h });
    }

    // Handle library panel widget as well and exit early
    if (gridItem.state.body instanceof AddLibraryPanelWidget) {
      x = gridItem.state.x ?? 0;
      y = gridItem.state.y ?? 0;
      w = gridItem.state.width ?? 0;
      h = gridItem.state.height ?? 0;

      return {
        id: getPanelIdForVizPanel(gridItem.state.body),
        type: 'add-library-panel',
        gridPos: { x, y, w, h },
      };
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
    x = gridItem.state.x ?? 0;
    y = gridItem.state.y ?? 0;
    w = gridItem.state.width ?? 0;
    h = gridItem.state.height ?? 0;

    if (gridItem.state.source instanceof LibraryVizPanel) {
      return libraryVizPanelToPanel(gridItem.state.source, { x, y, w, h });
    } else {
      vizPanel = gridItem.state.source;
    }
  }

  if (!vizPanel) {
    throw new Error('Unsupported grid item type');
  }

  const panel: Panel = vizPanelToPanel(vizPanel, { x, y, h, w }, isSnapshot, gridItem);

  return panel;
}

export function vizPanelToPanel(
  vizPanel: VizPanel,
  gridPos?: GridPos,
  isSnapshot = false,
  gridItem?: SceneGridItemLike
) {
  const panel: Panel = {
    id: getPanelIdForVizPanel(vizPanel),
    type: vizPanel.state.pluginId,
    title: vizPanel.state.title,
    gridPos,
    options: vizPanel.state.options,
    fieldConfig: (vizPanel.state.fieldConfig as FieldConfigSource) ?? { defaults: {}, overrides: [] },
    transformations: [],
    transparent: vizPanel.state.displayMode === 'transparent',
    pluginVersion: vizPanel.state.pluginVersion,
    ...vizPanelDataToPanel(vizPanel, isSnapshot),
  };

  const panelTime = vizPanel.state.$timeRange;

  if (panelTime instanceof PanelTimeRange) {
    panel.timeFrom = panelTime.state.timeFrom;
    panel.timeShift = panelTime.state.timeShift;
    panel.hideTimeOverride = panelTime.state.hideTimeOverride;
  }

  if (gridItem instanceof PanelRepeaterGridItem) {
    panel.repeat = gridItem.state.variableName;
    panel.maxPerRow = gridItem.state.maxPerRow;
    panel.repeatDirection = gridItem.getRepeatDirection();
  }

  const panelLinks = dashboardSceneGraph.getPanelLinks(vizPanel);
  panel.links = (panelLinks?.state.rawLinks as DashboardLink[]) ?? [];

  if (panel.links.length === 0) {
    delete panel.links;
  }

  if (panel.transformations?.length === 0) {
    delete panel.transformations;
  }

  if (!panel.transparent) {
    delete panel.transparent;
  }
  return panel;
}

function vizPanelDataToPanel(
  vizPanel: VizPanel,
  isSnapshot = false
): Pick<Panel, 'datasource' | 'targets' | 'maxDataPoints' | 'transformations'> {
  const dataProvider = vizPanel.state.$data;

  const panel: Pick<
    Panel,
    'datasource' | 'targets' | 'maxDataPoints' | 'transformations' | 'cacheTimeout' | 'queryCachingTTL'
  > = {};
  const queryRunner = getQueryRunnerFor(vizPanel);

  if (queryRunner) {
    panel.targets = queryRunner.state.queries;
    panel.maxDataPoints = queryRunner.state.maxDataPoints;
    panel.datasource = queryRunner.state.datasource;

    if (queryRunner.state.cacheTimeout) {
      panel.cacheTimeout = queryRunner.state.cacheTimeout;
    }

    if (queryRunner.state.queryCachingTTL) {
      panel.queryCachingTTL = queryRunner.state.queryCachingTTL;
    }
  }

  if (dataProvider instanceof SceneDataTransformer) {
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

  return panel;
}

export function panelRepeaterToPanels(repeater: PanelRepeaterGridItem, isSnapshot = false): Panel[] {
  if (!isSnapshot) {
    return [gridItemToPanel(repeater)];
  } else {
    if (repeater.state.source instanceof LibraryVizPanel) {
      const { x = 0, y = 0, width: w = 0, height: h = 0 } = repeater.state;
      return [libraryVizPanelToPanel(repeater.state.source, { x, y, w, h })];
    }

    if (repeater.state.repeatedPanels) {
      const itemHeight = repeater.state.itemHeight ?? 10;
      const rowCount = Math.ceil(repeater.state.repeatedPanels!.length / repeater.getMaxPerRow());
      const columnCount = Math.ceil(repeater.state.repeatedPanels!.length / rowCount);
      const w = 24 / columnCount;
      const h = itemHeight;
      const panels = repeater.state.repeatedPanels!.map((panel, index) => {
        let x = 0,
          y = 0;
        if (repeater.state.repeatDirection === 'v') {
          x = repeater.state.x!;
          y = index * h;
        } else {
          x = (index % columnCount) * w;
          y = repeater.state.y! + Math.floor(index / columnCount) * h;
        }

        const gridPos = { x, y, w, h };

        const localVariable = panel.state.$variables!.getByName(repeater.state.variableName!) as LocalValueVariable;

        const result: Panel = {
          id: getPanelIdForVizPanel(panel),
          type: panel.state.pluginId,
          title: panel.state.title,
          gridPos,
          options: panel.state.options,
          fieldConfig: (panel.state.fieldConfig as FieldConfigSource) ?? { defaults: {}, overrides: [] },
          transformations: [],
          transparent: panel.state.displayMode === 'transparent',
          // @ts-expect-error scopedVars are runtime only properties, not part of the persisted Dashboardmodel
          scopedVars: {
            [repeater.state.variableName!]: {
              text: localVariable?.state.text,
              value: localVariable?.state.value,
            },
          },
          ...vizPanelDataToPanel(panel, isSnapshot),
        };
        return result;
      });

      return panels;
    }

    return [];
  }
}

export function gridRowToSaveModel(gridRow: SceneGridRow, panelsArray: Array<Panel | RowPanel>, isSnapshot = false) {
  const collapsed = Boolean(gridRow.state.isCollapsed);
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
    collapsed,
    panels: [],
  };

  if (gridRow.state.$behaviors?.length) {
    const behavior = gridRow.state.$behaviors[0];
    if (behavior instanceof RowRepeaterBehavior) {
      rowPanel.repeat = behavior.state.variableName;
    }
  }

  if (isSnapshot) {
    // Rows that are repeated has SceneVariableSet attached to them.
    if (gridRow.state.$variables) {
      const localVariable = gridRow.state.$variables;
      const scopedVars: ScopedVars = (localVariable.state.variables as LocalValueVariable[]).reduce((acc, variable) => {
        return {
          ...acc,
          [variable.state.name]: {
            text: variable.state.text,
            value: variable.state.value,
          },
        };
      }, {});
      // @ts-expect-error
      rowPanel.scopedVars = scopedVars;
    }
  }

  panelsArray.push(rowPanel);

  let panelsInsideRow: Panel[] = [];

  if (isSnapshot) {
    gridRow.state.children.forEach((c) => {
      if (c instanceof PanelRepeaterGridItem) {
        // Perform snapshot only for uncollapsed rows
        panelsInsideRow = panelsInsideRow.concat(panelRepeaterToPanels(c, !collapsed));
      } else {
        // Perform snapshot only for uncollapsed panels
        panelsInsideRow.push(gridItemToPanel(c, !collapsed));
      }
    });
  } else {
    panelsInsideRow = gridRow.state.children.map((c) => gridItemToPanel(c));
  }

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
    const singlePanel = dash.panels?.find((p) => p.id === getPanelIdForVizPanel(panel));
    if (singlePanel) {
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

function removeDefaults<T>(object: T, defaults: T): T {
  const newObj = { ...object };
  for (const key in defaults) {
    if (isEqual(newObj[key], defaults[key])) {
      delete newObj[key];
    }
  }

  return newObj;
}
