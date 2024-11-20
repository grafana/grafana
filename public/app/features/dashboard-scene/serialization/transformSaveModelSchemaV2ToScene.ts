import { config } from '@grafana/runtime';
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
} from '@grafana/scenes';

import {
  DashboardCursorSync,
  DashboardV2Spec,
  PanelKind,
} from '../../../../../packages/grafana-schema/src/schema/dashboard/v2alpha0/dashboard.gen';
import { addPanelsOnLoadBehavior } from '../addToDashboard/addPanelsOnLoadBehavior';
import { DashboardControls } from '../scene/DashboardControls';
import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
import { registerDashboardMacro } from '../scene/DashboardMacro';
import { DashboardReloadBehavior } from '../scene/DashboardReloadBehavior';
import { DashboardScene } from '../scene/DashboardScene';
import { DashboardScopesFacade } from '../scene/DashboardScopesFacade';
import { VizPanelLinks, VizPanelLinksMenu } from '../scene/PanelLinks';
import { panelLinksBehavior, panelMenuBehavior } from '../scene/PanelMenuBehavior';
import { PanelNotices } from '../scene/PanelNotices';
import { PanelTimeRange } from '../scene/PanelTimeRange';
import { AngularDeprecation } from '../scene/angular/AngularDeprecation';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { setDashboardPanelContext } from '../scene/setDashboardPanelContext';
import { preserveDashboardSceneStateInLocalStorage } from '../utils/dashboardSessionState';
import { DashboardInteractions } from '../utils/interactions';
import { getDashboardSceneFor } from '../utils/utils';

import { getAngularPanelMigrationHandler } from './angularMigration';
import { DashboardDatasourceBehaviour } from '../scene/DashboardDatasourceBehaviour';
import {
  DashboardCursorSync as DashboardCursorSyncV1,
  defaultDashboardCursorSync,
} from '@grafana/schema/dist/esm/index.gen';

export function transformSaveModelSchemaV2ToScene(dashboard: DashboardV2Spec): DashboardScene {
  // FIXME: Variables
  // const variables = new SceneVariableSet({
  //   variables: spec.variables.map((variable) => {
  //     // Map variables to SceneVariableSet
  //     return {
  //       name: variable.name,
  //       type: variable.kind,
  //       value: variable.value,
  //     };
  //   }),
  // });

  // FIXME: Annotations
  // const annotationLayers = spec.annotations.map((annotation) => {
  //   return new DashboardAnnotationsDataLayer({
  //     key: uniqueId('annotations-'),
  //     query: annotation,
  //     name: annotation.name,
  //     isEnabled: Boolean(annotation.enable),
  //     isHidden: Boolean(annotation.hide),
  //   });
  // });

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
    // FIXME: Variables pending to implement
    // $variables: variables,
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
      // FIXME: Annotations
      // annotationLayers,
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
    // FIXME: These types are not compatible
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
