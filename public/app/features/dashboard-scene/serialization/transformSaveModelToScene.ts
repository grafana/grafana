import { uniqueId } from 'lodash';

import { DataFrameDTO, DataFrameJSON } from '@grafana/data';
import { config, logMeasurement, reportInteraction } from '@grafana/runtime';
import {
  VizPanel,
  SceneTimePicker,
  SceneGridLayout,
  SceneGridRow,
  SceneTimeRange,
  SceneVariableSet,
  VariableValueSelectors,
  SceneRefreshPicker,
  SceneObject,
  VizPanelMenu,
  behaviors,
  VizPanelState,
  SceneGridItemLike,
  SceneDataLayerProvider,
  SceneDataLayerControls,
  UserActionEvent,
  SceneInteractionProfileEvent,
  SceneObjectState,
} from '@grafana/scenes';
import { isWeekStart } from '@grafana/ui';
import { contextSrv } from 'app/core/core';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { DashboardDTO, DashboardDataDTO } from 'app/types';

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
import { DashboardGridItem, RepeatDirection } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { RowRepeaterBehavior } from '../scene/layout-default/RowRepeaterBehavior';
import { RowActions } from '../scene/layout-default/row-actions/RowActions';
import { setDashboardPanelContext } from '../scene/setDashboardPanelContext';
import { createPanelDataProvider } from '../utils/createPanelDataProvider';
import { preserveDashboardSceneStateInLocalStorage } from '../utils/dashboardSessionState';
import { DashboardInteractions } from '../utils/interactions';
import { getVizPanelKeyForPanelId } from '../utils/utils';
import { createVariablesForDashboard, createVariablesForSnapshot } from '../utils/variables';

import { getAngularPanelMigrationHandler } from './angularMigration';
import { GRAFANA_DATASOURCE_REF } from './const';

export interface DashboardLoaderState {
  dashboard?: DashboardScene;
  isLoading?: boolean;
  loadError?: string;
}

export interface SaveModelToSceneOptions {
  isEmbedded?: boolean;
}

export function transformSaveModelToScene(rsp: DashboardDTO): DashboardScene {
  // Just to have migrations run
  const oldModel = new DashboardModel(rsp.dashboard, rsp.meta);

  const scene = createDashboardSceneFromDashboardModel(oldModel, rsp.dashboard);
  // TODO: refactor createDashboardSceneFromDashboardModel to work on Dashboard schema model
  scene.setInitialSaveModel(rsp.dashboard);

  return scene;
}

export function createSceneObjectsForPanels(oldPanels: PanelModel[]): SceneGridItemLike[] {
  // collects all panels and rows
  const panels: SceneGridItemLike[] = [];

  // indicates expanded row that's currently processed
  let currentRow: PanelModel | null = null;
  // collects panels in the currently processed, expanded row
  let currentRowPanels: SceneGridItemLike[] = [];

  for (const panel of oldPanels) {
    if (panel.type === 'row') {
      if (!currentRow) {
        if (Boolean(panel.collapsed)) {
          // collapsed rows contain their panels within the row model
          panels.push(createRowFromPanelModel(panel, []));
        } else {
          // indicate new row to be processed
          currentRow = panel;
        }
      } else {
        // when a row has been processed, and we hit a next one for processing
        if (currentRow.id !== panel.id) {
          // commit previous row panels
          panels.push(createRowFromPanelModel(currentRow, currentRowPanels));

          if (Boolean(panel.collapsed)) {
            // collapsed rows contain their panels within the row model
            panels.push(createRowFromPanelModel(panel, []));
            currentRow = null;
          } else {
            // indicate new row to be processed
            currentRow = panel;
          }

          currentRowPanels = [];
        }
      }
    } else {
      // when rendering a snapshot created with the legacy Dashboards convert data to new snapshot format to be compatible with Scenes
      if (panel.snapshotData) {
        convertOldSnapshotToScenesSnapshot(panel);
      }

      const panelObject = buildGridItemForPanel(panel);

      // when processing an expanded row, collect its panels
      if (currentRow) {
        currentRowPanels.push(panelObject);
      } else {
        panels.push(panelObject);
      }
    }
  }

  // commit a row if it's the last one
  if (currentRow) {
    panels.push(createRowFromPanelModel(currentRow, currentRowPanels));
  }

  return panels;
}

function createRowFromPanelModel(row: PanelModel, content: SceneGridItemLike[]): SceneGridItemLike {
  if (Boolean(row.collapsed)) {
    if (row.panels) {
      content = row.panels.map((saveModel) => {
        // Collapsed panels are not actually PanelModel instances
        if (!(saveModel instanceof PanelModel)) {
          saveModel = new PanelModel(saveModel);
        }

        return buildGridItemForPanel(saveModel);
      });
    }
  }

  let behaviors: SceneObject[] | undefined;
  let children = content;

  if (row.repeat) {
    // For repeated rows the children are stored in the behavior
    behaviors = [new RowRepeaterBehavior({ variableName: row.repeat })];
  }

  return new SceneGridRow({
    key: getVizPanelKeyForPanelId(row.id),
    title: row.title,
    y: row.gridPos.y,
    isCollapsed: row.collapsed,
    children: children,
    $behaviors: behaviors,
    actions: new RowActions({}),
  });
}

