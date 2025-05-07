import { omit } from 'lodash';

import { AnnotationQuery } from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  behaviors,
  dataLayers,
  QueryVariable,
  SceneDataQuery,
  SceneDataTransformer,
  SceneQueryRunner,
  SceneVariables,
  SceneVariableSet,
  VizPanel,
} from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';
import { sortedDeepCloneWithoutNulls } from 'app/core/utils/object';

import {
  Spec as DashboardV2Spec,
  defaultSpec as defaultDashboardV2Spec,
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
} from '../../../../../packages/grafana-schema/src/schema/dashboard/v2alpha1/types.spec.gen';
import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
import { DashboardScene, DashboardSceneState } from '../scene/DashboardScene';
import { PanelTimeRange } from '../scene/PanelTimeRange';
import { dashboardSceneGraph } from '../utils/dashboardSceneGraph';
import { getLibraryPanelBehavior, getPanelIdForVizPanel, getQueryRunnerFor, isLibraryPanel } from '../utils/utils';

import { DSReferencesMapping } from './DashboardSceneSerializer';
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

  const dsReferencesMapping: DSReferencesMapping = scene.serializer.getDSReferencesMapping();

  const dashboardSchemaV2: DeepPartial<DashboardV2Spec> = {
    //dashboard settings
    title: sceneDash.title,
    description: sceneDash.description,
    cursorSync: getCursorSync(sceneDash),
    liveNow: getLiveNow(sceneDash),
    preload: sceneDash.preload ?? defaultDashboardV2Spec().preload,
    editable: sceneDash.editable ?? defaultDashboardV2Spec().editable,
    links: sceneDash.links ?? defaultDashboardV2Spec().links,
    tags: sceneDash.tags ?? defaultDashboardV2Spec().tags,
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
      quickRanges: controlsState?.timePicker.state.quickRanges,
    },
    // EOF time settings

    // variables
    variables: getVariables(sceneDash, dsReferencesMapping),
    // EOF variables

    // elements
    elements: getElements(scene, dsReferencesMapping),
    // EOF elements

    // annotations
    annotations: getAnnotations(sceneDash, dsReferencesMapping),
    // EOF annotations

    // layout
    layout: sceneDash.body.serialize(),
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

function getElements(scene: DashboardScene, dsReferencesMapping: DSReferencesMapping) {
  const panels = scene.state.body.getVizPanels() ?? [];
  const panelsArray = panels.map((vizPanel) => {
    return vizPanelToSchemaV2(vizPanel, dsReferencesMapping);
  });
  return createElements(panelsArray, scene);
}

