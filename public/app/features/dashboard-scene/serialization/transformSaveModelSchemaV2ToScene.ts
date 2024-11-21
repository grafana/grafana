import { uniqueId } from 'lodash';

import { config, getDataSourceSrv } from '@grafana/runtime';
import {
  VizPanel,
  SceneTimePicker,
  SceneGridLayout,
  SceneTimeRange,
  VariableValueSelectors,
  SceneRefreshPicker,
  SceneObject,
  VizPanelMenu,
  behaviors,
  VizPanelState,
  SceneGridItemLike,
  SceneDataLayerControls,
  UserActionEvent,
  SceneDataProvider,
  SceneQueryRunner,
  SceneDataTransformer,
  SceneVariable,
  SceneVariableSet,
  AdHocFiltersVariable,
  CustomVariable,
  QueryVariable,
  DataSourceVariable,
  IntervalVariable,
  ConstantVariable,
  TextBoxVariable,
  GroupByVariable,
} from '@grafana/scenes';
import {
  DashboardCursorSync as DashboardCursorSyncV1,
  defaultDashboardCursorSync,
} from '@grafana/schema/dist/esm/index.gen';
import {
  AdhocVariableKind,
  ConstantVariableKind,
  CustomVariableKind,
  DashboardCursorSync,
  DashboardV2Spec,
  DatasourceVariableKind,
  GroupByVariableKind,
  IntervalVariableKind,
  PanelKind,
  QueryVariableKind,
  TextVariableKind,
} from '@grafana/schema/src/schema/dashboard/v2alpha0/dashboard.gen';

import { addPanelsOnLoadBehavior } from '../addToDashboard/addPanelsOnLoadBehavior';
import { DashboardAnnotationsDataLayer } from '../scene/DashboardAnnotationsDataLayer';
import { DashboardControls } from '../scene/DashboardControls';
import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
import { DashboardDatasourceBehaviour } from '../scene/DashboardDatasourceBehaviour';
import { registerDashboardMacro } from '../scene/DashboardMacro';
import { DashboardReloadBehavior } from '../scene/DashboardReloadBehavior';
import { DashboardScene } from '../scene/DashboardScene';
import { DashboardScopesFacade } from '../scene/DashboardScopesFacade';
import { panelMenuBehavior } from '../scene/PanelMenuBehavior';
import { PanelNotices } from '../scene/PanelNotices';
import { PanelTimeRange } from '../scene/PanelTimeRange';
import { AngularDeprecation } from '../scene/angular/AngularDeprecation';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { setDashboardPanelContext } from '../scene/setDashboardPanelContext';
import { preserveDashboardSceneStateInLocalStorage } from '../utils/dashboardSessionState';
import { DashboardInteractions } from '../utils/interactions';
import { getDashboardSceneFor, getIntervalsFromQueryString } from '../utils/utils';

import { getAngularPanelMigrationHandler } from './angularMigration';
import { SnapshotVariable } from './custom-variables/SnapshotVariable';

const DEFAULT_DATASOURCE = 'default';

type TypedVariableModelv2 =
  | QueryVariableKind
  | TextVariableKind
  | ConstantVariableKind
  | DatasourceVariableKind
  | IntervalVariableKind
  | CustomVariableKind
  | GroupByVariableKind
  | AdhocVariableKind;

