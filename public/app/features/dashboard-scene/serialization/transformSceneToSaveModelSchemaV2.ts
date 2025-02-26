import { omit } from 'lodash';

import { AnnotationQuery } from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  behaviors,
  dataLayers,
  SceneDataQuery,
  SceneDataTransformer,
  SceneVariableSet,
  VizPanel,
} from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';
import { sortedDeepCloneWithoutNulls } from 'app/core/utils/object';

import {
  DashboardV2Spec,
  defaultDashboardV2Spec,
  defaultFieldConfigSource,
  PanelKind,
  PanelQueryKind,
  TransformationKind,
  FieldConfigSource,
  DataTransformerConfig,
  PanelQuerySpec,
  DataQueryKind,
  QueryOptionsSpec,
  QueryVariableKind,
  TextVariableKind,
  IntervalVariableKind,
  DatasourceVariableKind,
  CustomVariableKind,
  ConstantVariableKind,
  GroupByVariableKind,
  AdhocVariableKind,
  AnnotationQueryKind,
  DataLink,
  LibraryPanelKind,
  Element,
  DashboardCursorSync,
  FieldConfig,
  FieldColor,
} from '../../../../../packages/grafana-schema/src/schema/dashboard/v2alpha0';
import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
import { DashboardScene, DashboardSceneState } from '../scene/DashboardScene';
import { PanelTimeRange } from '../scene/PanelTimeRange';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import {
  getLibraryPanelBehavior,
  getPanelIdForVizPanel,
  getQueryRunnerFor,
  getVizPanelKeyForPanelId,
  isLibraryPanel,
} from '../utils/utils';

import { getLayout } from './layoutSerializers/utils';
import { sceneVariablesSetToSchemaV2Variables } from './sceneVariablesSetToVariables';
import { colorIdEnumToColorIdV2, transformCursorSynctoEnum } from './transformToV2TypesUtils';

// FIXME: This is temporary to avoid creating partial types for all the new schema, it has some performance implications, but it's fine for now
type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