export function createDashboardSceneFromDashboardModel(oldModel: DashboardModel, dto: DashboardDataDTO) {
  let variables: SceneVariableSet | undefined;
  let annotationLayers: SceneDataLayerProvider[] = [];
  let alertStatesLayer: AlertStatesDataLayer | undefined;
  const uid = dto.uid;

  if (oldModel.templating?.list?.length) {
    if (oldModel.meta.isSnapshot) {
      variables = createVariablesForSnapshot(oldModel);
    } else {
      variables = createVariablesForDashboard(oldModel);
    }
  } else {
    // Create empty variable set
    variables = new SceneVariableSet({
      variables: [],
    });
  }

  if (oldModel.annotations?.list?.length && !oldModel.isSnapshot()) {
    annotationLayers = oldModel.annotations?.list.map((a) => {
      // Each annotation query is an individual data layer
      return new DashboardAnnotationsDataLayer({
        key: uniqueId('annotations-'),
        query: a,
        name: a.name,
        isEnabled: Boolean(a.enable),
        isHidden: Boolean(a.hide),
      });
    });
  }

  let shouldUseAlertStatesLayer = config.unifiedAlertingEnabled;
  if (!shouldUseAlertStatesLayer) {
    if (oldModel.panels.find((panel) => Boolean(panel.alert))) {
      shouldUseAlertStatesLayer = true;
    }
  }

  if (shouldUseAlertStatesLayer) {
    alertStatesLayer = new AlertStatesDataLayer({
      key: 'alert-states',
      name: 'Alert States',
    });
  }

  const scopeMeta =
    config.featureToggles.scopeFilters && oldModel.scopeMeta
      ? {
          trait: oldModel.scopeMeta.trait,
          groups: oldModel.scopeMeta.groups,
        }
      : undefined;

  const behaviorList: SceneObjectState['$behaviors'] = [
    new behaviors.CursorSync({
      sync: oldModel.graphTooltip,
    }),
    new behaviors.SceneQueryController({
      enableProfiling:
        config.dashboardPerformanceMetrics.findIndex((uid) => uid === '*' || uid === oldModel.uid) !== -1,
      onProfileComplete: getDashboardInteractionCallback(oldModel.uid, oldModel.title),
    }),
    registerDashboardMacro,
    registerPanelInteractionsReporter,
    new behaviors.LiveNowTimer({ enabled: oldModel.liveNow }),
    preserveDashboardSceneStateInLocalStorage,
    addPanelsOnLoadBehavior,
    new DashboardScopesFacade({
      reloadOnParamsChange: config.featureToggles.reloadDashboardsOnParamsChange && oldModel.meta.reloadOnParamsChange,
      uid,
    }),
    new DashboardReloadBehavior({
      reloadOnParamsChange: config.featureToggles.reloadDashboardsOnParamsChange && oldModel.meta.reloadOnParamsChange,
      uid,
      version: oldModel.version,
    }),
  ];
  const dashboardScene = new DashboardScene({
    uid,
    description: oldModel.description,
    editable: oldModel.editable,
    preload: dto.preload ?? false,
    id: oldModel.id,
    isDirty: false,
    links: oldModel.links || [],
    meta: oldModel.meta,
    tags: oldModel.tags || [],
    title: oldModel.title,
    version: oldModel.version,
    scopeMeta,
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        isLazy: !(dto.preload || contextSrv.user.authenticatedBy === 'render'),
        children: createSceneObjectsForPanels(oldModel.panels),
      }),
    }),
    $timeRange: new SceneTimeRange({
      from: oldModel.time.from,
      to: oldModel.time.to,
      fiscalYearStartMonth: oldModel.fiscalYearStartMonth,
      timeZone: oldModel.timezone,
      weekStart: isWeekStart(oldModel.weekStart) ? oldModel.weekStart : undefined,
      UNSAFE_nowDelay: oldModel.timepicker?.nowDelay,
    }),
    $variables: variables,
    $behaviors: behaviorList,
    $data: new DashboardDataLayerSet({ annotationLayers, alertStatesLayer }),
    controls: new DashboardControls({
      variableControls: [new VariableValueSelectors({}), new SceneDataLayerControls()],
      timePicker: new SceneTimePicker({}),
      refreshPicker: new SceneRefreshPicker({
        refresh: oldModel.refresh,
        intervals: oldModel.timepicker.refresh_intervals,
        withText: true,
      }),
      hideTimeControls: oldModel.timepicker.hidden,
    }),
  });

  return dashboardScene;
}