export function transformSaveModelSchemaV2ToScene(dashboard: DashboardV2Spec): DashboardScene {
  const annotationLayers = dashboard.annotations.map((annotation) => {
    return new DashboardAnnotationsDataLayer({
      key: uniqueId('annotations-'),
      query: annotation.spec,
      name: annotation.spec.name,
      isEnabled: Boolean(annotation.spec.enable),
      isHidden: Boolean(annotation.spec.hide),
    });
  });

  const dashboardScene = new DashboardScene({
    description: dashboard.description,
    editable: dashboard.editable,
    preload: dashboard.preload,
    id: dashboard.id,
    isDirty: false,
    links: dashboard.links,
    meta: {},
    tags: dashboard.tags,
    title: dashboard.title,
    uid: dashboard.id?.toString(),
    version: dashboard.schemaVersion,
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        isLazy: dashboard.preload ? false : true,
        children: createSceneGridLayoutForItems(dashboard),
        $behaviors: [trackIfEmpty],
      }),
    }),
    $timeRange: new SceneTimeRange({
      from: dashboard.timeSettings.from,
      to: dashboard.timeSettings.to,
      fiscalYearStartMonth: dashboard.timeSettings.fiscalYearStartMonth,
      timeZone: dashboard.timeSettings.timezone,
      weekStart: dashboard.timeSettings.weekStart,
      UNSAFE_nowDelay: dashboard.timeSettings.nowDelay,
    }),
    $variables: getVariables(dashboard),
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
        uid: dashboard.id?.toString(),
      }),
      new DashboardReloadBehavior({
        reloadOnParamsChange: config.featureToggles.reloadDashboardsOnParamsChange,
        uid: dashboard.id?.toString(),
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

  return dashboardScene;
}

function createSceneGridLayoutForItems(dashboard: DashboardV2Spec): SceneGridItemLike[] {
  const gridElements = dashboard.layout.spec.items;

  return gridElements.map((element) => {
    if (element.kind === 'GridLayoutItem') {
      const panel = dashboard.elements[element.spec.element.name];

      if (!panel) {
        throw new Error(`Panel with uid ${element.spec.element.name} not found in the dashboard elements`);
      }

      if (panel.kind === 'Panel') {
        const vizPanel = buildVizPanel(panel);

        return new DashboardGridItem({
          key: `grid-item-${panel.spec.uid}`,
          x: element.spec.x,
          y: element.spec.y,
          width: element.spec.width,
          height: element.spec.height,
          itemHeight: element.spec.height,
          body: vizPanel,
        });
      } else {
        throw new Error(`Unknown element kind: ${element.kind}`);
      }
    } else {
      throw new Error(`Unknown layout element kind: ${element.kind}`);
    }
  });
}

function buildVizPanel(panel: PanelKind): VizPanel {
  const titleItems: SceneObject[] = [];

  if (config.featureToggles.angularDeprecationUI) {
    titleItems.push(new AngularDeprecation());
  }

  // FIXME: Links in a panel are DashboardLinks not DataLinks
  // titleItems.push(
  //   new VizPanelLinks({
  //     rawLinks: panel.spec.links,
  //     menu: new VizPanelLinksMenu({ $behaviors: [panelLinksBehavior] }),
  //   })
  // );

  titleItems.push(new PanelNotices());

  const queryOptions = panel.spec.data.spec.queryOptions;
  const timeOverrideShown = (queryOptions.timeFrom || queryOptions.timeShift) && !queryOptions.hideTimeOverride;

  const vizPanelState: VizPanelState = {
    key: panel.spec.uid,
    title: panel.spec.title,
    description: panel.spec.description,
    pluginId: panel.spec.vizConfig.kind,
    options: panel.spec.vizConfig.spec.options,
    fieldConfig: panel.spec.vizConfig.spec.fieldConfig,
    pluginVersion: panel.spec.vizConfig.spec.pluginVersion,
    // FIXME: Transparent is not added to the schema yet
    // displayMode: panel.spec.transparent ? 'transparent' : undefined,
    hoverHeader: !panel.spec.title && !timeOverrideShown,
    hoverHeaderOffset: 0,
    $data: createPanelDataProvider(panel),
    titleItems,
    $behaviors: [],
    extendPanelContext: setDashboardPanelContext,
    _UNSAFE_customMigrationHandler: getAngularPanelMigrationHandler(panel),
  };

  // FIXME: Library Panel
  // if (panel.spec.libraryPanel) {
  //   vizPanelState.$behaviors!.push(
  //     new LibraryPanelBehavior({ uid: panel.spec.libraryPanel.uid, name: panel.spec.libraryPanel.name })
  //   );
  //   vizPanelState.pluginId = LibraryPanelBehavior.LOADING_VIZ_PANEL_PLUGIN_ID;
  //   vizPanelState.$data = undefined;
  // }

  if (!config.publicDashboardAccessToken) {
    vizPanelState.menu = new VizPanelMenu({
      $behaviors: [panelMenuBehavior],
    });
  }

  if (queryOptions.timeFrom || queryOptions.timeShift) {
    vizPanelState.$timeRange = new PanelTimeRange({
      timeFrom: queryOptions.timeFrom,
      timeShift: queryOptions.timeShift,
      // FIXME: hideTimeOverride is not added to the schema yet
      // hideTimeOverride: queryOptions.hideTimeOverride,
    });
  }

  return new VizPanel(vizPanelState);
}

function trackIfEmpty(grid: SceneGridLayout) {
  getDashboardSceneFor(grid).setState({ isEmpty: grid.state.children.length === 0 });

  const sub = grid.subscribeToState((n, p) => {
    if (n.children.length !== p.children.length || n.children !== p.children) {
      getDashboardSceneFor(grid).setState({ isEmpty: n.children.length === 0 });
    }
  });

  return () => {
    sub.unsubscribe();
  };
}

function registerPanelInteractionsReporter(scene: DashboardScene) {
  scene.subscribeToEvent(UserActionEvent, (e) => {
    const { interaction } = e.payload;
    switch (interaction) {
      case 'panel-status-message-clicked':
        DashboardInteractions.panelStatusMessageClicked();
        break;
      case 'panel-cancel-query-clicked':
        DashboardInteractions.panelCancelQueryClicked();
        break;
    }
  });
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
  const datasource = panel.data.spec.queries[0]?.spec.datasource;

  dataProvider = new SceneQueryRunner({
    datasource: datasource ?? undefined,
    queries: targets.map((query) => query.spec),
    maxDataPoints: panel.data.spec.queryOptions.maxDataPoints ?? undefined,
    maxDataPointsFromWidth: true,
    cacheTimeout: panel.data.spec.queryOptions.cacheTimeout,
    queryCachingTTL: panel.data.spec.queryOptions.queryCachingTTL,
    minInterval: panel.data.spec.queryOptions.interval ?? undefined,
    dataLayerFilter: {
      // FIXME: This is asking for a number as panel ID but here the uid of a panel is string
      panelId: parseInt(panel.uid, 10),
    },
    $behaviors: [new DashboardDatasourceBehaviour({})],
  });

  // Wrap inner data provider in a data transformer
  return new SceneDataTransformer({
    $data: dataProvider,
    transformations: panel.data.spec.transformations.map((transformation) => transformation.spec),
  });
}

function transformCursorSyncV2ToV1(cursorSync: DashboardCursorSync): DashboardCursorSyncV1 {
  switch (cursorSync) {
    case DashboardCursorSync.Crosshair:
      return DashboardCursorSyncV1.Crosshair;
    case DashboardCursorSync.Tooltip:
      return DashboardCursorSyncV1.Tooltip;
    case DashboardCursorSync.Off:
      return DashboardCursorSyncV1.Off;
    default:
      return defaultDashboardCursorSync;
  }
}

function getVariables(dashboard: DashboardV2Spec): SceneVariableSet | undefined {
  let variables: SceneVariableSet | undefined;

  if (dashboard.variables.length) {
    if (false) {
      // FIXME: isSnapshot is not added to the schema yet
      // in the old model we use .meta.isSnapshot but meta is not persisted
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

function createSceneVariableFromVariableModel(variable: TypedVariableModelv2): SceneVariable {
  const commonProperties = {
    name: variable.spec.name,
    label: variable.spec.label,
    description: variable.spec.description,
  };
  if (variable.kind === 'AdhocVariable') {
    return new AdHocFiltersVariable({
      ...commonProperties,
      description: variable.spec.description,
      skipUrlSync: variable.spec.skipUrlSync,
      // FIXME: need to fix this in cue schema defintion by updating VariableHide type definition to use default numeric values
      // the same applies to sort and referesh fields which require updaring VariableSort and VariableRefresh type definitions
      hide: variable.spec.hide,
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
  if (variable.kind === 'CustomVariable') {
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
      hide: variable.spec.hide,
    });
  } else if (variable.kind === 'QueryVariable') {
    return new QueryVariable({
      ...commonProperties,
      value: variable.spec.current?.value ?? '',
      text: variable.spec.current?.text ?? '',
      query: variable.spec.query,
      datasource: variable.spec.datasource,
      sort: variable.spec.sort, //FIXME: need to fix this in cue schema defintion by updating VariableSort to use default numeric values
      refresh: variable.spec.refresh, //FIXME: need to fix this in cue schema defintion by updating VariableRefresh to use default numeric values
      regex: variable.spec.regex,
      allValue: variable.spec.allValue || undefined,
      includeAll: variable.spec.includeAll,
      defaultToAll: Boolean(variable.spec.includeAll),
      isMulti: variable.spec.multi,
      skipUrlSync: variable.spec.skipUrlSync,
      hide: variable.spec.hide,
      definition: variable.spec.definition,
    });
  } else if (variable.kind === 'DatasourceVariable') {
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
      hide: variable.spec.hide,
      defaultOptionEnabled:
        variable.spec.current?.value === DEFAULT_DATASOURCE && variable.spec.current?.text === 'default',
    });
  } else if (variable.kind === 'IntervalVariable') {
    const intervals = getIntervalsFromQueryString(variable.spec.query);
    const currentInterval = getCurrentValueForOldIntervalModel(variable, intervals);
    return new IntervalVariable({
      ...commonProperties,
      value: currentInterval,
      intervals: intervals,
      autoEnabled: variable.spec.auto,
      autoStepCount: variable.spec.auto_count,
      autoMinInterval: variable.spec.auto_min,
      refresh: variable.spec.refresh,
      skipUrlSync: variable.spec.skipUrlSync,
      hide: variable.spec.hide,
    });
  } else if (variable.kind === 'ConstantVariable') {
    return new ConstantVariable({
      ...commonProperties,
      value: variable.spec.query,
      skipUrlSync: variable.spec.skipUrlSync,
      hide: variable.spec.hide,
    });
  } else if (variable.kind === 'TextVariable') {
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
      hide: variable.spec.hide,
    });
  } else if (config.featureToggles.groupByVariable && variable.kind === 'GroupByVariable') {
    return new GroupByVariable({
      ...commonProperties,
      datasource: variable.spec.datasource,
      value: variable.spec.current?.value || [],
      text: variable.spec.current?.text || [],
      skipUrlSync: variable.spec.skipUrlSync,
      hide: variable.spec.hide,
      // @ts-expect-error
      defaultOptions: variable.options,
    });
  } else {
    throw new Error(`Scenes: Unsupported variable type ${variable.kind}`);
  }
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
            hide: v.spec.hide,
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
export function createSnapshotVariable(variable: TypedVariableModelv2): SceneVariable {
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
      hide: variable.spec.hide,
    });
    return snapshotVariable;
  }

  // FIXME: don't have a system variable that schema v2 would return
  if (variable.kind === 'system' || variable.kind === 'ConstantVariable' || variable.kind === 'AdhocVariable') {
    current = {
      value: '',
      text: '',
    };
  } else {
    current = {
      value: variable.current?.value ?? '',
      text: variable.current?.text ?? '',
    };
  }

  snapshotVariable = new SnapshotVariable({
    name: variable.spec.name,
    label: variable.spec.label,
    description: variable.spec.description,
    value: current?.value ?? '',
    text: current?.text ?? '',
    hide: variable.spec.hide,
  });
  return snapshotVariable;
}
