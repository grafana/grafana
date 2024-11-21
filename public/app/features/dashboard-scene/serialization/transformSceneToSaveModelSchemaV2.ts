import { behaviors, SceneDataQuery, SceneDataTransformer, SceneVariableSet, VizPanel } from '@grafana/scenes';
import {
  DashboardV2Spec,
  defaultDashboardV2Spec,
  defaultFieldConfigSource,
  PanelKind,
  PanelQueryKind,
  TransformationKind,
  FieldConfigSource,
  DashboardLink,
  DashboardCursorSync,
  DataTransformerConfig,
  PanelQuerySpec,
  DataQueryKind,
  defaultDataSourceRef,
  GridLayoutItemKind,
  QueryOptionsSpec,
  QueryVariableKind,
  TextVariableKind,
  IntervalVariableKind,
  DatasourceVariableKind,
  CustomVariableKind,
  ConstantVariableKind,
  GroupByVariableKind,
  AdhocVariableKind,
} from '@grafana/schema/src/schema/dashboard/v2alpha0/dashboard.gen';
import { DASHBOARD_SCHEMA_VERSION } from 'app/features/dashboard/state/DashboardMigrator';

import { DashboardScene, DashboardSceneState } from '../scene/DashboardScene';
import { PanelTimeRange } from '../scene/PanelTimeRange';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { getQueryRunnerFor } from '../utils/utils';

import { sceneVariablesSetToSchemaV2Variables } from './sceneVariablesSetToVariables';
import { transformDashboardLinksToEnums, transformCursorSynctoEnum } from './transformToV2TypesUtils';

// FIXME: This is temporary to avoid creating partial types for all the new schema, it has some performance implications, but it's fine for now
type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

export function transformSceneToSaveModelSchemaV2(scene: DashboardScene, isSnapshot = false): Partial<DashboardV2Spec> {
  const oldDash = scene.state;
  const timeRange = oldDash.$timeRange!.state;

  const controlsState = oldDash.controls?.state;
  const refreshPicker = controlsState?.refreshPicker;

  const dashboardSchemaV2: DeepPartial<DashboardV2Spec> = {
    //dashboard settings
    title: oldDash.title,
    description: oldDash.description ?? '',
    cursorSync: getCursorSync(oldDash),
    liveNow: getLiveNow(oldDash),
    preload: oldDash.preload,
    editable: oldDash.editable,
    links: transformDashboardLinksToEnums(oldDash.links),
    tags: oldDash.tags,
    schemaVersion: DASHBOARD_SCHEMA_VERSION,
    // EOF dashboard settings

    // time settings
    timeSettings: {
      timezone: timeRange.timeZone,
      from: timeRange.from,
      to: timeRange.to,
      autoRefresh: refreshPicker?.state.refresh || '',
      autoRefreshIntervals: refreshPicker?.state.intervals,
      quickRanges: [], //FIXME is coming timepicker.time_options,
      hideTimepicker: controlsState?.hideTimeControls ?? false,
      weekStart: timeRange.weekStart,
      fiscalYearStartMonth: timeRange.fiscalYearStartMonth,
      nowDelay: timeRange.UNSAFE_nowDelay,
    },
    // EOF time settings

    // variables
    variables: getVariables(oldDash),
    // EOF variables

    // elements
    elements: getElements(oldDash),
    // EOF elements

    // annotations
    annotations: [], //FIXME
    // EOF annotations

    // layout
    layout: {
      kind: 'GridLayout',
      spec: {
        items: getGridLayoutItems(oldDash),
      },
    },
    // EOF layout
  };

  if (isDashboardSchemaV2(dashboardSchemaV2)) {
    return dashboardSchemaV2;
  }
  console.error('Error transforming dashboard to schema v2');
  throw new Error('Error transforming dashboard to schema v2');
}

function getCursorSync(state: DashboardSceneState) {
  const cursorSync = state.$behaviors?.find((b): b is behaviors.CursorSync => b instanceof behaviors.CursorSync)?.state
    .sync;

  return transformCursorSynctoEnum(cursorSync);
}

