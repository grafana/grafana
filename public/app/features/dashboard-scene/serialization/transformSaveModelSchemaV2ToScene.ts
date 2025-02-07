import { uniqueId } from 'lodash';

import { config, getDataSourceSrv } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  behaviors,
  ConstantVariable,
  CustomVariable,
  DataSourceVariable,
  GroupByVariable,
  IntervalVariable,
  QueryVariable,
  SceneCSSGridLayout,
  SceneDataLayerControls,
  SceneDataProvider,
  SceneDataQuery,
  SceneDataTransformer,
  SceneGridItemLike,
  SceneGridLayout,
  SceneGridRow,
  SceneObject,
  SceneQueryRunner,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  SceneVariable,
  SceneVariableSet,
  TextBoxVariable,
  VariableValueSelectors,
  VizPanel,
  VizPanelMenu,
  VizPanelState,
} from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema/dist/esm/index.gen';
import {
  AdhocVariableKind,
  ConstantVariableKind,
  CustomVariableKind,
  DashboardV2Spec,
  DatasourceVariableKind,
  defaultAdhocVariableKind,
  defaultConstantVariableKind,
  defaultCustomVariableKind,
  defaultDatasourceVariableKind,
  defaultGroupByVariableKind,
  defaultIntervalVariableKind,
  defaultQueryVariableKind,
  defaultTextVariableKind,
  GridLayoutItemSpec,
  GridLayoutKind,
  Element,
  GroupByVariableKind,
  IntervalVariableKind,
  LibraryPanelKind,
  PanelKind,
  PanelQueryKind,
  QueryVariableKind,
  TextVariableKind,
  ResponsiveGridLayoutItemKind,
} from '@grafana/schema/src/schema/dashboard/v2alpha0';
import { contextSrv } from 'app/core/core';
import {
  AnnoKeyCreatedBy,
  AnnoKeyFolder,
  AnnoKeyUpdatedBy,
  AnnoKeyUpdatedTimestamp,
  AnnoKeyDashboardIsSnapshot,
  DeprecatedInternalId,
} from 'app/features/apiserver/types';
import { DashboardWithAccessInfo } from 'app/features/dashboard/api/types';
import { MIXED_DATASOURCE_NAME } from 'app/plugins/datasource/mixed/MixedDataSource';
import { DashboardMeta } from 'app/types';

import { addPanelsOnLoadBehavior } from '../addToDashboard/addPanelsOnLoadBehavior';
import { DashboardAnnotationsDataLayer } from '../scene/DashboardAnnotationsDataLayer';
import { DashboardControls } from '../scene/DashboardControls';
import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
import { DashboardDatasourceBehaviour } from '../scene/DashboardDatasourceBehaviour';
import { registerDashboardMacro } from '../scene/DashboardMacro';
import { DashboardReloadBehavior } from '../scene/DashboardReloadBehavior';
import { DashboardScene } from '../scene/DashboardScene';
import { DashboardScopesFacade } from '../scene/DashboardScopesFacade';
import { LibraryPanelBehavior } from '../scene/LibraryPanelBehavior';
import { VizPanelLinks, VizPanelLinksMenu } from '../scene/PanelLinks';
import { panelLinksBehavior, panelMenuBehavior } from '../scene/PanelMenuBehavior';
import { PanelNotices } from '../scene/PanelNotices';
import { PanelTimeRange } from '../scene/PanelTimeRange';
import { AngularDeprecation } from '../scene/angular/AngularDeprecation';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { RowRepeaterBehavior } from '../scene/layout-default/RowRepeaterBehavior';
import { RowActions } from '../scene/layout-default/row-actions/RowActions';
import { ResponsiveGridItem } from '../scene/layout-responsive-grid/ResponsiveGridItem';
import { ResponsiveGridLayoutManager } from '../scene/layout-responsive-grid/ResponsiveGridLayoutManager';
import { RowItem } from '../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../scene/layout-rows/RowsLayoutManager';
import { setDashboardPanelContext } from '../scene/setDashboardPanelContext';
import { DashboardLayoutManager } from '../scene/types/DashboardLayoutManager';
import { preserveDashboardSceneStateInLocalStorage } from '../utils/dashboardSessionState';
import { getGridItemKeyForPanelId, getIntervalsFromQueryString, getVizPanelKeyForPanelId } from '../utils/utils';

