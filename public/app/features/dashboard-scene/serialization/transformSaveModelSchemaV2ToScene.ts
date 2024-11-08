import { uniqueId } from 'lodash';

import { config } from '@grafana/runtime';
import {
  VizPanel,
  SceneTimePicker,
  SceneGridLayout,
  SceneTimeRange,
  SceneVariableSet,
  VariableValueSelectors,
  SceneRefreshPicker,
  SceneObject,
  VizPanelMenu,
  behaviors,
  VizPanelState,
  SceneGridItemLike,
  SceneDataLayerControls,
  UserActionEvent,
} from '@grafana/scenes';
import { PanelKind } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/kinds';

import { DashboardV2 } from '../../../../../packages/grafana-schema/src/schema/dashboard/v2alpha0/dashboard.gen';
import { addPanelsOnLoadBehavior } from '../addToDashboard/addPanelsOnLoadBehavior';
import { AlertStatesDataLayer } from '../scene/AlertStatesDataLayer';
import { DashboardAnnotationsDataLayer } from '../scene/DashboardAnnotationsDataLayer';
import { DashboardControls } from '../scene/DashboardControls';
import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
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
import { setDashboardPanelContext } from '../scene/setDashboardPanelContext';
import { createPanelDataProvider } from '../utils/createPanelDataProvider';
import { preserveDashboardSceneStateInLocalStorage } from '../utils/dashboardSessionState';
import { DashboardInteractions } from '../utils/interactions';
import { getDashboardSceneFor, getVizPanelKeyForPanelId } from '../utils/utils';

import { getAngularPanelMigrationHandler } from './angularMigration';

export function transformSaveModelSchemaV2ToScene(dashboard: DashboardV2): DashboardScene {
  const spec = dashboard.spec;

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

  const alertStatesLayer = new AlertStatesDataLayer({
    key: 'alert-states',
    name: 'Alert States',
  });

  const dashboardScene = new DashboardScene({
    description: spec.description,
    editable: spec.editable,
    preload: spec.preload,
    id: spec.id,
    isDirty: false,
    links: spec.links,
    meta: {},
    tags: spec.tags,
    title: spec.title,
    uid: spec.id?.toString(),
    version: 1,
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        isLazy: spec.preload ? false : true,
        children: createSceneObjectsForPanels(spec.elements),
        $behaviors: [trackIfEmpty],
      }),
    }),
    $timeRange: new SceneTimeRange({
      from: spec.timeSettings.from,
      to: spec.timeSettings.to,
      fiscalYearStartMonth: spec.timeSettings.fiscalYearStartMonth,
      timeZone: spec.timeSettings.timezone,
      weekStart: spec.timeSettings.weekStart,
      UNSAFE_nowDelay: spec.timeSettings.nowDelay,
    }),
    // FIXME: Variables
    // $variables: variables,
    $behaviors: [
      new behaviors.CursorSync({
        sync: spec.cursorSync,
      }),
      new behaviors.SceneQueryController(),
      registerDashboardMacro,
      registerPanelInteractionsReporter,
      new behaviors.LiveNowTimer({ enabled: spec.liveNow }),
      preserveDashboardSceneStateInLocalStorage,
      addPanelsOnLoadBehavior,
      new DashboardScopesFacade({
        reloadOnParamsChange: config.featureToggles.reloadDashboardsOnParamsChange,
        uid: spec.id?.toString(),
      }),
      new DashboardReloadBehavior({
        reloadOnParamsChange: config.featureToggles.reloadDashboardsOnParamsChange,
        uid: spec.id?.toString(),
        version: 1,
      }),
    ],
    $data: new DashboardDataLayerSet({
      // FIXME: Annotations
      // annotationLayers,
      alertStatesLayer,
    }),
    controls: new DashboardControls({
      variableControls: [new VariableValueSelectors({}), new SceneDataLayerControls()],
      timePicker: new SceneTimePicker({}),
      refreshPicker: new SceneRefreshPicker({
        refresh: spec.timeSettings.autoRefresh,
        intervals: spec.timeSettings.autoRefreshIntervals,
        withText: true,
      }),
      hideTimeControls: spec.timeSettings.hideTimepicker,
    }),
  });

  return dashboardScene;
}

function createSceneObjectsForPanels(elements: Record<string, PanelKind>): SceneGridItemLike[] {
  const panels: SceneGridItemLike[] = [];

  for (const key in elements) {
    const panel = elements[key];
    const panelObject = buildGridItemForPanel(panel);
    panels.push(panelObject);
  }

  return panels;
}

function buildGridItemForPanel(panel: PanelKind): DashboardGridItem {
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
    key: panel.spec.uid,
    title: panel.spec.title,
    description: panel.spec.description,
    pluginId: panel.spec.vizConfig.kind,
    options: panel.spec.vizConfig.spec.options,
    fieldConfig: panel.spec.vizConfig.spec.fieldConfig,
    pluginVersion: panel.spec.vizConfig.spec.pluginVersion,
    displayMode: panel.spec.transparent ? 'transparent' : undefined,
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
      hideTimeOverride: queryOptions.hideTimeOverride,
    });
  }

  const body = new VizPanel(vizPanelState);

  return new DashboardGridItem({
    key: `grid-item-${panel.spec.uid}`,
    x: panel.spec.gridPos.x,
    y: panel.spec.gridPos.y,
    width: panel.spec.gridPos.w,
    height: panel.spec.gridPos.h,
    itemHeight: panel.spec.gridPos.h,
    body,
  });
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