export function transformSceneToSaveModelSchemaV2(scene: DashboardScene, isSnapshot = false): DashboardV2Spec {
  const sceneDash = scene.state;
  const timeRange = sceneDash.$timeRange!.state;

  const controlsState = sceneDash.controls?.state;
  const refreshPicker = controlsState?.refreshPicker;

  const dashboardSchemaV2: DeepPartial<DashboardV2Spec> = {
    //dashboard settings
    title: sceneDash.title,
    description: sceneDash.description,
    cursorSync: getCursorSync(sceneDash),
    liveNow: getLiveNow(sceneDash),
    preload: sceneDash.preload,
    editable: sceneDash.editable,
    links: sceneDash.links,
    tags: sceneDash.tags,
    // EOF dashboard settings

    // time settings
    timeSettings: {
      timezone: timeRange.timeZone,
      from: timeRange.from,
      to: timeRange.to,
      autoRefresh: refreshPicker?.state.refresh || '',
      autoRefreshIntervals: refreshPicker?.state.intervals,
      hideTimepicker: controlsState?.hideTimeControls ?? false,
      weekStart: timeRange.weekStart,
      fiscalYearStartMonth: timeRange.fiscalYearStartMonth,
      nowDelay: timeRange.UNSAFE_nowDelay,
    },
    // EOF time settings

    // variables
    variables: getVariables(sceneDash),
    // EOF variables

    // elements
    elements: getElements(sceneDash),
    // EOF elements

    // annotations
    annotations: getAnnotations(sceneDash),
    // EOF annotations

    // layout
    layout: getLayout(sceneDash.body),
    // EOF layout
  };

  try {
    // validateDashboardSchemaV2 will throw an error if the dashboard is not valid
    if (validateDashboardSchemaV2(dashboardSchemaV2)) {
      return sortedDeepCloneWithoutNulls(dashboardSchemaV2);
    }
    // should never reach this point, validation should throw an error
    throw new Error('Error we could transform the dashboard to schema v2: ' + dashboardSchemaV2);
  } catch (reason) {
    console.error('Error transforming dashboard to schema v2: ' + reason, dashboardSchemaV2);
    throw new Error('Error transforming dashboard to schema v2: ' + reason);
  }
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

function getElements(state: DashboardSceneState) {
  const panels = state.body.getVizPanels() ?? [];

  const panelsArray = panels.map((vizPanel: VizPanel) => {
    if (isLibraryPanel(vizPanel)) {
      const behavior = getLibraryPanelBehavior(vizPanel)!;
      const elementSpec: LibraryPanelKind = {
        kind: 'LibraryPanel',
        spec: {
          id: getPanelIdForVizPanel(vizPanel),
          title: vizPanel.state.title,
          libraryPanel: {
            uid: behavior.state.uid,
            name: behavior.state.name,
          },
        },
      };
      return elementSpec;
    } else {
      // Handle type conversion for color mode
      const rawColor = vizPanel.state.fieldConfig.defaults.color;
      let color: FieldColor | undefined;

      if (rawColor) {
        const convertedMode = colorIdEnumToColorIdV2(rawColor.mode);

        if (convertedMode) {
          color = {
            ...rawColor,
            mode: convertedMode,
          };
        }
      }

      // Remove null from the defaults because schema V2 doesn't support null for these fields
      const decimals = vizPanel.state.fieldConfig.defaults.decimals ?? undefined;
      const min = vizPanel.state.fieldConfig.defaults.min ?? undefined;
      const max = vizPanel.state.fieldConfig.defaults.max ?? undefined;

      const defaults: FieldConfig = Object.fromEntries(
        Object.entries({
          ...vizPanel.state.fieldConfig.defaults,
          decimals,
          min,
          max,
          color,
        }).filter(([_, value]) => value !== undefined)
      );

      const vizFieldConfig: FieldConfigSource = {
        ...vizPanel.state.fieldConfig,
        defaults,
      };

      const elementSpec: PanelKind = {
        kind: 'Panel',
        spec: {
          id: getPanelIdForVizPanel(vizPanel),
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
    }
  });
  return createElements(panelsArray);
}

function getPanelLinks(panel: VizPanel): DataLink[] {
  const vizLinks = dashboardSceneGraph.getPanelLinks(panel);
  if (vizLinks) {
    return vizLinks.state.rawLinks ?? [];
  }
  return [];
}

function getVizPanelQueries(vizPanel: VizPanel): PanelQueryKind[] {
  const queries: PanelQueryKind[] = [];
  const queryRunner = getQueryRunnerFor(vizPanel);
  const vizPanelQueries = queryRunner?.state.queries;
  const datasource = queryRunner?.state.datasource ?? getDefaultDataSourceRef();

  if (vizPanelQueries) {
    vizPanelQueries.forEach((query) => {
      const dataQuery: DataQueryKind = {
        kind: getDataQueryKind(query),
        spec: omit(query, 'datasource', 'refId', 'hide'),
      };
      const querySpec: PanelQuerySpec = {
        datasource: query.datasource ?? datasource,
        query: dataQuery,
        refId: query.refId,
        hidden: Boolean(query.hide),
      };
      queries.push({
        kind: 'PanelQuery',
        spec: querySpec,
      });
    });
  }
  return queries;
}

export function getDataQueryKind(query: SceneDataQuery | string): string {
  if (typeof query === 'string') {
    return getDefaultDataSourceRef()?.type ?? '';
  }

  return query.datasource?.type ?? getDefaultDataSourceRef()?.type ?? '';
}

export function getDataQuerySpec(query: SceneDataQuery): DataQueryKind['spec'] {
  return query;
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
        // Transformation is a DataTransformerConfig
        const transformationSpec: DataTransformerConfig = {
          id: transformation.id,
          disabled: transformation.disabled,
          filter: {
            id: transformation.filter?.id ?? '',
            options: transformation.filter?.options ?? {},
          },
          ...(transformation.topic && { topic: transformation.topic }),
          options: transformation.options,
        };

        transformations.push({
          kind: transformation.id,
          spec: transformationSpec,
        });
      } else {
        throw new Error('Unsupported transformation type');
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
    queryOptions.hideTimeOverride = panelTime.state.hideTimeOverride;
  }
  return queryOptions;
}

function createElements(panels: Element[]): Record<string, Element> {
  return panels.reduce<Record<string, Element>>((elements, panel) => {
    elements[getVizPanelKeyForPanelId(panel.spec.id)] = panel;
    return elements;
  }, {});
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

function getAnnotations(state: DashboardSceneState): AnnotationQueryKind[] {
  const data = state.$data;
  if (!(data instanceof DashboardDataLayerSet)) {
    return [];
  }
  const annotations: AnnotationQueryKind[] = [];
  for (const layer of data.state.annotationLayers) {
    if (!(layer instanceof dataLayers.AnnotationsDataLayer)) {
      continue;
    }
    const result: AnnotationQueryKind = {
      kind: 'AnnotationQuery',
      spec: {
        builtIn: Boolean(layer.state.query.builtIn),
        name: layer.state.query.name,
        datasource: layer.state.query.datasource || getDefaultDataSourceRef(),
        enable: Boolean(layer.state.isEnabled),
        hide: Boolean(layer.state.isHidden),
        iconColor: layer.state.query.iconColor,
      },
    };

    // Check if DataQueryKind exists
    const queryKind = getAnnotationQueryKind(layer.state.query);
    if (layer.state.query.query?.kind === queryKind) {
      result.spec.query = {
        kind: queryKind,
        spec: layer.state.query.query.spec,
      };
    }

    // If filter is an empty array, don't save it
    if (layer.state.query.filter?.ids?.length) {
      result.spec.filter = layer.state.query.filter;
    }

    annotations.push(result);
  }
  return annotations;
}

export function getAnnotationQueryKind(annotationQuery: AnnotationQuery): string {
  if (annotationQuery.datasource?.type) {
    return annotationQuery.datasource.type;
  } else {
    const ds = getDefaultDataSourceRef();
    if (ds) {
      return ds.type!; // in the datasource list from bootData "id" is the type
    }
    // if we can't find the default datasource, return grafana as default
    return 'grafana';
  }
}

export function getDefaultDataSourceRef(): DataSourceRef {
  // we need to return the default datasource configured in the BootConfig
  const defaultDatasource = config.bootData.settings.defaultDatasource;

  // get default datasource type
  const dsList = config.bootData.settings.datasources;
  const ds = dsList[defaultDatasource];

  return { type: ds.meta.id, uid: ds.name }; // in the datasource list from bootData "id" is the type
}

// Function to know if the dashboard transformed is a valid DashboardV2Spec
function validateDashboardSchemaV2(dash: unknown): dash is DashboardV2Spec {
  if (typeof dash !== 'object' || dash === null) {
    throw new Error('Dashboard is not an object or is null');
  }

  if ('title' in dash && typeof dash.title !== 'string') {
    throw new Error('Title is not a string');
  }
  if ('description' in dash && dash.description !== undefined && typeof dash.description !== 'string') {
    throw new Error('Description is not a string');
  }
  if ('cursorSync' in dash && typeof dash.cursorSync !== 'string') {
    const validCursorSyncValues = ((): string[] => {
      const typeValues: DashboardCursorSync[] = ['Off', 'Crosshair', 'Tooltip'];
      return typeValues;
    })();

    if (
      'cursorSync' in dash &&
      (typeof dash.cursorSync !== 'string' || !validCursorSyncValues.includes(dash.cursorSync))
    ) {
      throw new Error('CursorSync is not a string');
    }
  }
  if ('liveNow' in dash && typeof dash.liveNow !== 'boolean') {
    throw new Error('LiveNow is not a boolean');
  }
  if ('preload' in dash && typeof dash.preload !== 'boolean') {
    throw new Error('Preload is not a boolean');
  }
  if ('editable' in dash && typeof dash.editable !== 'boolean') {
    throw new Error('Editable is not a boolean');
  }
  if ('links' in dash && !Array.isArray(dash.links)) {
    throw new Error('Links is not an array');
  }
  if ('tags' in dash && !Array.isArray(dash.tags)) {
    throw new Error('Tags is not an array');
  }

  if ('id' in dash && dash.id !== undefined && typeof dash.id !== 'number') {
    throw new Error('ID is not a number');
  }

  // Time settings
  if (!('timeSettings' in dash) || typeof dash.timeSettings !== 'object' || dash.timeSettings === null) {
    throw new Error('TimeSettings is not an object or is null');
  }
  if (!('timezone' in dash.timeSettings) || typeof dash.timeSettings.timezone !== 'string') {
    throw new Error('Timezone is not a string');
  }
  if (!('from' in dash.timeSettings) || typeof dash.timeSettings.from !== 'string') {
    throw new Error('From is not a string');
  }
  if (!('to' in dash.timeSettings) || typeof dash.timeSettings.to !== 'string') {
    throw new Error('To is not a string');
  }
  if (!('autoRefresh' in dash.timeSettings) || typeof dash.timeSettings.autoRefresh !== 'string') {
    throw new Error('AutoRefresh is not a string');
  }
  if (!('autoRefreshIntervals' in dash.timeSettings) || !Array.isArray(dash.timeSettings.autoRefreshIntervals)) {
    throw new Error('AutoRefreshIntervals is not an array');
  }
  if (
    'quickRanges' in dash.timeSettings &&
    dash.timeSettings.quickRanges &&
    !Array.isArray(dash.timeSettings.quickRanges)
  ) {
    throw new Error('QuickRanges is not an array');
  }
  if (!('hideTimepicker' in dash.timeSettings) || typeof dash.timeSettings.hideTimepicker !== 'boolean') {
    throw new Error('HideTimepicker is not a boolean');
  }
  if (
    'weekStart' in dash.timeSettings &&
    typeof dash.timeSettings.weekStart === 'string' &&
    !['saturday', 'sunday', 'monday'].includes(dash.timeSettings.weekStart)
  ) {
    throw new Error('WeekStart should be one of "saturday", "sunday" or "monday"');
  }
  if (!('fiscalYearStartMonth' in dash.timeSettings) || typeof dash.timeSettings.fiscalYearStartMonth !== 'number') {
    throw new Error('FiscalYearStartMonth is not a number');
  }
  if (
    'nowDelay' in dash.timeSettings &&
    dash.timeSettings.nowDelay !== undefined &&
    typeof dash.timeSettings.nowDelay !== 'string'
  ) {
    throw new Error('NowDelay is not a string');
  }

  // Other sections
  if (!('variables' in dash) || !Array.isArray(dash.variables)) {
    throw new Error('Variables is not an array');
  }
  if (!('elements' in dash) || typeof dash.elements !== 'object' || dash.elements === null) {
    throw new Error('Elements is not an object or is null');
  }
  if (!('annotations' in dash) || !Array.isArray(dash.annotations)) {
    throw new Error('Annotations is not an array');
  }

  // Layout
  if (!('layout' in dash) || typeof dash.layout !== 'object' || dash.layout === null) {
    throw new Error('Layout is not an object or is null');
  }

  if (!('kind' in dash.layout) || dash.layout.kind === 'GridLayout') {
    validateGridLayout(dash.layout);
  }

  if (!('kind' in dash.layout) || dash.layout.kind === 'RowsLayout') {
    validateRowsLayout(dash.layout);
  }

  return true;
}

function validateGridLayout(layout: unknown) {
  if (typeof layout !== 'object' || layout === null) {
    throw new Error('Layout is not an object or is null');
  }
  if (!('kind' in layout) || layout.kind !== 'GridLayout') {
    throw new Error('Layout kind is not GridLayout');
  }
  if (!('spec' in layout) || typeof layout.spec !== 'object' || layout.spec === null) {
    throw new Error('Layout spec is not an object or is null');
  }
  if (!('items' in layout.spec) || !Array.isArray(layout.spec.items)) {
    throw new Error('Layout spec items is not an array');
  }
}

function validateRowsLayout(layout: unknown) {
  if (typeof layout !== 'object' || layout === null) {
    throw new Error('Layout is not an object or is null');
  }
  if (!('kind' in layout) || layout.kind !== 'RowsLayout') {
    throw new Error('Layout kind is not RowsLayout');
  }
  if (!('spec' in layout) || typeof layout.spec !== 'object' || layout.spec === null) {
    throw new Error('Layout spec is not an object or is null');
  }
  if (!('rows' in layout.spec) || !Array.isArray(layout.spec.rows)) {
    throw new Error('Layout spec items is not an array');
  }
}