export function buildGridItemForPanel(panel: PanelModel): DashboardGridItem {
  const repeatOptions: Partial<{ variableName: string; repeatDirection: RepeatDirection }> = panel.repeat
    ? {
        variableName: panel.repeat,
        repeatDirection: panel.repeatDirection === 'v' ? 'v' : 'h',
      }
    : {};

  const titleItems: SceneObject[] = [];

  if (config.featureToggles.angularDeprecationUI) {
    titleItems.push(new AngularDeprecation());
  }
  titleItems.push(
    new VizPanelLinks({
      rawLinks: panel.links,
      menu: new VizPanelLinksMenu({ $behaviors: [panelLinksBehavior] }),
    })
  );

  titleItems.push(new PanelNotices());

  const timeOverrideShown = (panel.timeFrom || panel.timeShift) && !panel.hideTimeOverride;

  const vizPanelState: VizPanelState = {
    key: getVizPanelKeyForPanelId(panel.id),
    title: panel.title,
    description: panel.description,
    pluginId: panel.type ?? 'timeseries',
    options: panel.options ?? {},
    fieldConfig: panel.fieldConfig,
    pluginVersion: panel.pluginVersion,
    displayMode: panel.transparent ? 'transparent' : undefined,
    // To be replaced with it's own option persited option instead derived
    hoverHeader: !panel.title && !timeOverrideShown,
    hoverHeaderOffset: 0,
    $data: createPanelDataProvider(panel),
    titleItems,
    $behaviors: [],
    extendPanelContext: setDashboardPanelContext,
    _UNSAFE_customMigrationHandler: getAngularPanelMigrationHandler(panel),
  };

  if (panel.libraryPanel) {
    vizPanelState.$behaviors!.push(
      new LibraryPanelBehavior({ uid: panel.libraryPanel.uid, name: panel.libraryPanel.name })
    );
    vizPanelState.pluginId = LibraryPanelBehavior.LOADING_VIZ_PANEL_PLUGIN_ID;
    vizPanelState.$data = undefined;
  }

  if (!config.publicDashboardAccessToken) {
    vizPanelState.menu = new VizPanelMenu({
      $behaviors: [panelMenuBehavior],
    });
  }

  if (panel.timeFrom || panel.timeShift) {
    vizPanelState.$timeRange = new PanelTimeRange({
      timeFrom: panel.timeFrom,
      timeShift: panel.timeShift,
      hideTimeOverride: panel.hideTimeOverride,
    });
  }

  const body = new VizPanel(vizPanelState);

  return new DashboardGridItem({
    key: `grid-item-${panel.id}`,
    x: panel.gridPos.x,
    y: panel.gridPos.y,
    width: repeatOptions.repeatDirection === 'h' ? 24 : panel.gridPos.w,
    height: panel.gridPos.h,
    itemHeight: panel.gridPos.h,
    body,
    maxPerRow: panel.maxPerRow,
    ...repeatOptions,
  });
}

export function registerPanelInteractionsReporter(scene: DashboardScene) {
  // Subscriptions set with subscribeToEvent are automatically unsubscribed when the scene deactivated
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

const convertSnapshotData = (snapshotData: DataFrameDTO[]): DataFrameJSON[] => {
  return snapshotData.map((data) => {
    return {
      data: {
        values: data.fields.map((field) => field.values).filter((values): values is unknown[] => values !== undefined),
      },
      schema: {
        fields: data.fields.map((field) => ({
          name: field.name,
          type: field.type,
          config: field.config,
        })),
      },
    };
  });
};

// override panel datasource and targets with snapshot data using the Grafana datasource
export const convertOldSnapshotToScenesSnapshot = (panel: PanelModel) => {
  // only old snapshots created with old dashboards contains snapshotData
  if (panel.snapshotData) {
    panel.datasource = GRAFANA_DATASOURCE_REF;
    panel.targets = [
      {
        refId: panel.snapshotData[0]?.refId ?? '',
        datasource: panel.datasource,
        queryType: 'snapshot',
        // @ts-ignore
        snapshot: convertSnapshotData(panel.snapshotData),
      },
    ];
    panel.snapshotData = [];
  }
};

function getDashboardInteractionCallback(uid: string, title: string) {
  return (e: SceneInteractionProfileEvent) => {
    let interactionType = '';

    if (e.origin === 'SceneTimeRange') {
      interactionType = 'time-range-change';
    } else if (e.origin === 'SceneRefreshPicker') {
      interactionType = 'refresh';
    } else if (e.origin === 'DashboardScene') {
      interactionType = 'view';
    } else if (e.origin.indexOf('Variable') > -1) {
      interactionType = 'variable-change';
    }
    reportInteraction('dashboard-render', {
      interactionType,
      duration: e.duration,
      networkDuration: e.networkDuration,
      totalJSHeapSize: e.totalJSHeapSize,
      usedJSHeapSize: e.usedJSHeapSize,
      jsHeapSizeLimit: e.jsHeapSizeLimit,
    });

    logMeasurement(
      `dashboard.${interactionType}`,
      {
        duration: e.duration,
        networkDuration: e.networkDuration,
        totalJSHeapSize: e.totalJSHeapSize,
        usedJSHeapSize: e.usedJSHeapSize,
        jsHeapSizeLimit: e.jsHeapSizeLimit,
        timeSinceBoot: performance.measure('time_since_boot', 'frontend_boot_js_done_time_seconds').duration,
      },
      { dashboard: uid, title: title }
    );
  };
}
