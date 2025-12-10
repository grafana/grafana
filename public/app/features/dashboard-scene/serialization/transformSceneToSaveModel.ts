import { defaults, isEqual } from 'lodash';

import { isEmptyObject, ScopedVars, TimeRange } from '@grafana/data';
import {
  behaviors,
  SceneGridItemLike,
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

import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
import { DashboardScene } from '../scene/DashboardScene';
import { AutoGridItem } from '../scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayoutManager } from '../scene/layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { RowRepeaterBehavior } from '../scene/layout-default/RowRepeaterBehavior';
import { RowItem } from '../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../scene/layout-rows/RowsLayoutManager';
import { TabItem } from '../scene/layout-tabs/TabItem';
import { TabsLayoutManager } from '../scene/layout-tabs/TabsLayoutManager';
import { PanelTimeRange } from '../scene/panel-timerange/PanelTimeRange';
import { DashboardLayoutManager } from '../scene/types/DashboardLayoutManager';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { djb2Hash } from '../utils/djb2Hash';
import {
  calculateGridItemDimensions,
  getLibraryPanelBehavior,
  getPanelIdForVizPanel,
  getQueryRunnerFor,
  isLibraryPanel,
} from '../utils/utils';

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
  let variables: VariableModel[] = [];

  if (body instanceof DefaultGridLayoutManager) {
    for (const child of body.state.grid.state.children) {
      if (child instanceof DashboardGridItem) {
        // handle panel repeater scenario
        if (child.state.variableName) {
          panels = panels.concat(panelRepeaterToPanels(child, isSnapshot));
        } else {
          panels.push(gridItemToPanel(child, isSnapshot));
        }
      }

      if (child instanceof SceneGridRow) {
        // Skip repeat clones or when generating a snapshot
        if (child.state.repeatSourceKey && !isSnapshot) {
          continue;
        }

        gridRowToSaveModel(child, panels, isSnapshot);
      }
    }
  } else if (body instanceof RowsLayoutManager) {
    // Handle RowsLayoutManager - convert to v1beta1 row panels
    // Track absolute Y position across all rows (v2 has relative Y, v1 needs absolute)
    let currentY = 0;
    for (const row of body.state.rows) {
      currentY = rowItemToSaveModel(row, panels, isSnapshot, currentY);
    }
  } else if (body instanceof TabsLayoutManager) {
    // Handle TabsLayoutManager - convert tabs to row panels
    // In V1, tabs become expanded row panels (collapsed: false)
    let currentY = 0;
    for (const tab of body.state.tabs) {
      currentY = tabItemToSaveModel(tab, panels, isSnapshot, currentY);
    }
  } else if (body instanceof AutoGridLayoutManager) {
    // Handle AutoGridLayoutManager - convert to panels with calculated positions
    panels = autoGridLayoutToPanels(body, isSnapshot);
  }

  let annotations: AnnotationQuery[] = [];

  if (data instanceof DashboardDataLayerSet) {
    annotations = dataLayersToAnnotations(data.state.annotationLayers);
  }

  if (variablesSet instanceof SceneVariableSet) {
    variables = sceneVariablesSetToVariables(variablesSet);
  }

  const controlsState = state.controls?.state;

  const refreshPicker = controlsState?.refreshPicker;

  const timePickerWithoutDefaults = removeDefaults<TimePickerConfig>(
    {
      refresh_intervals: refreshPicker?.state.intervals,
      hidden: controlsState?.hideTimeControls,
      nowDelay: timeRange.UNSAFE_nowDelay,
      quick_ranges: controlsState?.timePicker.state.quickRanges,
    },
    defaultTimePickerConfig
  );

  const graphTooltip =
    state.$behaviors?.find((b): b is behaviors.CursorSync => b instanceof behaviors.CursorSync)?.state.sync ??
    defaultDashboard.graphTooltip;
  const liveNow =
    state.$behaviors?.find((b): b is behaviors.LiveNowTimer => b instanceof behaviors.LiveNowTimer)?.isEnabled ||
    undefined;

  const dashboard: Dashboard = {
    ...defaultDashboard,
    title: state.title,
    description: state.description || undefined,
    uid: state.uid,
    id: state.id,
    editable: state.editable,
    preload: state.preload,
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
    fiscalYearStartMonth: timeRange.fiscalYearStartMonth,
    weekStart: timeRange.weekStart ?? '',
    tags: state.tags,
    links: state.links,
    graphTooltip,
    liveNow,
    schemaVersion: DASHBOARD_SCHEMA_VERSION,
    refresh: refreshPicker?.state.refresh,
    // @ts-expect-error not in dashboard schema because it's experimental
    scopeMeta: state.scopeMeta,
  };

  // Only add optional fields if they are explicitly set (not default values)
  if (timeRange.timeZone !== '') {
    dashboard.timezone = timeRange.timeZone;
  }

  return sortedDeepCloneWithoutNulls(dashboard, true);
}