import { GRID_ROW_HEIGHT } from './const';
import { SnapshotVariable } from './custom-variables/SnapshotVariable';
import { registerPanelInteractionsReporter } from './transformSaveModelToScene';
import {
  transformCursorSyncV2ToV1,
  transformSortVariableToEnumV1,
  transformMappingsToV1,
  transformVariableHideToEnumV1,
  transformVariableRefreshToEnumV1,
} from './transformToV1TypesUtils';
import { LEGACY_STRING_VALUE_KEY } from './transformToV2TypesUtils';

const DEFAULT_DATASOURCE = 'default';

export type TypedVariableModelV2 =
  | QueryVariableKind
  | TextVariableKind
  | ConstantVariableKind
  | DatasourceVariableKind
  | IntervalVariableKind
  | CustomVariableKind
  | GroupByVariableKind
  | AdhocVariableKind;

export function transformSaveModelSchemaV2ToScene(dto: DashboardWithAccessInfo<DashboardV2Spec>): DashboardScene {
  const { spec: dashboard, metadata } = dto;

  const annotationLayers = dashboard.annotations.map((annotation) => {
    return new DashboardAnnotationsDataLayer({
      key: uniqueId('annotations-'),
      query: {
        ...annotation.spec,
        builtIn: annotation.spec.builtIn ? 1 : 0,
      },
      name: annotation.spec.name,
      isEnabled: Boolean(annotation.spec.enable),
      isHidden: Boolean(annotation.spec.hide),
    });
  });

  const isDashboardEditable = Boolean(dashboard.editable);
  const canSave = dto.access.canSave !== false;
  let dashboardId: number | undefined = undefined;

  if (metadata.labels?.[DeprecatedInternalId]) {
    dashboardId = parseInt(metadata.labels[DeprecatedInternalId], 10);
  }

  const meta: DashboardMeta = {
    canShare: dto.access.canShare !== false,
    canSave,
    canStar: dto.access.canStar !== false,
    canEdit: dto.access.canEdit !== false,
    canDelete: dto.access.canDelete !== false,
    canAdmin: dto.access.canAdmin !== false,
    url: dto.access.url,
    slug: dto.access.slug,
    annotationsPermissions: dto.access.annotationsPermissions,
    created: metadata.creationTimestamp,
    createdBy: metadata.annotations?.[AnnoKeyCreatedBy],
    updated: metadata.annotations?.[AnnoKeyUpdatedTimestamp],
    updatedBy: metadata.annotations?.[AnnoKeyUpdatedBy],
    folderUid: metadata.annotations?.[AnnoKeyFolder],
    isSnapshot: Boolean(metadata.annotations?.[AnnoKeyDashboardIsSnapshot]),

    // UI-only metadata, ref: DashboardModel.initMeta
    showSettings: Boolean(dto.access.canEdit),
    canMakeEditable: canSave && !isDashboardEditable,
    hasUnsavedFolderChange: false,
    version: parseInt(metadata.resourceVersion, 10),
    k8s: metadata,
  };

  // Ref: DashboardModel.initMeta
  if (!isDashboardEditable) {
    meta.canEdit = false;
    meta.canDelete = false;
    meta.canSave = false;
  }

  const layoutManager: DashboardLayoutManager = createLayoutManager(dashboard);

  const dashboardScene = new DashboardScene({
    description: dashboard.description,
    editable: dashboard.editable,
    preload: dashboard.preload,
    id: dashboardId,
    isDirty: false,
    links: dashboard.links,
    meta,
    tags: dashboard.tags,
    title: dashboard.title,
    uid: metadata.name,
    version: parseInt(metadata.resourceVersion, 10),
    body: layoutManager,
    $timeRange: new SceneTimeRange({
      from: dashboard.timeSettings.from,
      to: dashboard.timeSettings.to,
      fiscalYearStartMonth: dashboard.timeSettings.fiscalYearStartMonth,
      timeZone: dashboard.timeSettings.timezone,
      weekStart: dashboard.timeSettings.weekStart,
      UNSAFE_nowDelay: dashboard.timeSettings.nowDelay,
    }),
    $variables: getVariables(dashboard, meta.isSnapshot ?? false),
    $behaviors: [
      new behaviors.CursorSync({
        sync: transformCursorSyncV2ToV1(dashboard.cursorSync),
      }),
      new behaviors.SceneQueryController(),
      registerDashboardMacro,
      registerPanelInteractionsReporter,
      new behaviors.LiveNowTimer({ enabled: dashboard.liveNow }),
      preserveDashboardSceneStateInLocalStorage,
      addPanelsOnLoadBehavior,
      new DashboardScopesFacade({
        reloadOnParamsChange: config.featureToggles.reloadDashboardsOnParamsChange,
        uid: dashboardId?.toString(),
      }),
      new DashboardReloadBehavior({
        reloadOnParamsChange: config.featureToggles.reloadDashboardsOnParamsChange,
        uid: dashboardId?.toString(),
        version: 1,
      }),
    ],
    $data: new DashboardDataLayerSet({
      annotationLayers,
    }),
    controls: new DashboardControls({
      variableControls: [new VariableValueSelectors({}), new SceneDataLayerControls()],
      timePicker: new SceneTimePicker({}),
      refreshPicker: new SceneRefreshPicker({
        refresh: dashboard.timeSettings.autoRefresh,
        intervals: dashboard.timeSettings.autoRefreshIntervals,
        withText: true,
      }),
      hideTimeControls: dashboard.timeSettings.hideTimepicker,
    }),
  });

  dashboardScene.setInitialSaveModel(dto.spec, dto.metadata);

  return dashboardScene;
}