function getLiveNow(state: DashboardSceneState) {
  const liveNow =
    state.$behaviors?.find((b): b is behaviors.LiveNowTimer => b instanceof behaviors.LiveNowTimer)?.isEnabled ||
    undefined;
  // hack for validator
  if (liveNow === undefined) {
    return Boolean(defaultDashboardV2Spec().liveNow);
  }
  return Boolean(liveNow);
}

function getGridLayoutItems(state: DashboardSceneState, isSnapshot?: boolean): GridLayoutItemKind[] {
  const body = state.body;
  const elements: GridLayoutItemKind[] = [];
  if (body instanceof DefaultGridLayoutManager) {
    for (const child of body.state.grid.state.children) {
      if (child instanceof DashboardGridItem) {
        // TODO: handle panel repeater scenario
        // if (child.state.variableName) {
        //   panels = panels.concat(panelRepeaterToPanels(child, isSnapshot));
        // } else {
        elements.push(gridItemToGridLayoutItemKind(child, isSnapshot));
        // }
      }

      // TODO: OLD transformer code
      // if (child instanceof SceneGridRow) {
      //   // Skip repeat clones or when generating a snapshot
      //   if (child.state.key!.indexOf('-clone-') > 0 && !isSnapshot) {
      //     continue;
      //   }
      //   gridRowToSaveModel(child, panels, isSnapshot);
      // }
    }
  }
  return elements;
}

export function gridItemToGridLayoutItemKind(gridItem: DashboardGridItem, isSnapshot = false): GridLayoutItemKind {
  let elementGridItem: GridLayoutItemKind | undefined;
  let x = 0,
    y = 0,
    width = 0,
    height = 0;

  let gridItem_ = gridItem;

  if (!(gridItem_.state.body instanceof VizPanel)) {
    throw new Error('DashboardGridItem body expected to be VizPanel');
  }

  // Get the grid position and size
  height = (gridItem_.state.variableName ? gridItem_.state.itemHeight : gridItem_.state.height) ?? 0;
  x = gridItem_.state.x ?? 0;
  y = gridItem_.state.y ?? 0;
  width = gridItem_.state.width ?? 0;

  // FIXME: which name should we use for the element reference, key or something else ?
  const elementName = gridItem_.state.body.state.key ?? 'DefaultName';
  elementGridItem = {
    kind: 'GridLayoutItem',
    spec: {
      x,
      y,
      width: width,
      height: height,
      element: {
        kind: 'ElementReference',
        name: elementName,
      },
    },
  };

  if (!elementGridItem) {
    throw new Error('Unsupported grid item type');
  }

  return elementGridItem;
}

function getElements(state: DashboardSceneState) {
  const panels = state.body.getVizPanels() ?? [];

  const panelsArray = panels.map((vizPanel: VizPanel) => {
    const vizFieldConfig: FieldConfigSource = {
      ...vizPanel.state.fieldConfig,
      defaults: {
        ...vizPanel.state.fieldConfig,
        decimals: vizPanel.state.fieldConfig.defaults.decimals ?? undefined,
      },
    };

    const elementSpec: PanelKind = {
      kind: 'Panel',
      spec: {
        uid: vizPanel.state.key ?? '', // FIXME: why is key optional?
        title: vizPanel.state.title,
        description: vizPanel.state.description ?? '',
        links: getPanelLinks(vizPanel),
        data: {
          kind: 'QueryGroup',
          spec: {
            queries: getVizPanelQueries(vizPanel),
            transformations: getVizPanelTransformations(vizPanel),
            queryOptions: getVizPanelQueryOptions(vizPanel),
          },
        },
        vizConfig: {
          kind: vizPanel.state.pluginId,
          spec: {
            pluginVersion: vizPanel.state.pluginVersion ?? '',
            options: vizPanel.state.options,
            fieldConfig: vizFieldConfig ?? defaultFieldConfigSource(),
          },
        },
      },
    };

    return elementSpec;
  });

  // create elements

  const elements = createElements(panelsArray);
  return elements;
}