export function gridItemToPanel(gridItem: DashboardGridItem, isSnapshot = false): Panel {
  let vizPanel: VizPanel | undefined;
  let x = 0,
    y = 0,
    w = 0,
    h = 0;

  let gridItem_ = gridItem;

  if (!(gridItem_.state.body instanceof VizPanel)) {
    throw new Error('DashboardGridItem body expected to be VizPanel');
  }

  vizPanel = gridItem_.state.body;
  x = gridItem_.state.x ?? 0;
  y = gridItem_.state.y ?? 0;
  w = gridItem_.state.width ?? 0;
  h = (gridItem_.state.variableName ? gridItem_.state.itemHeight : gridItem_.state.height) ?? 0;

  if (!vizPanel) {
    throw new Error('Unsupported grid item type');
  }

  const panel: Panel = vizPanelToPanel(vizPanel, { x, y, h, w }, isSnapshot, gridItem_);

  return panel;
}

export function vizPanelToPanel(
  vizPanel: VizPanel,
  gridPos?: GridPos,
  isSnapshot = false,
  gridItem?: SceneGridItemLike
) {
  let panel: Panel;

  if (isLibraryPanel(vizPanel)) {
    const libPanel = getLibraryPanelBehavior(vizPanel);

    panel = {
      id: getPanelIdForVizPanel(vizPanel),
      title: vizPanel.state.title,
      gridPos: gridPos,
      libraryPanel: {
        name: libPanel!.state.name,
        uid: libPanel!.state.uid,
      },
      type: 'library-panel-ref',
    };

    return panel;
  } else {
    panel = {
      id: getPanelIdForVizPanel(vizPanel),
      type: vizPanel.state.pluginId,
      title: vizPanel.state.title,
      description: vizPanel.state.description || undefined,
      gridPos,
      fieldConfig: (vizPanel.state.fieldConfig as FieldConfigSource) ?? { defaults: {}, overrides: [] },
      transformations: [],
      transparent: vizPanel.state.displayMode === 'transparent',
      pluginVersion: vizPanel.state.pluginVersion,
      ...vizPanelDataToPanel(vizPanel, isSnapshot),
    };
  }

  if (vizPanel.state.options) {
    const { angularOptions, ...rest } = vizPanel.state.options as any;
    panel.options = rest;

    if (angularOptions) {
      // Allow angularOptions to overwrite non system level root properties
      defaults(panel, angularOptions);
    }
  }

  const panelTime = vizPanel.state.$timeRange;

  if (panelTime instanceof PanelTimeRange) {
    panel.timeFrom = panelTime.state.timeFrom;
    panel.timeShift = panelTime.state.timeShift;
    panel.hideTimeOverride = panelTime.state.hideTimeOverride;
    panel.timeCompare = panelTime.state.compareWith;
  }

  if (gridItem instanceof DashboardGridItem) {
    if (gridItem.state.variableName) {
      panel.repeat = gridItem.state.variableName;
    }

    if (gridItem.state.maxPerRow) {
      panel.maxPerRow = gridItem.state.maxPerRow;
    }
    if (gridItem.state.repeatDirection) {
      panel.repeatDirection = gridItem.getRepeatDirection();
    }
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
    'datasource' | 'targets' | 'maxDataPoints' | 'transformations' | 'cacheTimeout' | 'queryCachingTTL' | 'interval'
  > = {};
  const queryRunner = getQueryRunnerFor(vizPanel);

  if (queryRunner) {
    // Clean up targets by removing hide: false (it's the default value)
    // This ensures consistency with Go backend which omits hide when false
    panel.targets = queryRunner.state.queries.map((query) => {
      if (query.hide === false) {
        const { hide, ...rest } = query;
        return rest;
      }
      return query;
    });
    panel.maxDataPoints = queryRunner.state.maxDataPoints;
    // Only set panel-level datasource if explicitly specified
    if (queryRunner.state.datasource) {
      panel.datasource = queryRunner.state.datasource;
    }

    if (queryRunner.state.cacheTimeout) {
      panel.cacheTimeout = queryRunner.state.cacheTimeout;
    }

    if (queryRunner.state.queryCachingTTL) {
      panel.queryCachingTTL = queryRunner.state.queryCachingTTL;
    }
    if (queryRunner.state.minInterval) {
      panel.interval = queryRunner.state.minInterval;
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

export function panelRepeaterToPanels(repeater: DashboardGridItem, isSnapshot = false): Panel[] {
  if (!isSnapshot) {
    return [gridItemToPanel(repeater)];
  } else {
    // return early if the repeated panel is a library panel
    if (repeater.state.body instanceof VizPanel && isLibraryPanel(repeater.state.body)) {
      const { x = 0, y = 0, width: w = 0, height: h = 0 } = repeater.state;
      return [vizPanelToPanel(repeater.state.body, { x, y, w, h }, isSnapshot)];
    }

    const vizPanels = [repeater.state.body, ...(repeater.state.repeatedPanels ?? [])];

    const { h, w, columnCount } = calculateGridItemDimensions(repeater);
    const panels = vizPanels.map((panel, index) => {
      let x = 0,
        y = 0;
      if (repeater.state.repeatDirection === 'v') {
        x = repeater.state.x!;
        y = repeater.state.y! + index * h;
      } else {
        x = (index % columnCount) * w;
        y = repeater.state.y! + Math.floor(index / columnCount) * h;
      }

      const gridPos = { x, y, w, h };

      const localVariable = panel.state.$variables!.getByName(repeater.state.variableName!) as LocalValueVariable;

      const result: Panel = {
        id: djb2Hash(panel.state.key!),
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
      if (c instanceof DashboardGridItem) {
        if (c.state.variableName) {
          // Perform snapshot only for uncollapsed rows
          panelsInsideRow = panelsInsideRow.concat(panelRepeaterToPanels(c, !collapsed));
        } else {
          // Perform snapshot only for uncollapsed panels
          panelsInsideRow.push(gridItemToPanel(c, !collapsed));
        }
      }
    });
  } else {
    panelsInsideRow = gridRow.state.children.map((c) => {
      if (!(c instanceof DashboardGridItem)) {
        throw new Error('Row child expected to be DashboardGridItem');
      }
      return gridItemToPanel(c);
    });
  }

  if (gridRow.state.isCollapsed) {
    rowPanel.panels = panelsInsideRow;
  } else {
    panelsArray.push(...panelsInsideRow);
  }
}

/**
 * Converts a RowItem from RowsLayoutManager to v1beta1 row panel format.
 * Handles Y position conversion from relative (v2) to absolute (v1) positions.
 * Also handles nested rows by flattening them.
 *
 * @param row - The RowItem to convert
 * @param panelsArray - The array to push panels to
 * @param isSnapshot - Whether this is a snapshot
 * @param currentY - The current absolute Y position in the dashboard
 * @returns The next Y position after this row's content
 */
export function rowItemToSaveModel(
  row: RowItem,
  panelsArray: Array<Panel | RowPanel>,
  isSnapshot = false,
  currentY = 0
): number {
  const collapsed = Boolean(row.state.collapse);
  const hideHeader = Boolean(row.state.hideHeader);
  const rowLayout = row.state.layout;

  // Calculate the max relative Y in this row's content to determine row height
  // For DefaultGridLayoutManager, we need to normalize the Y values first
  let maxRelativeY = getMaxYFromLayout(rowLayout);
  if (rowLayout instanceof DefaultGridLayoutManager) {
    // DefaultGridLayoutManager from V1 has absolute Y - normalize to relative
    const children = rowLayout.state.grid.state.children;
    const yValues = children
      .filter((c): c is DashboardGridItem => c instanceof DashboardGridItem)
      .map((c) => c.state.y ?? 0);
    if (yValues.length > 0) {
      const minY = Math.min(...yValues);
      maxRelativeY = maxRelativeY - minY;
    }
  }

  // If hideHeader is true, we don't create a row panel - just add the panels directly
  // Go backend: for hidden header rows, panels keep their relative Y positions
  // but currentY IS updated based on panel heights (so next row starts after this content)
  if (hideHeader) {
    if (rowLayout instanceof DefaultGridLayoutManager) {
      let localMaxY = 0;
      for (const child of rowLayout.state.grid.state.children) {
        if (child instanceof DashboardGridItem) {
          const panel = child.state.variableName
            ? panelRepeaterToPanels(child, isSnapshot)
            : [gridItemToPanel(child, isSnapshot)];

          // For hidden header rows with DefaultGridLayoutManager, panels keep their relative Y positions
          panelsArray.push(...panel);

          // Track the max Y extent
          const panelEndY = (child.state.y ?? 0) + (child.state.height ?? 0);
          if (panelEndY > localMaxY) {
            localMaxY = panelEndY;
          }
        }
      }
      // Update currentY based on content height
      return localMaxY;
    } else if (rowLayout instanceof RowsLayoutManager) {
      // Nested rows - flatten them
      let nestedY = currentY;
      for (const nestedRow of rowLayout.state.rows) {
        nestedY = rowItemToSaveModel(nestedRow, panelsArray, isSnapshot, nestedY);
      }
      return nestedY;
    } else if (rowLayout instanceof TabsLayoutManager) {
      // Nested tabs inside hidden header row - flatten them
      let nestedY = currentY;
      for (const tab of rowLayout.state.tabs) {
        nestedY = tabItemToSaveModel(tab, panelsArray, isSnapshot, nestedY);
      }
      return nestedY;
    } else if (rowLayout instanceof AutoGridLayoutManager) {
      // AutoGrid inside hidden header row - convert to panels WITH Y offset
      const autoGridPanels = autoGridLayoutToPanels(rowLayout, isSnapshot);
      // Add currentY offset to convert relative Y to absolute Y
      for (const panel of autoGridPanels) {
        if (panel.gridPos) {
          panel.gridPos.y = (panel.gridPos.y ?? 0) + currentY;
        }
      }
      panelsArray.push(...autoGridPanels);
      // Update currentY to account for the content height
      const layoutHeight = getMaxYFromLayout(rowLayout);
      return currentY + layoutHeight;
    }
    // Fallback for unknown layouts
    return currentY;
  }

  // Create the row panel with absolute Y position
  const rowPanel: RowPanel = {
    type: 'row',
    id: -1, // Will be assigned by dashboard model TODO: CHECK
    title: row.state.title ?? '',
    gridPos: {
      x: 0,
      y: currentY,
      w: 24,
      h: 1,
    },
    collapsed,
    panels: [],
  };

  // Handle row repeat variable
  if (row.state.repeatByVariable) {
    rowPanel.repeat = row.state.repeatByVariable;
  }

  panelsArray.push(rowPanel);

  // The base Y position for panels in this row
  // In Go backend: adjustedItem.Spec.Y = item.Spec.Y + currentRowY - 1
  // Since we increment currentY after setting row Y, panelBaseY = currentY
  // (i.e., panels start at the same Y as the row, not after it)
  const panelBaseY = currentY;

  // Extract panels from the row's layout
  let panelsInsideRow: Panel[] = [];

  if (rowLayout instanceof DefaultGridLayoutManager) {
    for (const child of rowLayout.state.grid.state.children) {
      if (child instanceof DashboardGridItem) {
        if (child.state.variableName) {
          panelsInsideRow = panelsInsideRow.concat(panelRepeaterToPanels(child, isSnapshot));
        } else {
          panelsInsideRow.push(gridItemToPanel(child, isSnapshot));
        }
      }
    }
  } else if (rowLayout instanceof RowsLayoutManager) {
    // Nested rows - flatten them and collect panels
    // For collapsed parent row, nested row panels should be stored inside
    // For expanded parent row, nested content goes to top level
    if (collapsed) {
      // Flatten nested rows into panelsInsideRow (keep relative Y positions)
      for (const nestedRow of rowLayout.state.rows) {
        flattenRowItemToPanels(nestedRow, panelsInsideRow, isSnapshot);
      }
    } else {
      // Process nested rows recursively with proper Y offset
      // Start at currentY + 1 (after the parent row panel which is at currentY with h=1)
      let nestedY = currentY + 1;
      for (const nestedRow of rowLayout.state.rows) {
        nestedY = rowItemToSaveModel(nestedRow, panelsArray, isSnapshot, nestedY);
      }
      return nestedY;
    }
  } else if (rowLayout instanceof TabsLayoutManager) {
    // Row contains TabsLayout - keep parent row, then process tabs
    // Go backend behavior: create parent row first, then flatten tabs as nested rows
    if (collapsed) {
      // Flatten tabs into panelsInsideRow (keep relative Y positions)
      for (const tab of rowLayout.state.tabs) {
        flattenTabItemToPanels(tab, panelsInsideRow, isSnapshot);
      }
    } else {
      // Process tabs recursively with proper Y offset (after the parent row)
      let nestedY = currentY + 1; // +1 for the parent row we already added
      for (const tab of rowLayout.state.tabs) {
        nestedY = tabItemToSaveModel(tab, panelsArray, isSnapshot, nestedY);
      }
      return nestedY;
    }
  } else if (rowLayout instanceof AutoGridLayoutManager) {
    // Row contains AutoGridLayout - convert to panels
    const autoGridPanels = autoGridLayoutToPanels(rowLayout, isSnapshot);
    if (collapsed) {
      panelsInsideRow = autoGridPanels;
    } else {
      // Adjust Y positions and add to panelsArray
      for (const panel of autoGridPanels) {
        if (panel.gridPos) {
          panel.gridPos.y = (panel.gridPos.y ?? 0) + panelBaseY;
        }
      }
      panelsArray.push(...autoGridPanels);
      // Return at least currentY + 1 (row panel height) even for empty grids
      const layoutHeight = getMaxYFromLayout(rowLayout);
      return panelBaseY + Math.max(layoutHeight, 1);
    }
  }

  // Panel Y position handling:
  // Always calculate absolute Y based on current row position.
  // For DefaultGridLayoutManager from V1, panels have old absolute Y that needs recalculation.
  // For AutoGridLayoutManager from V2, panels have relative Y starting from 0.
  // In both cases, we need to set Y = panelStartY + relativeY
  const panelStartY = currentY + 1; // Panels start after the row header (which is at currentY with h=1)

  // For DefaultGridLayoutManager, find the minimum Y to normalize to relative coordinates first
  let minY = 0;
  if (rowLayout instanceof DefaultGridLayoutManager) {
    const yValues = panelsInsideRow.map((p) => p.gridPos?.y ?? 0).filter((y) => y >= 0);
    if (yValues.length > 0) {
      minY = Math.min(...yValues);
    }
  }

  // Convert to absolute Y based on current row position
  for (const panel of panelsInsideRow) {
    if (panel.gridPos) {
      // For DefaultGridLayoutManager, subtract minY to get relative Y first, then add panelStartY
      // For other layouts (AutoGrid), Y is already relative (starting from 0)
      const relativeY =
        rowLayout instanceof DefaultGridLayoutManager ? (panel.gridPos.y ?? 0) - minY : (panel.gridPos.y ?? 0);
      panel.gridPos.y = relativeY + panelStartY;
    }
  }

  if (collapsed) {
    // For collapsed rows, store panels inside the row
    rowPanel.panels = panelsInsideRow;
  } else {
    // For expanded rows, add panels to top level
    panelsArray.push(...panelsInsideRow);
  }

  // Next row starts after all content in this row
  return panelStartY + maxRelativeY;
}

/**
 * Flattens a RowItem's panels into an array (for collapsed parent rows).
 * Keeps relative Y positions.
 */
function flattenRowItemToPanels(row: RowItem, panelsArray: Panel[], isSnapshot = false) {
  const rowLayout = row.state.layout;

  if (rowLayout instanceof DefaultGridLayoutManager) {
    for (const child of rowLayout.state.grid.state.children) {
      if (child instanceof DashboardGridItem) {
        if (child.state.variableName) {
          panelsArray.push(...panelRepeaterToPanels(child, isSnapshot));
        } else {
          panelsArray.push(gridItemToPanel(child, isSnapshot));
        }
      }
    }
  } else if (rowLayout instanceof RowsLayoutManager) {
    // Recursively flatten nested rows
    for (const nestedRow of rowLayout.state.rows) {
      flattenRowItemToPanels(nestedRow, panelsArray, isSnapshot);
    }
  } else if (rowLayout instanceof TabsLayoutManager) {
    // Recursively flatten nested tabs
    for (const tab of rowLayout.state.tabs) {
      flattenTabItemToPanels(tab, panelsArray, isSnapshot);
    }
  } else if (rowLayout instanceof AutoGridLayoutManager) {
    // Flatten AutoGrid panels
    const autoGridPanels = autoGridLayoutToPanels(rowLayout, isSnapshot);
    panelsArray.push(...autoGridPanels);
  }
}

/**
 * Converts a TabItem to v1beta1 row panel format.
 * Tabs become expanded row panels (collapsed: false) in V1.
 *
 * @param tab - The TabItem to convert
 * @param panelsArray - The array to push panels to
 * @param isSnapshot - Whether this is a snapshot
 * @param currentY - The current absolute Y position in the dashboard
 * @returns The next Y position after this tab's content
 */
export function tabItemToSaveModel(
  tab: TabItem,
  panelsArray: Array<Panel | RowPanel>,
  isSnapshot = false,
  currentY = 0
): number {
  const tabLayout = tab.state.layout;

  // Calculate the max relative Y in this tab's content
  const maxRelativeY = getMaxYFromLayout(tabLayout);

  // Create the row panel for this tab (tabs become expanded rows in V1)
  const rowPanel: RowPanel = {
    type: 'row',
    id: -1, // Will be assigned later
    title: tab.state.title ?? '',
    gridPos: {
      x: 0,
      y: currentY,
      w: 24,
      h: 1,
    },
    collapsed: false, // Tabs are always expanded when converted to rows
    panels: [],
  };

  panelsArray.push(rowPanel);

  // The base Y position for panels in this tab (after the row panel)
  const panelBaseY = currentY + 1;

  // Extract panels from the tab's layout
  let panelsInsideTab: Panel[] = [];

  if (tabLayout instanceof DefaultGridLayoutManager) {
    for (const child of tabLayout.state.grid.state.children) {
      if (child instanceof DashboardGridItem) {
        if (child.state.variableName) {
          panelsInsideTab = panelsInsideTab.concat(panelRepeaterToPanels(child, isSnapshot));
        } else {
          panelsInsideTab.push(gridItemToPanel(child, isSnapshot));
        }
      }
    }
  } else if (tabLayout instanceof RowsLayoutManager) {
    // Tab contains RowsLayout - process nested rows
    let nestedY = panelBaseY;
    for (const nestedRow of tabLayout.state.rows) {
      nestedY = rowItemToSaveModel(nestedRow, panelsArray, isSnapshot, nestedY);
    }
    return nestedY;
  } else if (tabLayout instanceof TabsLayoutManager) {
    // Tab contains TabsLayout - flatten nested tabs
    let nestedY = panelBaseY;
    for (const nestedTab of tabLayout.state.tabs) {
      nestedY = tabItemToSaveModel(nestedTab, panelsArray, isSnapshot, nestedY);
    }
    return nestedY;
  } else if (tabLayout instanceof AutoGridLayoutManager) {
    // Tab contains AutoGridLayout - convert to panels with Y offset
    panelsInsideTab = autoGridLayoutToPanels(tabLayout, isSnapshot);
  }

  // Convert relative Y to absolute Y for expanded tab panels
  for (const panel of panelsInsideTab) {
    if (panel.gridPos) {
      panel.gridPos.y = (panel.gridPos.y ?? 0) + panelBaseY;
    }
  }
  panelsArray.push(...panelsInsideTab);

  // Next row starts after all content in this tab
  return panelBaseY + maxRelativeY;
}

/**
 * Flattens a TabItem's panels into an array (for collapsed parent rows).
 * Keeps relative Y positions.
 */
function flattenTabItemToPanels(tab: TabItem, panelsArray: Panel[], isSnapshot = false) {
  const tabLayout = tab.state.layout;

  if (tabLayout instanceof DefaultGridLayoutManager) {
    for (const child of tabLayout.state.grid.state.children) {
      if (child instanceof DashboardGridItem) {
        if (child.state.variableName) {
          panelsArray.push(...panelRepeaterToPanels(child, isSnapshot));
        } else {
          panelsArray.push(gridItemToPanel(child, isSnapshot));
        }
      }
    }
  } else if (tabLayout instanceof RowsLayoutManager) {
    // Recursively flatten nested rows
    for (const nestedRow of tabLayout.state.rows) {
      flattenRowItemToPanels(nestedRow, panelsArray, isSnapshot);
    }
  } else if (tabLayout instanceof TabsLayoutManager) {
    // Recursively flatten nested tabs
    for (const nestedTab of tabLayout.state.tabs) {
      flattenTabItemToPanels(nestedTab, panelsArray, isSnapshot);
    }
  } else if (tabLayout instanceof AutoGridLayoutManager) {
    // Flatten AutoGrid panels
    const autoGridPanels = autoGridLayoutToPanels(tabLayout, isSnapshot);
    panelsArray.push(...autoGridPanels);
  }
}

/**
 * Converts an AutoGridLayoutManager to V1 panels with calculated grid positions.
 * Uses the AutoGrid's settings to calculate panel dimensions.
 */
function autoGridLayoutToPanels(layout: AutoGridLayoutManager, isSnapshot = false): Panel[] {
  const panels: Panel[] = [];

  const gridWidth = 24;
  const maxColumnCount = layout.state.maxColumnCount ?? 3;
  const panelWidth = Math.floor(gridWidth / maxColumnCount);

  // Calculate panel height based on rowHeight setting
  let panelHeight = 9; // default: standard
  const rowHeight = layout.state.rowHeight;
  if (typeof rowHeight === 'number') {
    // Custom height in pixels - convert to grid units
    // Each grid unit is approximately 30px + 8px margin
    panelHeight = Math.ceil(rowHeight / 38);
  } else {
    switch (rowHeight) {
      case 'short':
        panelHeight = 5;
        break;
      case 'standard':
        panelHeight = 9;
        break;
      case 'tall':
        panelHeight = 14;
        break;
    }
  }

  let currentX = 0;
  let currentY = 0;

  for (const item of layout.state.layout.state.children) {
    if (item instanceof AutoGridItem) {
      const vizPanel = item.state.body;
      const panel = vizPanelToPanel(
        vizPanel,
        {
          x: currentX,
          y: currentY,
          w: panelWidth,
          h: panelHeight,
        },
        isSnapshot
      );
      panels.push(panel);

      // Move to next position
      currentX += panelWidth;
      if (currentX >= gridWidth) {
        currentX = 0;
        currentY += panelHeight;
      }
    }
  }

  return panels;
}

/**
 * Gets the maximum Y extent from a layout (relative to the layout's origin).
 */
function getMaxYFromLayout(layout: DashboardLayoutManager): number {
  if (layout instanceof DefaultGridLayoutManager) {
    let maxY = 0;
    for (const child of layout.state.grid.state.children) {
      if (child instanceof DashboardGridItem) {
        const y = child.state.y ?? 0;
        const h = child.state.height ?? 0;
        maxY = Math.max(maxY, y + h);
      }
    }
    return maxY;
  } else if (layout instanceof RowsLayoutManager) {
    let totalY = 0;
    for (const row of layout.state.rows) {
      totalY += getMaxYFromLayout(row.state.layout);
      if (!row.state.hideHeader) {
        totalY += 1; // Row header takes 1 unit
      }
    }
    return totalY;
  } else if (layout instanceof TabsLayoutManager) {
    let totalY = 0;
    for (const tab of layout.state.tabs) {
      totalY += getMaxYFromLayout(tab.state.layout);
      totalY += 1; // Tab row header takes 1 unit
    }
    return totalY;
  } else if (layout instanceof AutoGridLayoutManager) {
    // Calculate height based on number of items and row height
    const itemCount = layout.state.layout.state.children.length;
    const maxColumnCount = layout.state.maxColumnCount ?? 3;
    const rowCount = Math.ceil(itemCount / maxColumnCount);

    let panelHeight = 9; // default: standard
    const rowHeight = layout.state.rowHeight;
    if (typeof rowHeight === 'number') {
      panelHeight = Math.ceil(rowHeight / 38);
    } else {
      switch (rowHeight) {
        case 'short':
          panelHeight = 5;
          break;
        case 'standard':
          panelHeight = 9;
          break;
        case 'tall':
          panelHeight = 14;
          break;
      }
    }

    return rowCount * panelHeight;
  }
  return 0;
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