function buildGridItem(gridItem: GridLayoutItemSpec, panel: PanelKind, yOverride?: number): DashboardGridItem {
  const vizPanel = buildVizPanel(panel);
  return new DashboardGridItem({
    key: `grid-item-${panel.spec.id}`,
    x: gridItem.x,
    y: yOverride ?? gridItem.y,
    width: gridItem.repeat?.direction === 'h' ? 24 : gridItem.width,
    height: gridItem.height,
    itemHeight: gridItem.height,
    body: vizPanel,
    variableName: gridItem.repeat?.value,
    repeatDirection: gridItem.repeat?.direction,
    maxPerRow: gridItem.repeat?.maxPerRow,
  });
}

function createLayoutManager(dashboard: DashboardV2Spec): DashboardLayoutManager {
  if (dashboard.layout.kind === 'GridLayout') {
    return new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        isLazy: !(dashboard.preload || contextSrv.user.authenticatedBy === 'render'),
        children: createSceneGridLayoutForItems(dashboard.layout, dashboard.elements),
      }),
    });
  } else if (dashboard.layout.kind === 'RowsLayout') {
    return new RowsLayoutManager({
      rows: dashboard.layout.spec.rows.map((row) => {
        let layout: DashboardLayoutManager | undefined = undefined;

        if (row.spec.layout.kind === 'GridLayout') {
          layout = new DefaultGridLayoutManager({
            grid: new SceneGridLayout({
              children: createSceneGridLayoutForItems(row.spec.layout, dashboard.elements),
            }),
          });
        }

        if (row.spec.layout.kind === 'ResponsiveGridLayout') {
          layout = new ResponsiveGridLayoutManager({
            layout: new SceneCSSGridLayout({
              templateColumns: row.spec.layout.spec.col,
              autoRows: row.spec.layout.spec.row,
              children: createResponsiveGridItems(row.spec.layout.spec.items, dashboard.elements),
            }),
          });
        }

        if (!layout) {
          throw new Error(`Unsupported layout kind: ${row.spec.layout.kind} in row`);
        }
        return new RowItem({
          title: row.spec.title,
          isCollapsed: row.spec.collapsed,
          layout: layout,
        });
      }),
    });
  } else if (dashboard.layout.kind === 'ResponsiveGridLayout') {
    return new ResponsiveGridLayoutManager({
      layout: new SceneCSSGridLayout({
        templateColumns: dashboard.layout.spec.col,
        autoRows: dashboard.layout.spec.row,
        children: createResponsiveGridItems(dashboard.layout.spec.items, dashboard.elements),
      }),
    });
  }

  // @ts-ignore - this complains because we should never reach this point. If the model does not match the schema we will though.
  throw new Error(`Unsupported layout type: ${dashboard.layout.kind}`);
}

