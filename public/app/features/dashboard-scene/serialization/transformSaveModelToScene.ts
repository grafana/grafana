import { uniqueId } from 'lodash';

import { DataFrameDTO, DataFrameJSON, TypedVariableModel } from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  VizPanel,
  SceneTimePicker,
  SceneGridLayout,
  SceneGridRow,
  SceneTimeRange,
  SceneVariableSet,
  VariableValueSelectors,
  SceneVariable,
  CustomVariable,
  DataSourceVariable,
  QueryVariable,
  ConstantVariable,
  IntervalVariable,
  SceneRefreshPicker,
  SceneObject,
  VizPanelMenu,
  behaviors,
  VizPanelState,
  SceneGridItemLike,
  SceneDataLayerProvider,
  SceneDataLayerControls,
  TextBoxVariable,
  UserActionEvent,
  GroupByVariable,
  AdHocFiltersVariable,
} from '@grafana/scenes';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { DashboardDTO, DashboardDataDTO } from 'app/types';

import { AlertStatesDataLayer } from '../scene/AlertStatesDataLayer';
import { DashboardAnnotationsDataLayer } from '../scene/DashboardAnnotationsDataLayer';
import { DashboardControls } from '../scene/DashboardControls';
import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
import { DashboardGridItem, RepeatDirection } from '../scene/DashboardGridItem';
import { registerDashboardMacro } from '../scene/DashboardMacro';
import { DashboardScene } from '../scene/DashboardScene';
import { LibraryVizPanel } from '../scene/LibraryVizPanel';
import { VizPanelLinks, VizPanelLinksMenu } from '../scene/PanelLinks';
import { panelLinksBehavior, panelMenuBehavior } from '../scene/PanelMenuBehavior';
import { PanelNotices } from '../scene/PanelNotices';
import { PanelTimeRange } from '../scene/PanelTimeRange';
import { RowRepeaterBehavior } from '../scene/RowRepeaterBehavior';
import { RowActions } from '../scene/row-actions/RowActions';
import { setDashboardPanelContext } from '../scene/setDashboardPanelContext';
import { createPanelDataProvider } from '../utils/createPanelDataProvider';
import { preserveDashboardSceneStateInLocalStorage } from '../utils/dashboardSessionState';
import { DashboardInteractions } from '../utils/interactions';
import {
  getCurrentValueForOldIntervalModel,
  getDashboardSceneFor,
  getIntervalsFromQueryString,
  getVizPanelKeyForPanelId,
} from '../utils/utils';

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

          currentRow = panel;
          currentRowPanels = [];
        }
      }
    } else if (panel.libraryPanel?.uid && !('model' in panel.libraryPanel)) {
      const gridItem = buildGridItemForLibPanel(panel);

      if (!gridItem) {
        continue;
      }

      if (currentRow) {
        currentRowPanels.push(gridItem);
      } else {
        panels.push(gridItem);
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

        if (saveModel.libraryPanel?.uid && !('model' in saveModel.libraryPanel)) {
          const gridItem = buildGridItemForLibPanel(saveModel);

          if (!gridItem) {
            throw new Error('Failed to build grid item for library panel');
          }

          return gridItem;
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

  if (oldModel.templating?.list?.length) {
    const variableObjects = oldModel.templating.list
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

    variables = new SceneVariableSet({
      variables: variableObjects,
    });
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

  const dashboardScene = new DashboardScene({
    description: oldModel.description,
    editable: oldModel.editable,
    preload: dto.preload ?? false,
    id: oldModel.id,
    isDirty: false,
    links: oldModel.links || [],
    meta: oldModel.meta,
    tags: oldModel.tags || [],
    title: oldModel.title,
    uid: oldModel.uid,
    version: oldModel.version,
    body: new SceneGridLayout({
      isLazy: dto.preload ? false : true,
      children: createSceneObjectsForPanels(oldModel.panels),
      $behaviors: [trackIfEmpty],
    }),
    $timeRange: new SceneTimeRange({
      from: oldModel.time.from,
      to: oldModel.time.to,
      fiscalYearStartMonth: oldModel.fiscalYearStartMonth,
      timeZone: oldModel.timezone,
      weekStart: oldModel.weekStart,
      UNSAFE_nowDelay: oldModel.timepicker?.nowDelay,
    }),
    $variables: variables,
    $behaviors: [
      new behaviors.CursorSync({
        sync: oldModel.graphTooltip,
      }),
      new behaviors.SceneQueryController(),
      registerDashboardMacro,
      registerPanelInteractionsReporter,
      new behaviors.LiveNowTimer({ enabled: oldModel.liveNow }),
      preserveDashboardSceneStateInLocalStorage,
    ],
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

export function createSceneVariableFromVariableModel(variable: TypedVariableModel): SceneVariable {
  const commonProperties = {
    name: variable.name,
    label: variable.label,
    description: variable.description,
  };
  if (variable.type === 'adhoc') {
    return new AdHocFiltersVariable({
      ...commonProperties,
      description: variable.description,
      skipUrlSync: variable.skipUrlSync,
      hide: variable.hide,
      datasource: variable.datasource,
      applyMode: 'auto',
      filters: variable.filters ?? [],
      baseFilters: variable.baseFilters ?? [],
      defaultKeys: variable.defaultKeys,
      useQueriesAsFilterForOptions: true,
    });
  }
  if (variable.type === 'custom') {
    return new CustomVariable({
      ...commonProperties,
      value: variable.current?.value ?? '',
      text: variable.current?.text ?? '',

      query: variable.query,
      isMulti: variable.multi,
      allValue: variable.allValue || undefined,
      includeAll: variable.includeAll,
      defaultToAll: Boolean(variable.includeAll),
      skipUrlSync: variable.skipUrlSync,
      hide: variable.hide,
    });
  } else if (variable.type === 'query') {
    return new QueryVariable({
      ...commonProperties,
      value: variable.current?.value ?? '',
      text: variable.current?.text ?? '',

      query: variable.query,
      datasource: variable.datasource,
      sort: variable.sort,
      refresh: variable.refresh,
      regex: variable.regex,
      allValue: variable.allValue || undefined,
      includeAll: variable.includeAll,
      defaultToAll: Boolean(variable.includeAll),
      isMulti: variable.multi,
      skipUrlSync: variable.skipUrlSync,
      hide: variable.hide,
      definition: variable.definition,
    });
  } else if (variable.type === 'datasource') {
    return new DataSourceVariable({
      ...commonProperties,
      value: variable.current?.value ?? '',
      text: variable.current?.text ?? '',
      regex: variable.regex,
      pluginId: variable.query,
      allValue: variable.allValue || undefined,
      includeAll: variable.includeAll,
      defaultToAll: Boolean(variable.includeAll),
      skipUrlSync: variable.skipUrlSync,
      isMulti: variable.multi,
      hide: variable.hide,
    });
  } else if (variable.type === 'interval') {
    const intervals = getIntervalsFromQueryString(variable.query);
    const currentInterval = getCurrentValueForOldIntervalModel(variable, intervals);
    return new IntervalVariable({
      ...commonProperties,
      value: currentInterval,
      intervals: intervals,
      autoEnabled: variable.auto,
      autoStepCount: variable.auto_count,
      autoMinInterval: variable.auto_min,
      refresh: variable.refresh,
      skipUrlSync: variable.skipUrlSync,
      hide: variable.hide,
    });
  } else if (variable.type === 'constant') {
    return new ConstantVariable({
      ...commonProperties,
      value: variable.query,
      skipUrlSync: variable.skipUrlSync,
      hide: variable.hide,
    });
  } else if (variable.type === 'textbox') {
    let val;
    if (!variable?.current?.value) {
      val = variable.query;
    } else {
      if (typeof variable.current.value === 'string') {
        val = variable.current.value;
      } else {
        val = variable.current.value[0];
      }
    }

    return new TextBoxVariable({
      ...commonProperties,
      value: val,
      skipUrlSync: variable.skipUrlSync,
      hide: variable.hide,
    });
  } else if (config.featureToggles.groupByVariable && variable.type === 'groupby') {
    return new GroupByVariable({
      ...commonProperties,
      datasource: variable.datasource,
      value: variable.current?.value || [],
      text: variable.current?.text || [],
      skipUrlSync: variable.skipUrlSync,
      hide: variable.hide,
      // @ts-expect-error
      defaultOptions: variable.options,
    });
  } else {
    throw new Error(`Scenes: Unsupported variable type ${variable.type}`);
  }
}

export function buildGridItemForLibPanel(panel: PanelModel) {
  if (!panel.libraryPanel) {
    return null;
  }

  const body = new LibraryVizPanel({
    title: panel.title,
    uid: panel.libraryPanel.uid,
    name: panel.libraryPanel.name,
    panelKey: getVizPanelKeyForPanelId(panel.id),
  });

  return new DashboardGridItem({
    key: `grid-item-${panel.id}`,
    y: panel.gridPos.y,
    x: panel.gridPos.x,
    width: panel.gridPos.w,
    height: panel.gridPos.h,
    itemHeight: panel.gridPos.h,
    body,
  });
}

export function buildGridItemForPanel(panel: PanelModel): DashboardGridItem {
  const repeatOptions: Partial<{ variableName: string; repeatDirection: RepeatDirection }> = panel.repeat
    ? {
        variableName: panel.repeat,
        repeatDirection: panel.repeatDirection === 'h' ? 'h' : 'v',
      }
    : {};

  const titleItems: SceneObject[] = [];

  titleItems.push(
    new VizPanelLinks({
      rawLinks: panel.links,
      menu: new VizPanelLinksMenu({ $behaviors: [panelLinksBehavior] }),
    })
  );

  titleItems.push(new PanelNotices());

  const vizPanelState: VizPanelState = {
    key: getVizPanelKeyForPanelId(panel.id),
    title: panel.title,
    description: panel.description,
    pluginId: panel.type,
    options: panel.options ?? {},
    fieldConfig: panel.fieldConfig,
    pluginVersion: panel.pluginVersion,
    displayMode: panel.transparent ? 'transparent' : undefined,
    // To be replaced with it's own option persited option instead derived
    hoverHeader: !panel.title && !panel.timeFrom && !panel.timeShift,
    hoverHeaderOffset: 0,
    $data: createPanelDataProvider(panel),
    titleItems,

    extendPanelContext: setDashboardPanelContext,
    _UNSAFE_customMigrationHandler: getAngularPanelMigrationHandler(panel),
  };

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

function registerPanelInteractionsReporter(scene: DashboardScene) {
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
      case 'panel-menu-shown':
        DashboardInteractions.panelMenuShown();
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
