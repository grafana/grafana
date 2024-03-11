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
  SceneGridItem,
  SceneObject,
  VizPanelMenu,
  behaviors,
  VizPanelState,
  SceneGridItemLike,
  SceneDataLayers,
  SceneDataLayerProvider,
  SceneDataLayerControls,
  TextBoxVariable,
  UserActionEvent,
  GroupByVariable,
  AdHocFiltersVariable,
  SceneFlexLayout,
} from '@grafana/scenes';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { trackDashboardLoaded } from 'app/features/dashboard/utils/tracking';
import { DashboardDTO } from 'app/types';

import { AddLibraryPanelWidget } from '../scene/AddLibraryPanelWidget';
import { AlertStatesDataLayer } from '../scene/AlertStatesDataLayer';
import { DashboardAnnotationsDataLayer } from '../scene/DashboardAnnotationsDataLayer';
import { DashboardControls } from '../scene/DashboardControls';
import { registerDashboardMacro } from '../scene/DashboardMacro';
import { DashboardScene } from '../scene/DashboardScene';
import { LibraryVizPanel } from '../scene/LibraryVizPanel';
import { VizPanelLinks, VizPanelLinksMenu } from '../scene/PanelLinks';
import { panelLinksBehavior, panelMenuBehavior } from '../scene/PanelMenuBehavior';
import { PanelNotices } from '../scene/PanelNotices';
import { PanelRepeaterGridItem } from '../scene/PanelRepeaterGridItem';
import { PanelTimeRange } from '../scene/PanelTimeRange';
import { RowRepeaterBehavior } from '../scene/RowRepeaterBehavior';
import { setDashboardPanelContext } from '../scene/setDashboardPanelContext';
import { createPanelDataProvider } from '../utils/createPanelDataProvider';
import { DashboardInteractions } from '../utils/interactions';
import {
  getCurrentValueForOldIntervalModel,
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

  const scene = createDashboardSceneFromDashboardModel(oldModel);
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
    } else if (panel.type === 'add-library-panel') {
      const gridItem = buildGridItemForLibraryPanelWidget(panel);

      if (!gridItem) {
        continue;
      }

      if (currentRow) {
        currentRowPanels.push(gridItem);
      } else {
        panels.push(gridItem);
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

        if (saveModel.type === 'add-library-panel') {
          const gridItem = buildGridItemForLibraryPanelWidget(saveModel);

          if (!gridItem) {
            throw new Error('Failed to build grid item for library panel widget');
          }

          return gridItem;
        } else if (saveModel.libraryPanel?.uid && !('model' in saveModel.libraryPanel)) {
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
    children = [];
    behaviors = [
      new RowRepeaterBehavior({
        variableName: row.repeat,
        sources: content,
      }),
    ];
  }

  return new SceneGridRow({
    key: getVizPanelKeyForPanelId(row.id),
    title: row.title,
    y: row.gridPos.y,
    isCollapsed: row.collapsed,
    children: children,
    $behaviors: behaviors,
  });
}

export function createDashboardSceneFromDashboardModel(oldModel: DashboardModel) {
  let variables: SceneVariableSet | undefined = undefined;
  let layers: SceneDataLayerProvider[] = [];

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
    layers = oldModel.annotations?.list.map((a) => {
      // Each annotation query is an individual data layer
      return new DashboardAnnotationsDataLayer({
        key: `annotations-${a.name}`,
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
    layers.push(
      new AlertStatesDataLayer({
        key: 'alert-states',
        name: 'Alert States',
      })
    );
  }

  const dashboardScene = new DashboardScene({
    title: oldModel.title,
    tags: oldModel.tags || [],
    links: oldModel.links || [],
    uid: oldModel.uid,
    id: oldModel.id,
    description: oldModel.description,
    editable: oldModel.editable,
    isDirty: oldModel.meta.isNew,
    isEditing: oldModel.meta.isNew,
    meta: oldModel.meta,
    version: oldModel.version,
    body: new SceneGridLayout({
      isLazy: true,
      children: createSceneObjectsForPanels(oldModel.panels),
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
      registerDashboardSceneTracking(oldModel),
      registerPanelInteractionsReporter,
      trackIfIsEmpty,
    ],
    $data:
      layers.length > 0
        ? new SceneDataLayers({
            layers,
          })
        : undefined,
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
    return new TextBoxVariable({
      ...commonProperties,
      value: variable?.current?.value?.[0] ?? variable.query,
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

export function buildGridItemForLibraryPanelWidget(panel: PanelModel) {
  if (panel.type !== 'add-library-panel') {
    return null;
  }

  const body = new AddLibraryPanelWidget({
    key: getVizPanelKeyForPanelId(panel.id),
  });

  return new SceneGridItem({
    body,
    y: panel.gridPos.y,
    x: panel.gridPos.x,
    width: panel.gridPos.w,
    height: panel.gridPos.h,
  });
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

  return new SceneGridItem({
    body,
    y: panel.gridPos.y,
    x: panel.gridPos.x,
    width: panel.gridPos.w,
    height: panel.gridPos.h,
  });
}

export function buildGridItemForPanel(panel: PanelModel): SceneGridItemLike {
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
    $data: createPanelDataProvider(panel),
    menu: new VizPanelMenu({
      $behaviors: [panelMenuBehavior],
    }),
    titleItems,

    extendPanelContext: setDashboardPanelContext,
    _UNSAFE_customMigrationHandler: getAngularPanelMigrationHandler(panel),
  };

  if (panel.timeFrom || panel.timeShift) {
    vizPanelState.$timeRange = new PanelTimeRange({
      timeFrom: panel.timeFrom,
      timeShift: panel.timeShift,
      hideTimeOverride: panel.hideTimeOverride,
    });
  }

  if (panel.repeat) {
    const repeatDirection = panel.repeatDirection === 'h' ? 'h' : 'v';

    return new PanelRepeaterGridItem({
      key: `grid-item-${panel.id}`,
      x: panel.gridPos.x,
      y: panel.gridPos.y,
      width: repeatDirection === 'h' ? 24 : panel.gridPos.w,
      height: panel.gridPos.h,
      itemHeight: panel.gridPos.h,
      source: new VizPanel(vizPanelState),
      variableName: panel.repeat,
      repeatedPanels: [],
      repeatDirection: repeatDirection,
      maxPerRow: panel.maxPerRow,
    });
  }

  const body = new VizPanel(vizPanelState);

  return new SceneGridItem({
    key: `grid-item-${panel.id}`,
    x: panel.gridPos.x,
    y: panel.gridPos.y,
    width: panel.gridPos.w,
    height: panel.gridPos.h,
    body,
  });
}

const getLimitedDescriptionReporter = () => {
  const reportedPanels: string[] = [];

  return (key: string) => {
    if (reportedPanels.includes(key)) {
      return;
    }
    reportedPanels.push(key);
    DashboardInteractions.panelDescriptionShown();
  };
};

function registerDashboardSceneTracking(model: DashboardModel) {
  return () => {
    const unsetDashboardInteractionsScenesContext = DashboardInteractions.setScenesContext();

    trackDashboardLoaded(model, model.version);

    return () => {
      unsetDashboardInteractionsScenesContext();
    };
  };
}

function registerPanelInteractionsReporter(scene: DashboardScene) {
  const descriptionReporter = getLimitedDescriptionReporter();

  // Subscriptions set with subscribeToEvent are automatically unsubscribed when the scene deactivated
  scene.subscribeToEvent(UserActionEvent, (e) => {
    const { interaction } = e.payload;
    switch (interaction) {
      case 'panel-description-shown':
        descriptionReporter(e.payload.origin.state.key || '');
        break;
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

export function trackIfIsEmpty(parent: DashboardScene) {
  updateIsEmpty(parent);

  parent.state.body.subscribeToState(() => {
    updateIsEmpty(parent);
  });
}

function updateIsEmpty(parent: DashboardScene) {
  const { body } = parent.state;
  if (body instanceof SceneFlexLayout || body instanceof SceneGridLayout) {
    parent.setState({ isEmpty: body.state.children.length === 0 });
  }
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