function createResponsiveGridItems(
  items: ResponsiveGridLayoutItemKind[],
  elements: Record<string, Element>
): ResponsiveGridItem[] {
  return items.map((item) => {
    const panel = elements[item.spec.element.name];
    if (!panel) {
      throw new Error(`Panel with uid ${item.spec.element.name} not found in the dashboard elements`);
    }
    if (panel.kind !== 'Panel') {
      throw new Error(`Unsupported element kind: ${panel.kind}`);
    }
    return new ResponsiveGridItem({
      key: getGridItemKeyForPanelId(panel.spec.id),
      body: buildVizPanel(panel),
    });
  });
}

function createSceneGridLayoutForItems(layout: GridLayoutKind, elements: Record<string, Element>): SceneGridItemLike[] {
  const gridElements = layout.spec.items;

  return gridElements.map((element) => {
    if (element.kind === 'GridLayoutItem') {
      const panel = elements[element.spec.element.name];

      if (!panel) {
        throw new Error(`Panel with uid ${element.spec.element.name} not found in the dashboard elements`);
      }

      if (panel.kind === 'Panel') {
        return buildGridItem(element.spec, panel);
      } else if (panel.kind === 'LibraryPanel') {
        const libraryPanel = buildLibraryPanel(panel);

        return new DashboardGridItem({
          key: `grid-item-${panel.spec.id}`,
          x: element.spec.x,
          y: element.spec.y,
          width: element.spec.width,
          height: element.spec.height,
          itemHeight: element.spec.height,
          body: libraryPanel,
        });
      } else {
        throw new Error(`Unknown element kind: ${element.kind}`);
      }
    } else if (element.kind === 'GridLayoutRow') {
      const children = element.spec.elements.map((gridElement) => {
        const panel = elements[gridElement.spec.element.name];
        if (panel.kind === 'Panel') {
          return buildGridItem(gridElement.spec, panel, element.spec.y + GRID_ROW_HEIGHT + gridElement.spec.y);
        } else {
          throw new Error(`Unknown element kind: ${gridElement.kind}`);
        }
      });
      let behaviors: SceneObject[] | undefined;
      if (element.spec.repeat) {
        behaviors = [new RowRepeaterBehavior({ variableName: element.spec.repeat.value })];
      }
      return new SceneGridRow({
        y: element.spec.y,
        isCollapsed: element.spec.collapsed,
        title: element.spec.title,
        $behaviors: behaviors,
        actions: new RowActions({}),
        children,
      });
    } else {
      // If this has been validated by the schema we should never reach this point, which is why TS is telling us this is an error.
      //@ts-expect-error
      throw new Error(`Unknown layout element kind: ${element.kind}`);
    }
  });
}