export function vizPanelToSchemaV2(
  vizPanel: VizPanel,
  dsReferencesMapping?: DSReferencesMapping
): PanelKind | LibraryPanelKind {
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
  }

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
    }).filter(([_, value]) => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return value !== undefined;
    })
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
      transparent: vizPanel.state.displayMode === 'transparent' ? true : undefined,
      data: {
        kind: 'QueryGroup',
        spec: {
          queries: getVizPanelQueries(vizPanel, dsReferencesMapping),
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

function getPanelLinks(panel: VizPanel): DataLink[] {
  const vizLinks = dashboardSceneGraph.getPanelLinks(panel);
  if (vizLinks) {
    return vizLinks.state.rawLinks ?? [];
  }
  return [];
}

function getVizPanelQueries(vizPanel: VizPanel, dsReferencesMapping?: DSReferencesMapping): PanelQueryKind[] {
  const queries: PanelQueryKind[] = [];
  const queryRunner = getQueryRunnerFor(vizPanel);
  const vizPanelQueries = queryRunner?.state.queries;

  if (vizPanelQueries) {
    vizPanelQueries.forEach((query) => {
      const queryDatasource = getElementDatasource(vizPanel, query, 'panel', queryRunner, dsReferencesMapping);
      const dataQuery: DataQueryKind = {
        kind: getDataQueryKind(query, queryRunner),
        spec: omit(query, 'datasource', 'refId', 'hide'),
      };
      const querySpec: PanelQuerySpec = {
        datasource: queryDatasource,
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

export function getDataQueryKind(query: SceneDataQuery | string, queryRunner?: SceneQueryRunner): string {
  // Query is a string - get default data source type
  if (typeof query === 'string') {
    const defaultDS = getDefaultDataSourceRef();
    return defaultDS?.type || '';
  }

  // Query has explicit datasource with type
  if (query.datasource?.type) {
    return query.datasource.type;
  }

  // Get type from query runner's datasource
  if (queryRunner?.state.datasource?.type) {
    return queryRunner.state.datasource.type;
  }

  // Fall back to default datasource
  const defaultDS = getDefaultDataSourceRef();
  return defaultDS?.type || '';
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
          filter: transformation.filter,
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

export function createElements(panels: Element[], scene: DashboardScene): Record<string, Element> {
  return panels.reduce<Record<string, Element>>((elements, panel) => {
    let elementKey = scene.serializer.getElementIdForPanel(panel.spec.id);
    elements[elementKey!] = panel;
    return elements;
  }, {});
}

function getVariables(oldDash: DashboardSceneState, dsReferencesMapping?: DSReferencesMapping) {
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
    variables = sceneVariablesSetToSchemaV2Variables(variablesSet, false, dsReferencesMapping);
  }

  return variables;
}

function getAnnotations(state: DashboardSceneState, dsReferencesMapping?: DSReferencesMapping): AnnotationQueryKind[] {
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
        datasource: getElementDatasource(layer, layer.state.query, 'annotation', undefined, dsReferencesMapping),
        enable: Boolean(layer.state.isEnabled),
        hide: Boolean(layer.state.isHidden),
        iconColor: layer.state.query.iconColor,
      },
    };

    // Transform v1 dashboard (using target) to v2 structure
    if (layer.state.query.target) {
      // Handle built-in annotations
      if (layer.state.query.builtIn) {
        result.spec.query = {
          kind: 'grafana', // built-in annotations are always of type grafana
          spec: {
            ...layer.state.query.target,
          },
        };
      } else {
        result.spec.query = {
          kind: getAnnotationQueryKind(layer.state.query),
          spec: {
            ...layer.state.query.target,
          },
        };
      }
    }
    // For annotations without query.query defined (e.g., grafana annotations without tags)
    else if (layer.state.query.query?.kind) {
      result.spec.query = {
        kind: layer.state.query.query.kind,
        spec: {
          ...layer.state.query.query.spec,
        },
      };
    }
    // Collect datasource-specific properties not in standard annotation spec
    let otherProps = omit(
      layer.state.query,
      'type',
      'target',
      'builtIn',
      'name',
      'datasource',
      'iconColor',
      'enable',
      'hide',
      'filter',
      'query'
    );

    // Store extra properties in the options field instead of directly in the spec
    if (Object.keys(otherProps).length > 0) {
      // Extract options property and get the rest of the properties
      const { options, ...restProps } = otherProps;

      // Merge options with the rest of the properties
      result.spec.options = { ...options, ...restProps };
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
export function validateDashboardSchemaV2(dash: unknown): dash is DashboardV2Spec {
  if (typeof dash !== 'object' || dash === null || Array.isArray(dash)) {
    throw new Error('Dashboard is not an object or is null');
  }

  // Required properties
  if (!('title' in dash) || typeof dash.title !== 'string') {
    throw new Error('Title is not a string');
  }
  if (!('timeSettings' in dash) || typeof dash.timeSettings !== 'object' || dash.timeSettings === null) {
    throw new Error('TimeSettings is not an object or is null');
  }
  if (!('variables' in dash) || !Array.isArray(dash.variables)) {
    throw new Error('Variables is not an array');
  }
  if (!('elements' in dash) || typeof dash.elements !== 'object' || dash.elements === null) {
    throw new Error('Elements is not an object or is null');
  }
  if (!('annotations' in dash) || !Array.isArray(dash.annotations)) {
    throw new Error('Annotations is not an array');
  }
  if (!('layout' in dash) || typeof dash.layout !== 'object' || dash.layout === null) {
    throw new Error('Layout is not an object or is null');
  }

  // Optional properties - only validate if present
  if ('description' in dash && dash.description !== undefined && typeof dash.description !== 'string') {
    throw new Error('Description is not a string');
  }
  if ('cursorSync' in dash && dash.cursorSync !== undefined) {
    const validCursorSyncValues = ((): string[] => {
      const typeValues: DashboardCursorSync[] = ['Off', 'Crosshair', 'Tooltip'];
      return typeValues;
    })();

    if (typeof dash.cursorSync !== 'string' || !validCursorSyncValues.includes(dash.cursorSync)) {
      throw new Error('CursorSync is not a valid value');
    }
  }
  if ('liveNow' in dash && dash.liveNow !== undefined && typeof dash.liveNow !== 'boolean') {
    throw new Error('LiveNow is not a boolean');
  }
  if ('preload' in dash && dash.preload !== undefined && typeof dash.preload !== 'boolean') {
    throw new Error('Preload is not a boolean');
  }
  if ('editable' in dash && dash.editable !== undefined && typeof dash.editable !== 'boolean') {
    throw new Error('Editable is not a boolean');
  }
  if ('links' in dash && dash.links !== undefined && !Array.isArray(dash.links)) {
    throw new Error('Links is not an array');
  }
  if ('tags' in dash && dash.tags !== undefined && !Array.isArray(dash.tags)) {
    throw new Error('Tags is not an array');
  }
  if ('id' in dash && dash.id !== undefined && typeof dash.id !== 'number') {
    throw new Error('ID is not a number');
  }

  // Time settings validation
  const timeSettings = dash.timeSettings;

  // Required time settings
  if (!('from' in timeSettings) || typeof timeSettings.from !== 'string') {
    throw new Error('From is not a string');
  }
  if (!('to' in timeSettings) || typeof timeSettings.to !== 'string') {
    throw new Error('To is not a string');
  }
  if (!('autoRefresh' in timeSettings) || typeof timeSettings.autoRefresh !== 'string') {
    throw new Error('AutoRefresh is not a string');
  }
  if (!('hideTimepicker' in timeSettings) || typeof timeSettings.hideTimepicker !== 'boolean') {
    throw new Error('HideTimepicker is not a boolean');
  }

  // Optional time settings with defaults
  if (
    'autoRefreshIntervals' in timeSettings &&
    timeSettings.autoRefreshIntervals !== undefined &&
    !Array.isArray(timeSettings.autoRefreshIntervals)
  ) {
    throw new Error('AutoRefreshIntervals is not an array');
  }
  if ('timezone' in timeSettings && timeSettings.timezone !== undefined && typeof timeSettings.timezone !== 'string') {
    throw new Error('Timezone is not a string');
  }
  if (
    'quickRanges' in timeSettings &&
    timeSettings.quickRanges !== undefined &&
    !Array.isArray(timeSettings.quickRanges)
  ) {
    throw new Error('QuickRanges is not an array');
  }
  if ('weekStart' in timeSettings && timeSettings.weekStart !== undefined) {
    if (
      typeof timeSettings.weekStart !== 'string' ||
      !['saturday', 'sunday', 'monday'].includes(timeSettings.weekStart)
    ) {
      throw new Error('WeekStart should be one of "saturday", "sunday" or "monday"');
    }
  }
  if ('nowDelay' in timeSettings && timeSettings.nowDelay !== undefined && typeof timeSettings.nowDelay !== 'string') {
    throw new Error('NowDelay is not a string');
  }
  if (
    'fiscalYearStartMonth' in timeSettings &&
    timeSettings.fiscalYearStartMonth !== undefined &&
    typeof timeSettings.fiscalYearStartMonth !== 'number'
  ) {
    throw new Error('FiscalYearStartMonth is not a number');
  }

  // Layout validation
  if (!('kind' in dash.layout)) {
    throw new Error('Layout kind is required');
  }

  if (dash.layout.kind === 'GridLayout') {
    validateGridLayout(dash.layout);
  } else if (dash.layout.kind === 'RowsLayout') {
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

export function getAutoAssignedDSRef(
  element: VizPanel | SceneVariables | dataLayers.AnnotationsDataLayer,
  type: 'panels' | 'variables' | 'annotations',
  elementMapReferences?: DSReferencesMapping
): Set<string> {
  if (!elementMapReferences) {
    return new Set();
  }
  if (type === 'panels' && isVizPanel(element)) {
    const elementKey = dashboardSceneGraph.getElementIdentifierForVizPanel(element);
    return elementMapReferences.panels.get(elementKey) || new Set();
  }

  if (type === 'variables') {
    return elementMapReferences.variables;
  }

  if (type === 'annotations') {
    return elementMapReferences.annotations;
  }

  // if type is not panels, annotations, or variables, throw error
  throw new Error(`Invalid type ${type} for getAutoAssignedDSRef`);
}

/**
 * Determines if a data source reference should be persisted for a query or variable
 */
export function getPersistedDSFor<T extends SceneDataQuery | QueryVariable | AnnotationQuery>(
  element: T,
  autoAssignedDsRef: Set<string>,
  type: 'query' | 'variable' | 'annotation',
  context?: SceneQueryRunner
): DataSourceRef | undefined {
  // Get the element identifier - refId for queries, name for variables
  const elementId = getElementIdentifier(element, type);

  // If the element is in the auto-assigned set, it didn't have a datasource specified
  if (autoAssignedDsRef?.has(elementId)) {
    return undefined;
  }

  // Return appropriate datasource reference based on element type
  if (type === 'query') {
    if ('datasource' in element && element.datasource) {
      // If element has its own datasource, use that
      return element.datasource;
    }

    // For queries missing a datasource but not in auto-assigned set, use datasource from context (queryRunner)
    return context?.state?.datasource;
  }

  if (type === 'variable' && 'state' in element && 'datasource' in element.state) {
    return element.state.datasource || {};
  }

  if (type === 'annotation' && 'datasource' in element) {
    return element.datasource || {};
  }

  return undefined;
}

/**
 * Helper function to extract which identifier to use from a query or variable element
 * @returns refId for queries, name for variables
 * TODO: we will add annotations in the future
 */
function getElementIdentifier<T extends SceneDataQuery | QueryVariable | AnnotationQuery>(
  element: T,
  type: 'query' | 'variable' | 'annotation'
): string {
  // when is type query look for refId
  if (type === 'query') {
    return 'refId' in element ? element.refId : '';
  }

  if (type === 'variable') {
    // when is type variable look for the name of the variable
    return 'state' in element && 'name' in element.state ? element.state.name : '';
  }

  // when is type annotation look for annotation name
  if (type === 'annotation') {
    return 'name' in element ? element.name : '';
  }

  throw new Error(`Invalid type ${type} for getElementIdentifier`);
}

function isVizPanel(element: VizPanel | SceneVariables | dataLayers.AnnotationsDataLayer): element is VizPanel {
  // FIXME: is there another way to do this?
  return 'pluginId' in element.state;
}

function isSceneVariables(
  element: VizPanel | SceneVariables | dataLayers.AnnotationsDataLayer
): element is SceneVariables {
  // Check for properties unique to SceneVariables but not in VizPanel
  return !('pluginId' in element.state) && ('variables' in element.state || 'getValue' in element);
}

function isSceneDataQuery(query: SceneDataQuery | QueryVariable | AnnotationQuery): query is SceneDataQuery {
  return 'refId' in query && !('state' in query);
}

function isAnnotationQuery(query: SceneDataQuery | QueryVariable | AnnotationQuery): query is AnnotationQuery {
  return 'datasource' in query && 'name' in query;
}

function isQueryVariable(query: SceneDataQuery | QueryVariable | AnnotationQuery): query is QueryVariable {
  return 'state' in query && 'name' in query.state;
}

/**
 * Get the persisted datasource for a query or variable
 * When a query or variable is created it could not have a datasource set
 * we want to respect that and not overwrite it with the auto assigned datasources
 * resolved in runtime
 *
 */
export function getElementDatasource(
  element: VizPanel | SceneVariables | dataLayers.AnnotationsDataLayer,
  queryElement: SceneDataQuery | QueryVariable | AnnotationQuery,
  type: 'panel' | 'variable' | 'annotation',
  queryRunner?: SceneQueryRunner,
  dsReferencesMapping?: DSReferencesMapping
): DataSourceRef | undefined {
  let result: DataSourceRef | undefined;
  if (type === 'panel') {
    if (!queryRunner || !isVizPanel(element) || !isSceneDataQuery(queryElement)) {
      return undefined;
    }
    // Get datasource for panel query
    const autoAssignedRefs = getAutoAssignedDSRef(element, 'panels', dsReferencesMapping);
    result = getPersistedDSFor(queryElement, autoAssignedRefs, 'query', queryRunner);
  }

  if (type === 'variable') {
    if (!isSceneVariables(element) || !isQueryVariable(queryElement)) {
      return undefined;
    }
    // Get datasource for variable
    const autoAssignedRefs = getAutoAssignedDSRef(element, 'variables', dsReferencesMapping);

    result = getPersistedDSFor(queryElement, autoAssignedRefs, 'variable');
  }

  if (type === 'annotation') {
    if (!isAnnotationQuery(queryElement)) {
      return undefined;
    }
    // Get datasource for annotation
    const autoAssignedRefs = getAutoAssignedDSRef(element, 'annotations', dsReferencesMapping);
    result = getPersistedDSFor(queryElement, autoAssignedRefs, 'annotation');
  }
  // Important: Only return the datasource if it's not in auto-assigned refs
  // and if the result would not be an empty object
  return Object.keys(result || {}).length > 0 ? result : undefined;
}