function getPanelLinks(panel: VizPanel): DashboardLink[] {
  const vizLinks = dashboardSceneGraph.getPanelLinks(panel)?.state?.rawLinks ?? [];

  return vizLinks.map((link) => {
    const dashLink: DashboardLink = {
      title: link.title,
      targetBlank: link.targetBlank ?? false, // TODO: should this default to false?
      url: link.url,

      // TODO: the following properties are required on DashboardLink, but not present in DataLink
      // Does the DashboardLink schema need correcting?
      type: link.type,
      icon: link.icon,
      tooltip: link.tooltip,
      tags: link.tags,
      asDropdown: link.asDropdown,
      includeVars: link.includeVars,
      keepTime: link.keepTime,
    };

    return dashLink;
  });
}

function getVizPanelQueries(vizPanel: VizPanel): PanelQueryKind[] {
  const queries: PanelQueryKind[] = [];
  const queryRunner = getQueryRunnerFor(vizPanel);
  const vizPanelQueries = queryRunner?.state.queries;
  const datasource = queryRunner?.state.datasource;

  if (vizPanelQueries) {
    vizPanelQueries.forEach((query) => {
      const dataQuery: DataQueryKind = {
        kind: getDataQueryKind(query),
        spec: query,
      };
      const querySpec: PanelQuerySpec = {
        datasource: datasource ?? defaultDataSourceRef(),
        query: dataQuery,
        refId: query.refId,
        hidden: query.hidden,
      };
      queries.push({
        kind: 'PanelQuery',
        spec: querySpec,
      });
    });
  }
  return queries;
}

export function getDataQueryKind(query: SceneDataQuery): string {
  // If the query has a datasource, use the datasource type, otherwise use 'default'
  return query.datasource?.type ?? 'default';
}

// FIXME: not ideal to type this so loosely - What should a dataQuerySpec actually be?
export function getDataQuerySpec(query: SceneDataQuery): Record<string, unknown> {
  const dataQuerySpec = {
    kind: getDataQueryKind(query),
    spec: query,
  };
  return dataQuerySpec;
}

function getVizPanelTransformations(vizPanel: VizPanel): TransformationKind[] {
  let transformations: TransformationKind[] = [];
  const dataProvider = vizPanel.state.$data;

  if (dataProvider instanceof SceneDataTransformer) {
    const transformationList = dataProvider.state.transformations;

    if (transformationList.length === 0) {
      return [];
    }

    for (const transformationItem of transformationList) {
      const transformation = transformationItem;

      if ('id' in transformation) {
        //        ^?
        // Transformation is a DataTransformerConfig
        const transformationSpec: DataTransformerConfig = {
          id: transformation.id,
          disabled: transformation.disabled,
          filter: {
            id: transformation.filter?.id ?? '',
            options: transformation.filter?.options ?? {},
          },
          topic: transformation.topic,
          options: transformation.options,
        };

        transformations.push({
          kind: transformation.id,
          spec: transformationSpec,
        });
      } else {
        // TODO: It's a CustomTransformerDefinition - what do?
      }
    }
  }
  return transformations;
}

function getVizPanelQueryOptions(vizPanel: VizPanel): QueryOptionsSpec {
  let queryOptions: QueryOptionsSpec = {};
  const queryRunner = getQueryRunnerFor(vizPanel);

  if (queryRunner) {
    queryOptions.maxDataPoints = queryRunner.state.maxDataPoints;

    if (queryRunner.state.cacheTimeout) {
      queryOptions.cacheTimeout = queryRunner.state.cacheTimeout;
    }

    if (queryRunner.state.queryCachingTTL) {
      queryOptions.queryCachingTTL = queryRunner.state.queryCachingTTL;
    }
    if (queryRunner.state.minInterval) {
      queryOptions.interval = queryRunner.state.minInterval;
    }
  }

  const panelTime = vizPanel.state.$timeRange;

  if (panelTime instanceof PanelTimeRange) {
    queryOptions.timeFrom = panelTime.state.timeFrom;
    queryOptions.timeShift = panelTime.state.timeShift;
  }
  return queryOptions;
}

function createElements(panels: PanelKind[]): Record<string, PanelKind> {
  const elements: Record<string, PanelKind> = {};

  for (const panel of panels) {
    const key = panel.spec.uid;
    elements[key] = panel;
  }

  return elements;
}