function buildLibraryPanel(panel: LibraryPanelKind): VizPanel {
  const titleItems: SceneObject[] = [];

  if (config.featureToggles.angularDeprecationUI) {
    titleItems.push(new AngularDeprecation());
  }

  titleItems.push(
    new VizPanelLinks({
      rawLinks: [],
      menu: new VizPanelLinksMenu({ $behaviors: [panelLinksBehavior] }),
    })
  );

  titleItems.push(new PanelNotices());

  const vizPanelState: VizPanelState = {
    key: getVizPanelKeyForPanelId(panel.spec.id),
    titleItems,
    $behaviors: [
      new LibraryPanelBehavior({
        uid: panel.spec.libraryPanel.uid,
        name: panel.spec.libraryPanel.name,
      }),
    ],
    extendPanelContext: setDashboardPanelContext,
    pluginId: LibraryPanelBehavior.LOADING_VIZ_PANEL_PLUGIN_ID,
    title: panel.spec.title,
    options: {},
    fieldConfig: {
      defaults: {},
      overrides: [],
    },
  };

  if (!config.publicDashboardAccessToken) {
    vizPanelState.menu = new VizPanelMenu({
      $behaviors: [panelMenuBehavior],
    });
  }

  return new VizPanel(vizPanelState);
}

function buildVizPanel(panel: PanelKind): VizPanel {
  const titleItems: SceneObject[] = [];

  if (config.featureToggles.angularDeprecationUI) {
    titleItems.push(new AngularDeprecation());
  }

  titleItems.push(
    new VizPanelLinks({
      rawLinks: panel.spec.links,
      menu: new VizPanelLinksMenu({ $behaviors: [panelLinksBehavior] }),
    })
  );

  titleItems.push(new PanelNotices());

  const queryOptions = panel.spec.data.spec.queryOptions;
  const timeOverrideShown = (queryOptions.timeFrom || queryOptions.timeShift) && !queryOptions.hideTimeOverride;

  const vizPanelState: VizPanelState = {
    key: getVizPanelKeyForPanelId(panel.spec.id),
    title: panel.spec.title,
    description: panel.spec.description,
    pluginId: panel.spec.vizConfig.kind,
    options: panel.spec.vizConfig.spec.options,
    fieldConfig: transformMappingsToV1(panel.spec.vizConfig.spec.fieldConfig),
    pluginVersion: panel.spec.vizConfig.spec.pluginVersion,
    displayMode: panel.spec.transparent ? 'transparent' : 'default',
    hoverHeader: !panel.spec.title && !timeOverrideShown,
    hoverHeaderOffset: 0,
    $data: createPanelDataProvider(panel),
    titleItems,
    $behaviors: [],
    extendPanelContext: setDashboardPanelContext,
    // _UNSAFE_customMigrationHandler: getAngularPanelMigrationHandler(panel), //FIXME: Angular Migration
  };

  if (!config.publicDashboardAccessToken) {
    vizPanelState.menu = new VizPanelMenu({
      $behaviors: [panelMenuBehavior],
    });
  }

  if (queryOptions.timeFrom || queryOptions.timeShift) {
    vizPanelState.$timeRange = new PanelTimeRange({
      timeFrom: queryOptions.timeFrom,
      timeShift: queryOptions.timeShift,
      hideTimeOverride: queryOptions.hideTimeOverride,
    });
  }

  return new VizPanel(vizPanelState);
}

function getPanelDataSource(panel: PanelKind): DataSourceRef | undefined {
  if (!panel.spec.data?.spec.queries?.length) {
    return undefined;
  }

  let datasource: DataSourceRef | undefined = undefined;
  let isMixedDatasource = false;

  panel.spec.data.spec.queries.forEach((query) => {
    if (!datasource) {
      datasource = query.spec.datasource;
    } else if (datasource.uid !== query.spec.datasource?.uid || datasource.type !== query.spec.datasource?.type) {
      isMixedDatasource = true;
    }
  });

  return isMixedDatasource ? { type: 'mixed', uid: MIXED_DATASOURCE_NAME } : undefined;
}

function panelQueryKindToSceneQuery(query: PanelQueryKind): SceneDataQuery {
  return {
    refId: query.spec.refId,
    datasource: query.spec.datasource,
    hide: query.spec.hidden,
    ...query.spec.query.spec,
  };
}

export function createPanelDataProvider(panelKind: PanelKind): SceneDataProvider | undefined {
  const panel = panelKind.spec;
  const targets = panel.data?.spec.queries ?? [];
  // Skip setting query runner for panels without queries
  if (!targets?.length) {
    return undefined;
  }

  // Skip setting query runner for panel plugins with skipDataQuery
  if (config.panels[panel.vizConfig.kind]?.skipDataQuery) {
    return undefined;
  }

  let dataProvider: SceneDataProvider | undefined = undefined;
  const datasource = getPanelDataSource(panelKind);

  dataProvider = new SceneQueryRunner({
    datasource,
    queries: targets.map(panelQueryKindToSceneQuery),
    maxDataPoints: panel.data.spec.queryOptions.maxDataPoints ?? undefined,
    maxDataPointsFromWidth: true,
    cacheTimeout: panel.data.spec.queryOptions.cacheTimeout,
    queryCachingTTL: panel.data.spec.queryOptions.queryCachingTTL,
    minInterval: panel.data.spec.queryOptions.interval ?? undefined,
    dataLayerFilter: {
      panelId: panel.id,
    },
    $behaviors: [new DashboardDatasourceBehaviour({})],
  });

  // Wrap inner data provider in a data transformer
  return new SceneDataTransformer({
    $data: dataProvider,
    transformations: panel.data.spec.transformations.map((transformation) => transformation.spec),
  });
}

function getVariables(dashboard: DashboardV2Spec, isSnapshot: boolean): SceneVariableSet | undefined {
  let variables: SceneVariableSet | undefined;

  if (dashboard.variables.length) {
    if (isSnapshot) {
      variables = createVariablesForSnapshot(dashboard);
    } else {
      variables = createVariablesForDashboard(dashboard);
    }
  } else {
    // Create empty variable set
    variables = new SceneVariableSet({
      variables: [],
    });
  }

  return variables;
}

function createVariablesForDashboard(dashboard: DashboardV2Spec) {
  const variableObjects = dashboard.variables
    .map((v) => {
      try {
        return createSceneVariableFromVariableModel(v);
      } catch (err) {
        console.error(err);
        return null;
      }
    })
    // TODO: Remove filter
    // Added temporarily to allow skipping non-compatible variables
    .filter((v): v is SceneVariable => Boolean(v));

  return new SceneVariableSet({
    variables: variableObjects,
  });
}