function getVariables(oldDash: DashboardSceneState) {
  const variablesSet = oldDash.$variables;

  // variables is an array of all variables kind (union)
  let variables: Array<
    | QueryVariableKind
    | TextVariableKind
    | IntervalVariableKind
    | DatasourceVariableKind
    | CustomVariableKind
    | ConstantVariableKind
    | GroupByVariableKind
    | AdhocVariableKind
  > = [];

  if (variablesSet instanceof SceneVariableSet) {
    variables = sceneVariablesSetToSchemaV2Variables(variablesSet);
  }

  return variables;
}

// Function to know if the dashboard transformed is a valid DashboardV2Spec
function isDashboardSchemaV2(dash: unknown): dash is DashboardV2Spec {
  if (typeof dash !== 'object' || dash === null) {
    return false;
  }

  if (!('title' in dash) || typeof dash.title !== 'string') {
    return false;
  }
  if (!('description' in dash) || typeof dash.description !== 'string') {
    return false;
  }
  if (!('cursorSync' in dash) || typeof dash.cursorSync !== 'string') {
    return false;
  }

  const validCursorSyncValues: string[] = Object.values(DashboardCursorSync);
  if (
    !('cursorSync' in dash) ||
    typeof dash.cursorSync !== 'string' ||
    !validCursorSyncValues.includes(dash.cursorSync)
  ) {
    return false;
  }
  if (!('liveNow' in dash) || typeof dash.liveNow !== 'boolean') {
    return false;
  }
  if (!('preload' in dash) || typeof dash.preload !== 'boolean') {
    return false;
  }
  if (!('editable' in dash) || typeof dash.editable !== 'boolean') {
    return false;
  }
  if (!('links' in dash) || !Array.isArray(dash.links)) {
    return false;
  }
  if (!('tags' in dash) || !Array.isArray(dash.tags)) {
    return false;
  }
  if (!('id' in dash) || typeof dash.id !== 'number') {
    return false;
  }

  // Time settings
  if (!('timeSettings' in dash) || typeof dash.timeSettings !== 'object' || dash.timeSettings === null) {
    return false;
  }
  if (!('timezone' in dash.timeSettings) || typeof dash.timeSettings.timezone !== 'string') {
    return false;
  }
  if (!('from' in dash.timeSettings) || typeof dash.timeSettings.from !== 'string') {
    return false;
  }
  if (!('to' in dash.timeSettings) || typeof dash.timeSettings.to !== 'string') {
    return false;
  }
  if (!('autoRefresh' in dash.timeSettings) || typeof dash.timeSettings.autoRefresh !== 'string') {
    return false;
  }
  if (!('autoRefreshIntervals' in dash.timeSettings) || !Array.isArray(dash.timeSettings.autoRefreshIntervals)) {
    return false;
  }
  if (!('quickRanges' in dash.timeSettings) || !Array.isArray(dash.timeSettings.quickRanges)) {
    return false;
  }
  if (!('hideTimepicker' in dash.timeSettings) || typeof dash.timeSettings.hideTimepicker !== 'boolean') {
    return false;
  }
  if (!('weekStart' in dash.timeSettings) || typeof dash.timeSettings.weekStart !== 'string') {
    return false;
  }
  if (!('fiscalYearStartMonth' in dash.timeSettings) || typeof dash.timeSettings.fiscalYearStartMonth !== 'number') {
    return false;
  }

  if (
    !('nowDelay' in dash.timeSettings) ||
    (dash.timeSettings.nowDelay !== undefined && typeof dash.timeSettings.nowDelay !== 'string')
  ) {
    return false;
  }

  // Other sections
  if (!('variables' in dash) || !Array.isArray(dash.variables)) {
    return false;
  }
  if (!('elements' in dash) || typeof dash.elements !== 'object' || dash.elements === null) {
    return false;
  }
  if (!('annotations' in dash) || !Array.isArray(dash.annotations)) {
    return false;
  }

  // Layout
  if (!('layout' in dash) || typeof dash.layout !== 'object' || dash.layout === null) {
    return false;
  }
  if (!('kind' in dash.layout) || dash.layout.kind !== 'GridLayout') {
    return false;
  }
  if (!('spec' in dash.layout) || typeof dash.layout.spec !== 'object' || dash.layout.spec === null) {
    return false;
  }
  if (!('items' in dash.layout.spec) || !Array.isArray(dash.layout.spec.items)) {
    return false;
  }

  return true;
}