function createSceneVariableFromVariableModel(variable: TypedVariableModelV2): SceneVariable {
  const commonProperties = {
    name: variable.spec.name,
    label: variable.spec.label,
    description: variable.spec.description,
  };
  if (variable.kind === defaultAdhocVariableKind().kind) {
    return new AdHocFiltersVariable({
      ...commonProperties,
      description: variable.spec.description,
      skipUrlSync: variable.spec.skipUrlSync,
      hide: transformVariableHideToEnumV1(variable.spec.hide),
      datasource: variable.spec.datasource,
      applyMode: 'auto',
      filters: variable.spec.filters ?? [],
      baseFilters: variable.spec.baseFilters ?? [],
      defaultKeys: variable.spec.defaultKeys,
      useQueriesAsFilterForOptions: true,
      layout: config.featureToggles.newFiltersUI ? 'combobox' : undefined,
      supportsMultiValueOperators: Boolean(
        getDataSourceSrv().getInstanceSettings(variable.spec.datasource)?.meta.multiValueFilterOperators
      ),
    });
  }
  if (variable.kind === defaultCustomVariableKind().kind) {
    return new CustomVariable({
      ...commonProperties,
      value: variable.spec.current?.value ?? '',
      text: variable.spec.current?.text ?? '',

      query: variable.spec.query,
      isMulti: variable.spec.multi,
      allValue: variable.spec.allValue || undefined,
      includeAll: variable.spec.includeAll,
      defaultToAll: Boolean(variable.spec.includeAll),
      skipUrlSync: variable.spec.skipUrlSync,
      hide: transformVariableHideToEnumV1(variable.spec.hide),
    });
  } else if (variable.kind === defaultQueryVariableKind().kind) {
    return new QueryVariable({
      ...commonProperties,
      value: variable.spec.current?.value ?? '',
      text: variable.spec.current?.text ?? '',
      query: getDataQueryForVariable(variable),
      datasource: variable.spec.datasource,
      sort: transformSortVariableToEnumV1(variable.spec.sort),
      refresh: transformVariableRefreshToEnumV1(variable.spec.refresh),
      regex: variable.spec.regex,
      allValue: variable.spec.allValue || undefined,
      includeAll: variable.spec.includeAll,
      defaultToAll: Boolean(variable.spec.includeAll),
      isMulti: variable.spec.multi,
      skipUrlSync: variable.spec.skipUrlSync,
      hide: transformVariableHideToEnumV1(variable.spec.hide),
      definition: variable.spec.definition,
    });
  } else if (variable.kind === defaultDatasourceVariableKind().kind) {
    return new DataSourceVariable({
      ...commonProperties,
      value: variable.spec.current?.value ?? '',
      text: variable.spec.current?.text ?? '',
      regex: variable.spec.regex,
      pluginId: variable.spec.pluginId,
      allValue: variable.spec.allValue || undefined,
      includeAll: variable.spec.includeAll,
      defaultToAll: Boolean(variable.spec.includeAll),
      skipUrlSync: variable.spec.skipUrlSync,
      isMulti: variable.spec.multi,
      hide: transformVariableHideToEnumV1(variable.spec.hide),
      defaultOptionEnabled:
        variable.spec.current?.value === DEFAULT_DATASOURCE && variable.spec.current?.text === 'default',
    });
  } else if (variable.kind === defaultIntervalVariableKind().kind) {
    const intervals = getIntervalsFromQueryString(variable.spec.query);
    const currentInterval = getCurrentValueForOldIntervalModel(variable, intervals);
    return new IntervalVariable({
      ...commonProperties,
      value: currentInterval,
      intervals: intervals,
      autoEnabled: variable.spec.auto,
      autoStepCount: variable.spec.auto_count,
      autoMinInterval: variable.spec.auto_min,
      refresh: transformVariableRefreshToEnumV1(variable.spec.refresh),
      skipUrlSync: variable.spec.skipUrlSync,
      hide: transformVariableHideToEnumV1(variable.spec.hide),
    });
  } else if (variable.kind === defaultConstantVariableKind().kind) {
    return new ConstantVariable({
      ...commonProperties,
      value: variable.spec.query,
      skipUrlSync: variable.spec.skipUrlSync,
      hide: transformVariableHideToEnumV1(variable.spec.hide),
    });
  } else if (variable.kind === defaultTextVariableKind().kind) {
    let val;
    if (!variable?.spec.current?.value) {
      val = variable.spec.query;
    } else {
      if (typeof variable.spec.current.value === 'string') {
        val = variable.spec.current.value;
      } else {
        val = variable.spec.current.value[0];
      }
    }

    return new TextBoxVariable({
      ...commonProperties,
      value: val,
      skipUrlSync: variable.spec.skipUrlSync,
      hide: transformVariableHideToEnumV1(variable.spec.hide),
    });
  } else if (config.featureToggles.groupByVariable && variable.kind === defaultGroupByVariableKind().kind) {
    return new GroupByVariable({
      ...commonProperties,
      datasource: variable.spec.datasource,
      value: variable.spec.current?.value || [],
      text: variable.spec.current?.text || [],
      skipUrlSync: variable.spec.skipUrlSync,
      isMulti: variable.spec.multi,
      hide: transformVariableHideToEnumV1(variable.spec.hide),
      // @ts-expect-error
      defaultOptions: variable.options,
    });
  } else {
    throw new Error(`Scenes: Unsupported variable type ${variable.kind}`);
  }
}

function getDataQueryForVariable(variable: QueryVariableKind) {
  return LEGACY_STRING_VALUE_KEY in variable.spec.query.spec
    ? (variable.spec.query.spec[LEGACY_STRING_VALUE_KEY] ?? '')
    : {
        ...variable.spec.query.spec,
        refId: variable.spec.query.spec.refId ?? 'A',
      };
}

export function getCurrentValueForOldIntervalModel(variable: IntervalVariableKind, intervals: string[]): string {
  const selectedInterval = Array.isArray(variable.spec.current.value)
    ? variable.spec.current.value[0]
    : variable.spec.current.value;

  // If the interval is the old auto format, return the new auto interval from scenes.
  if (selectedInterval.startsWith('$__auto_interval_')) {
    return '$__auto';
  }

  // Check if the selected interval is valid.
  if (intervals.includes(selectedInterval)) {
    return selectedInterval;
  }

  // If the selected interval is not valid, return the first valid interval.
  return intervals[0];
}

export function createVariablesForSnapshot(dashboard: DashboardV2Spec): SceneVariableSet {
  const variableObjects = dashboard.variables
    .map((v) => {
      try {
        // for adhoc we are using the AdHocFiltersVariable from scenes becuase of its complexity
        if (v.kind === 'AdhocVariable') {
          return new AdHocFiltersVariable({
            name: v.spec.name,
            label: v.spec.label,
            readOnly: true,
            description: v.spec.description,
            skipUrlSync: v.spec.skipUrlSync,
            hide: transformVariableHideToEnumV1(v.spec.hide),
            datasource: v.spec.datasource,
            applyMode: 'auto',
            filters: v.spec.filters ?? [],
            baseFilters: v.spec.baseFilters ?? [],
            defaultKeys: v.spec.defaultKeys,
            useQueriesAsFilterForOptions: true,
            layout: config.featureToggles.newFiltersUI ? 'combobox' : undefined,
            supportsMultiValueOperators: Boolean(
              getDataSourceSrv().getInstanceSettings(v.spec.datasource)?.meta.multiValueFilterOperators
            ),
          });
        }
        // for other variable types we are using the SnapshotVariable
        return createSnapshotVariable(v);
      } catch (err) {
        console.error(err);
        return null;
      }
    })
    // TODO: Remove filter
    // Added temporarily to allow skipping non-compatible variables
    .filter((v): v is SceneVariable => Boolean(v));

  return new SceneVariableSet({
    variables: variableObjects,
  });
}

/** Snapshots variables are read-only and should not be updated */
export function createSnapshotVariable(variable: TypedVariableModelV2): SceneVariable {
  let snapshotVariable: SnapshotVariable;
  let current: { value: string | string[]; text: string | string[] };
  if (variable.kind === 'IntervalVariable') {
    const intervals = getIntervalsFromQueryString(variable.spec.query);
    const currentInterval = getCurrentValueForOldIntervalModel(variable, intervals);
    snapshotVariable = new SnapshotVariable({
      name: variable.spec.name,
      label: variable.spec.label,
      description: variable.spec.description,
      value: currentInterval,
      text: currentInterval,
      hide: transformVariableHideToEnumV1(variable.spec.hide),
    });
    return snapshotVariable;
  }

  if (variable.kind === 'ConstantVariable' || variable.kind === 'AdhocVariable') {
    current = {
      value: '',
      text: '',
    };
  } else {
    current = {
      value: variable.spec.current?.value ?? '',
      text: variable.spec.current?.text ?? '',
    };
  }

  snapshotVariable = new SnapshotVariable({
    name: variable.spec.name,
    label: variable.spec.label,
    description: variable.spec.description,
    value: current?.value ?? '',
    text: current?.text ?? '',
    hide: transformVariableHideToEnumV1(variable.spec.hide),
  });
  return snapshotVariable;
}

export function getPanelElement(dashboard: DashboardV2Spec, elementName: string): PanelKind | undefined {
  return dashboard.elements[elementName].kind === 'Panel' ? dashboard.elements[elementName] : undefined;
}

export function getLibraryPanelElement(dashboard: DashboardV2Spec, elementName: string): LibraryPanelKind | undefined {
  return dashboard.elements[elementName].kind === 'LibraryPanel' ? dashboard.elements[elementName] : undefined;
}
