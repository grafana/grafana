import { LoadingState } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { config } from '@grafana/runtime';
import {
  AdHocFiltersVariable,
  behaviors,
  ConstantVariable,
  SceneDataLayerControls,
  SceneDataTransformer,
  SceneGridLayout,
  SceneGridRow,
  SceneQueryRunner,
  VizPanel,
} from '@grafana/scenes';
import {
  DashboardCursorSync,
  defaultDashboard,
  defaultTimePickerConfig,
  Panel,
  RowPanel,
  VariableType,
} from '@grafana/schema';
import { contextSrv } from 'app/core/core';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { createPanelSaveModel } from 'app/features/dashboard/state/__fixtures__/dashboardFixtures';
import { SHARED_DASHBOARD_QUERY, DASHBOARD_DATASOURCE_PLUGIN_ID } from 'app/plugins/datasource/dashboard/constants';
import { DashboardDataDTO } from 'app/types';

import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
import { LibraryPanelBehavior } from '../scene/LibraryPanelBehavior';
import { PanelTimeRange } from '../scene/PanelTimeRange';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { RowRepeaterBehavior } from '../scene/layout-default/RowRepeaterBehavior';
import { NEW_LINK } from '../settings/links/utils';
import { getQueryRunnerFor } from '../utils/utils';

import { buildNewDashboardSaveModel } from './buildNewDashboardSaveModel';
import { GRAFANA_DATASOURCE_REF } from './const';
import { SnapshotVariable } from './custom-variables/SnapshotVariable';
import dashboard_to_load1 from './testfiles/dashboard_to_load1.json';
import repeatingRowsAndPanelsDashboardJson from './testfiles/repeating_rows_and_panels.json';
import {
  createDashboardSceneFromDashboardModel,
  buildGridItemForPanel,
  transformSaveModelToScene,
  convertOldSnapshotToScenesSnapshot,
} from './transformSaveModelToScene';

describe('transformSaveModelToScene', () => {
  describe('when creating dashboard scene', () => {
    it('should initialize the DashboardScene with the model state', () => {
      const dash = {
        ...defaultDashboard,
        title: 'test',
        uid: 'test-uid',
        time: { from: 'now-10h', to: 'now' },
        weekStart: 'saturday',
        fiscalYearStartMonth: 2,
        timezone: 'America/New_York',
        timepicker: {
          ...defaultTimePickerConfig,
          hidden: true,
        },
        links: [{ ...NEW_LINK, title: 'Link 1' }],
        templating: {
          list: [
            {
              hide: 2,
              name: 'constant',
              skipUrlSync: false,
              type: 'constant' as VariableType,
              query: 'test',
              id: 'constant',
              global: false,
              index: 3,
              state: LoadingState.Done,
              error: null,
              description: '',
              datasource: null,
            },
            {
              hide: 2,
              name: 'CoolFilters',
              type: 'adhoc' as VariableType,
              datasource: { uid: 'gdev-prometheus', type: 'prometheus' },
              id: 'adhoc',
              global: false,
              skipUrlSync: false,
              index: 3,
              state: LoadingState.Done,
              error: null,
              description: '',
            },
          ],
        },
      };
      const oldModel = new DashboardModel(dash);

      const scene = createDashboardSceneFromDashboardModel(oldModel, dash);
      const dashboardControls = scene.state.controls!;

      expect(scene.state.title).toBe('test');
      expect(scene.state.uid).toBe('test-uid');
      expect(scene.state.links).toHaveLength(1);
      expect(scene.state.links![0].title).toBe('Link 1');
      expect(scene.state?.$timeRange?.state.value.raw).toEqual(dash.time);
      expect(scene.state?.$timeRange?.state.fiscalYearStartMonth).toEqual(2);
      expect(scene.state?.$timeRange?.state.timeZone).toEqual('America/New_York');
      expect(scene.state?.$timeRange?.state.weekStart).toEqual('saturday');

      expect(scene.state?.$variables?.state.variables).toHaveLength(2);
      expect(scene.state?.$variables?.getByName('constant')).toBeInstanceOf(ConstantVariable);
      expect(scene.state?.$variables?.getByName('CoolFilters')).toBeInstanceOf(AdHocFiltersVariable);
      expect(
        (scene.state?.$variables?.getByName('CoolFilters') as AdHocFiltersVariable).state.useQueriesAsFilterForOptions
      ).toBe(true);
      expect(dashboardControls).toBeDefined();

      expect(dashboardControls.state.refreshPicker.state.intervals).toEqual(defaultTimePickerConfig.refresh_intervals);
      expect(dashboardControls.state.hideTimeControls).toBe(true);
    });

    it('should apply cursor sync behavior', () => {
      const dash = {
        ...defaultDashboard,
        title: 'Test dashboard',
        uid: 'test-uid',
        graphTooltip: DashboardCursorSync.Crosshair,
      };
      const oldModel = new DashboardModel(dash);

      const scene = createDashboardSceneFromDashboardModel(oldModel, dash);

      const cursorSync = scene.state.$behaviors?.find((b) => b instanceof behaviors.CursorSync);
      expect(cursorSync).toBeInstanceOf(behaviors.CursorSync);
      expect((cursorSync as behaviors.CursorSync).state.sync).toEqual(DashboardCursorSync.Crosshair);
    });

    it('should apply live now timer behavior', () => {
      const dash = {
        ...defaultDashboard,
        title: 'Test dashboard',
        uid: 'test-uid',
      };
      const oldModel = new DashboardModel(dash);
      const scene = createDashboardSceneFromDashboardModel(oldModel, dash);

      const liveNowTimer = scene.state.$behaviors?.find((b) => b instanceof behaviors.LiveNowTimer);
      expect(liveNowTimer).toBeInstanceOf(behaviors.LiveNowTimer);
    });

    it('should initialize the Dashboard Scene with empty template variables', () => {
      const dash = {
        ...defaultDashboard,
        title: 'test empty dashboard with no variables',
        uid: 'test-uid',
        time: { from: 'now-10h', to: 'now' },
        weekStart: 'saturday',
        fiscalYearStartMonth: 2,
        timezone: 'America/New_York',
        templating: {
          list: [],
        },
      };
      const oldModel = new DashboardModel(dash);

      const scene = createDashboardSceneFromDashboardModel(oldModel, dash);
      expect(scene.state.$variables?.state.variables).toBeDefined();
    });

    it('should not return lazy loaded panels when user is image renderer', () => {
      contextSrv.user.authenticatedBy = 'render';

      const panel1 = createPanelSaveModel({
        title: 'test1',
        gridPos: { x: 0, y: 1, w: 12, h: 8 },
      }) as Panel;

      const panel2 = createPanelSaveModel({
        title: 'test2',
        gridPos: { x: 0, y: 10, w: 12, h: 8 },
      }) as Panel;

      const dashboard = {
        ...defaultDashboard,
        title: 'Test dashboard',
        uid: 'test-uid',
        panels: [panel1, panel2],
      };

      const oldModel = new DashboardModel(dashboard);

      const scene = createDashboardSceneFromDashboardModel(oldModel, dashboard);
      const layout = scene.state.body as DefaultGridLayoutManager;
      const body = layout.state.grid;

      expect(body.state.isLazy).toBeFalsy();
    });
  });

  describe('When creating a new dashboard', () => {
    it('should initialize the DashboardScene in edit mode and dirty', async () => {
      const rsp = await buildNewDashboardSaveModel();
      const scene = transformSaveModelToScene(rsp);
      expect(scene.state.isEditing).toBe(undefined);
      expect(scene.state.isDirty).toBe(false);
    });
  });

  describe('When creating a snapshot dashboard scene', () => {
    it('should initialize a dashboard scene with SnapshotVariables', () => {
      const customVariable = {
        current: {
          selected: false,
          text: 'a',
          value: 'a',
        },
        hide: 0,
        includeAll: false,
        multi: false,
        name: 'custom0',
        options: [],
        query: 'a,b,c,d',
        skipUrlSync: false,
        type: 'custom' as VariableType,
        rootStateKey: 'N4XLmH5Vz',
      };

      const intervalVariable = {
        current: {
          selected: false,
          text: '10s',
          value: '10s',
        },
        hide: 0,
        includeAll: false,
        multi: false,
        name: 'interval0',
        options: [],
        query: '10s,20s,30s',
        skipUrlSync: false,
        type: 'interval' as VariableType,
        rootStateKey: 'N4XLmH5Vz',
      };

      const adHocVariable = {
        global: false,
        name: 'CoolFilters',
        label: 'CoolFilters Label',
        type: 'adhoc' as VariableType,
        datasource: {
          uid: 'gdev-prometheus',
          type: 'prometheus',
        },
        filters: [
          {
            key: 'filterTest',
            operator: '=',
            value: 'test',
          },
        ],
        baseFilters: [
          {
            key: 'baseFilterTest',
            operator: '=',
            value: 'test',
          },
        ],
        hide: 0,
        index: 0,
      };

      const snapshot = {
        ...defaultDashboard,
        title: 'snapshot dash',
        uid: 'test-uid',
        time: { from: 'now-10h', to: 'now' },
        weekStart: 'saturday',
        fiscalYearStartMonth: 2,
        timezone: 'America/New_York',
        timepicker: {
          ...defaultTimePickerConfig,
          hidden: true,
        },
        links: [{ ...NEW_LINK, title: 'Link 1' }],
        templating: {
          list: [customVariable, adHocVariable, intervalVariable],
        },
      };

      const oldModel = new DashboardModel(snapshot, { isSnapshot: true });
      const scene = createDashboardSceneFromDashboardModel(oldModel, snapshot);

      // check variables were converted to snapshot variables
      expect(scene.state.$variables?.state.variables).toHaveLength(3);
      expect(scene.state.$variables?.getByName('custom0')).toBeInstanceOf(SnapshotVariable);
      expect(scene.state.$variables?.getByName('CoolFilters')).toBeInstanceOf(AdHocFiltersVariable);
      expect(scene.state.$variables?.getByName('interval0')).toBeInstanceOf(SnapshotVariable);
      // custom snapshot
      const customSnapshot = scene.state.$variables?.getByName('custom0') as SnapshotVariable;
      expect(customSnapshot.state.value).toBe('a');
      expect(customSnapshot.state.text).toBe('a');
      expect(customSnapshot.state.isReadOnly).toBe(true);
      // adhoc snapshot
      const adhocSnapshot = scene.state.$variables?.getByName('CoolFilters') as AdHocFiltersVariable;
      expect(adhocSnapshot.state.filters).toEqual(adHocVariable.filters);
      expect(adhocSnapshot.state.readOnly).toBe(true);

      // interval snapshot
      const intervalSnapshot = scene.state.$variables?.getByName('interval0') as SnapshotVariable;
      expect(intervalSnapshot.state.value).toBe('10s');
      expect(intervalSnapshot.state.text).toBe('10s');
      expect(intervalSnapshot.state.isReadOnly).toBe(true);
    });
  });

  describe('when organizing panels as scene children', () => {
    it('should leave panels outside second row if it is collapsed', () => {
      const panel1 = createPanelSaveModel({
        title: 'test1',
        gridPos: { x: 0, y: 1, w: 12, h: 8 },
      }) as Panel;

      const panel2 = createPanelSaveModel({
        title: 'test2',
        gridPos: { x: 0, y: 10, w: 12, h: 8 },
      }) as Panel;

      const row1 = createPanelSaveModel({
        title: 'test row 1',
        type: 'row',
        gridPos: { x: 0, y: 0, w: 12, h: 1 },
        collapsed: false,
        panels: [],
      }) as unknown as RowPanel;

      const row2 = createPanelSaveModel({
        title: 'test row 2',
        type: 'row',
        gridPos: { x: 0, y: 9, w: 12, h: 1 },
        collapsed: true,
        panels: [],
      }) as unknown as RowPanel;

      const dashboard = {
        ...defaultDashboard,
        title: 'Test dashboard',
        uid: 'test-uid',
        panels: [row1, panel1, row2, panel2],
      };

      const oldModel = new DashboardModel(dashboard);

      const scene = createDashboardSceneFromDashboardModel(oldModel, dashboard);
      const layout = scene.state.body as DefaultGridLayoutManager;
      const body = layout.state.grid;

      expect(body.state.children).toHaveLength(3);
      const rowScene1 = body.state.children[0] as SceneGridRow;
      expect(rowScene1).toBeInstanceOf(SceneGridRow);
      expect(rowScene1.state.title).toEqual(row1.title);
      expect(rowScene1.state.isCollapsed).toEqual(row1.collapsed);
      expect(rowScene1.state.children).toHaveLength(1);
      expect(rowScene1.state.children[0]).toBeInstanceOf(DashboardGridItem);

      const rowScene2 = body.state.children[1] as SceneGridRow;
      expect(rowScene2).toBeInstanceOf(SceneGridRow);
      expect(rowScene2.state.title).toEqual(row2.title);
      expect(rowScene2.state.isCollapsed).toEqual(row2.collapsed);
      expect(rowScene2.state.children).toHaveLength(0);

      expect(body.state.children[2]).toBeInstanceOf(DashboardGridItem);
    });

    it('should create panels within collapsed rows', () => {
      const panel = createPanelSaveModel({
        title: 'test',
        gridPos: { x: 1, y: 0, w: 12, h: 8 },
      }) as Panel;

      const libPanel = createPanelSaveModel({
        title: 'Library Panel',
        gridPos: { x: 0, y: 0, w: 12, h: 8 },
        libraryPanel: {
          uid: '123',
          name: 'My Panel',
        },
      });

      const row = createPanelSaveModel({
        title: 'test',
        type: 'row',
        gridPos: { x: 0, y: 0, w: 12, h: 1 },
        collapsed: true,
        panels: [panel, libPanel],
      }) as unknown as RowPanel;

      const dashboard = {
        ...defaultDashboard,
        title: 'Test dashboard',
        uid: 'test-uid',
        panels: [row],
      };

      const oldModel = new DashboardModel(dashboard);

      const scene = createDashboardSceneFromDashboardModel(oldModel, dashboard);
      const layout = scene.state.body as DefaultGridLayoutManager;
      const body = layout.state.grid;

      expect(body.state.children).toHaveLength(1);
      const rowScene = body.state.children[0] as SceneGridRow;
      expect(rowScene).toBeInstanceOf(SceneGridRow);
      expect(rowScene.state.title).toEqual(row.title);
      expect(rowScene.state.y).toEqual(row.gridPos!.y);
      expect(rowScene.state.isCollapsed).toEqual(row.collapsed);
      expect(rowScene.state.children).toHaveLength(2);
      expect(rowScene.state.children[0]).toBeInstanceOf(DashboardGridItem);
      expect(rowScene.state.children[1]).toBeInstanceOf(DashboardGridItem);
      // Panels are sorted by position in the row
      expect((rowScene.state.children[0] as DashboardGridItem).state.body.state.$behaviors![0]).toBeInstanceOf(
        LibraryPanelBehavior
      );
      expect((rowScene.state.children[1] as DashboardGridItem).state.body!).toBeInstanceOf(VizPanel);
    });

    it('should create panels within expanded row', () => {
      const panelOutOfRow = createPanelSaveModel({
        title: 'Out of a row',
        gridPos: {
          h: 8,
          w: 12,
          x: 0,
          y: 0,
        },
      });

      const libPanelOutOfRow = createPanelSaveModel({
        title: 'Library Panel',
        gridPos: { x: 0, y: 8, w: 12, h: 8 },
        libraryPanel: {
          uid: '123',
          name: 'My Panel',
        },
      });

      const rowWithPanel = createPanelSaveModel({
        title: 'Row with panel',
        type: 'row',
        id: 10,
        collapsed: false,
        gridPos: {
          h: 1,
          w: 24,
          x: 0,
          y: 16,
        },
        // This panels array is not used if the row is not collapsed
        panels: [],
      });

      const panelInRow = createPanelSaveModel({
        gridPos: {
          h: 8,
          w: 12,
          x: 0,
          y: 17,
        },
        title: 'In row 1',
      });

      const libPanelInRow = createPanelSaveModel({
        title: 'Library Panel',
        gridPos: { x: 0, y: 25, w: 12, h: 8 },
        libraryPanel: {
          uid: '123',
          name: 'My Panel',
        },
      });

      const emptyRow = createPanelSaveModel({
        collapsed: false,
        gridPos: {
          h: 1,
          w: 24,
          x: 0,
          y: 26,
        },
        // This panels array is not used if the row is not collapsed
        panels: [],
        title: 'Empty row',
        type: 'row',
      });

      const dashboard = {
        ...defaultDashboard,
        title: 'Test dashboard',
        uid: 'test-uid',
        panels: [panelOutOfRow, libPanelOutOfRow, rowWithPanel, panelInRow, libPanelInRow, emptyRow],
      };

      const oldModel = new DashboardModel(dashboard);

      const scene = createDashboardSceneFromDashboardModel(oldModel, dashboard);
      const layout = scene.state.body as DefaultGridLayoutManager;
      const body = layout.state.grid;

      expect(body.state.children).toHaveLength(4);
      expect(body).toBeInstanceOf(SceneGridLayout);
      // Panel out of row
      expect(body.state.children[0]).toBeInstanceOf(DashboardGridItem);
      const panelOutOfRowVizPanel = body.state.children[0] as DashboardGridItem;
      expect((panelOutOfRowVizPanel.state.body as VizPanel)?.state.title).toBe(panelOutOfRow.title);
      // lib panel out of row
      expect(body.state.children[1]).toBeInstanceOf(DashboardGridItem);
      const panelOutOfRowLibVizPanel = body.state.children[1] as DashboardGridItem;
      expect(panelOutOfRowLibVizPanel.state.body.state.$behaviors![0]).toBeInstanceOf(LibraryPanelBehavior);
      // Row with panels
      expect(body.state.children[2]).toBeInstanceOf(SceneGridRow);
      const rowWithPanelsScene = body.state.children[2] as SceneGridRow;
      expect(rowWithPanelsScene.state.title).toBe(rowWithPanel.title);
      expect(rowWithPanelsScene.state.key).toBe('panel-10');
      expect(rowWithPanelsScene.state.children).toHaveLength(2);
      const libPanel = rowWithPanelsScene.state.children[1] as DashboardGridItem;
      expect(libPanel.state.body.state.$behaviors![0]).toBeInstanceOf(LibraryPanelBehavior);
      // Panel within row
      expect(rowWithPanelsScene.state.children[0]).toBeInstanceOf(DashboardGridItem);
      const panelInRowVizPanel = rowWithPanelsScene.state.children[0] as DashboardGridItem;
      expect((panelInRowVizPanel.state.body as VizPanel).state.title).toBe(panelInRow.title);
      // Empty row
      expect(body.state.children[3]).toBeInstanceOf(SceneGridRow);
      const emptyRowScene = body.state.children[3] as SceneGridRow;
      expect(emptyRowScene.state.title).toBe(emptyRow.title);
      expect(emptyRowScene.state.children).toHaveLength(0);
    });
  });

  describe('when creating viz panel objects', () => {
    it('should initalize the VizPanel scene object state', () => {
      const panel = {
        title: 'test',
        type: 'test-plugin',
        gridPos: { x: 0, y: 0, w: 12, h: 8 },
        maxDataPoints: 100,
        options: {
          fieldOptions: {
            defaults: {
              unit: 'none',
              decimals: 2,
            },
            overrides: [],
          },
        },
        fieldConfig: {
          defaults: {
            unit: 'none',
          },
          overrides: [],
        },
        pluginVersion: '1.0.0',
        transformations: [
          {
            id: 'reduce',
            options: {
              reducers: [
                {
                  id: 'mean',
                },
              ],
            },
          },
        ],
        targets: [
          {
            refId: 'A',
            queryType: 'randomWalk',
          },
        ],
      };

      const { gridItem, vizPanel } = buildGridItemForTest(panel);

      expect(gridItem.state.x).toEqual(0);
      expect(gridItem.state.y).toEqual(0);
      expect(gridItem.state.width).toEqual(12);
      expect(gridItem.state.height).toEqual(8);

      expect(vizPanel.state.title).toBe('test');
      expect(vizPanel.state.pluginId).toBe('test-plugin');
      expect(vizPanel.state.options).toEqual(panel.options);
      expect(vizPanel.state.fieldConfig).toEqual(panel.fieldConfig);
      expect(vizPanel.state.pluginVersion).toBe('1.0.0');

      const queryRunner = getQueryRunnerFor(vizPanel)!;
      expect(queryRunner.state.queries).toEqual(panel.targets);
      expect(queryRunner.state.maxDataPoints).toEqual(100);
      expect(queryRunner.state.maxDataPointsFromWidth).toEqual(true);

      expect((vizPanel.state.$data as SceneDataTransformer)?.state.transformations).toEqual(panel.transformations);
    });

    it('should initalize the VizPanel without title and transparent true', () => {
      const panel = {
        title: '',
        type: 'test-plugin',
        gridPos: { x: 0, y: 0, w: 12, h: 8 },
        transparent: true,
      };

      const { vizPanel } = buildGridItemForTest(panel);

      expect(vizPanel.state.displayMode).toEqual('transparent');
      expect(vizPanel.state.hoverHeader).toEqual(true);
    });

    it('should set hoverHeader to true if timeFrom and hideTimeOverride is true', () => {
      const panel = {
        type: 'test-plugin',
        timeFrom: '2h',
        hideTimeOverride: true,
      };

      const { vizPanel } = buildGridItemForTest(panel);

      expect(vizPanel.state.hoverHeader).toBe(true);
    });

    it('should initalize the VizPanel with min interval set', () => {
      const panel = {
        title: '',
        type: 'test-plugin',
        gridPos: { x: 0, y: 0, w: 12, h: 8 },
        interval: '20m',
      };

      const { vizPanel } = buildGridItemForTest(panel);

      const queryRunner = getQueryRunnerFor(vizPanel);
      expect(queryRunner?.state.minInterval).toBe('20m');
    });

    it('should set PanelTimeRange when timeFrom or timeShift is present', () => {
      const panel = {
        type: 'test-plugin',
        timeFrom: '2h',
        timeShift: '1d',
      };

      const { vizPanel } = buildGridItemForTest(panel);
      const timeRange = vizPanel.state.$timeRange as PanelTimeRange;

      expect(timeRange).toBeInstanceOf(PanelTimeRange);
      expect(timeRange.state.timeFrom).toBe('2h');
      expect(timeRange.state.timeShift).toBe('1d');
    });

    it('should handle a dashboard query data source', () => {
      const panel = {
        title: '',
        type: 'test-plugin',
        datasource: { uid: SHARED_DASHBOARD_QUERY, type: DASHBOARD_DATASOURCE_PLUGIN_ID },
        gridPos: { x: 0, y: 0, w: 12, h: 8 },
        transparent: true,
        targets: [{ refId: 'A', panelId: 10 }],
      };

      const { vizPanel } = buildGridItemForTest(panel);
      expect(vizPanel.state.$data).toBeInstanceOf(SceneDataTransformer);
      expect(vizPanel.state.$data?.state.$data).toBeInstanceOf(SceneQueryRunner);
      expect((vizPanel.state.$data?.state.$data as SceneQueryRunner).state.queries).toEqual(panel.targets);
    });

    it('should not set SceneQueryRunner for plugins with skipDataQuery', () => {
      const panel = {
        title: '',
        type: 'text-plugin-34',
        gridPos: { x: 0, y: 0, w: 12, h: 8 },
        transparent: true,
        targets: [{ refId: 'A' }],
      };

      config.panels['text-plugin-34'] = getPanelPlugin({
        skipDataQuery: true,
      }).meta;

      const { vizPanel } = buildGridItemForTest(panel);

      expect(vizPanel.state.$data).toBeUndefined();
    });

    it('When repeat is set but repeatDirection is not it should default to horizontal repeat', () => {
      const panel = {
        title: '',
        type: 'text-plugin-34',
        gridPos: { x: 0, y: 0, w: 8, h: 8 },
        repeat: 'server',
        maxPerRow: 8,
      };

      const gridItem = buildGridItemForPanel(new PanelModel(panel));
      const repeater = gridItem as DashboardGridItem;

      expect(repeater.state.maxPerRow).toBe(8);
      expect(repeater.state.variableName).toBe('server');
      expect(repeater.state.width).toBe(24);
      expect(repeater.state.height).toBe(8);
      expect(repeater.state.repeatDirection).toBe('h');
      expect(repeater.state.maxPerRow).toBe(8);
    });

    it('When repeat is set should build PanelRepeaterGridItem', () => {
      const panel = {
        title: '',
        type: 'text-plugin-34',
        gridPos: { x: 0, y: 0, w: 8, h: 8 },
        repeat: 'server',
        repeatDirection: 'v',
        maxPerRow: 8,
      };

      const gridItem = buildGridItemForPanel(new PanelModel(panel));
      const repeater = gridItem as DashboardGridItem;

      expect(repeater.state.maxPerRow).toBe(8);
      expect(repeater.state.variableName).toBe('server');
      expect(repeater.state.width).toBe(8);
      expect(repeater.state.height).toBe(8);
      expect(repeater.state.repeatDirection).toBe('v');
      expect(repeater.state.maxPerRow).toBe(8);
    });

    it('When horizontal repeat is set should modify the width to 24', () => {
      const panel = {
        title: '',
        type: 'text-plugin-34',
        gridPos: { x: 0, y: 0, w: 8, h: 8 },
        repeat: 'server',
        repeatDirection: 'h',
        maxPerRow: 8,
      };

      const gridItem = buildGridItemForPanel(new PanelModel(panel));
      const repeater = gridItem as DashboardGridItem;

      expect(repeater.state.maxPerRow).toBe(8);
      expect(repeater.state.variableName).toBe('server');
      expect(repeater.state.width).toBe(24);
      expect(repeater.state.height).toBe(8);
      expect(repeater.state.repeatDirection).toBe('h');
      expect(repeater.state.maxPerRow).toBe(8);
    });

    it('When horizontal repeat is NOT fully configured should not modify the width', () => {
      const panel = {
        title: '',
        type: 'text-plugin-34',
        gridPos: { x: 0, y: 0, w: 8, h: 8 },
        repeatDirection: 'h',
        maxPerRow: 8,
      };

      const gridItem = buildGridItemForPanel(new PanelModel(panel));
      const repeater = gridItem as DashboardGridItem;

      expect(repeater.state.maxPerRow).toBe(8);
      expect(repeater.state.variableName).toBe(undefined);
      expect(repeater.state.width).toBe(8);
      expect(repeater.state.height).toBe(8);
      expect(repeater.state.repeatDirection).toBe(undefined);
      expect(repeater.state.maxPerRow).toBe(8);
    });

    it('should apply query caching options to SceneQueryRunner', () => {
      const panel = {
        title: '',
        type: 'test-plugin',
        gridPos: { x: 0, y: 0, w: 12, h: 8 },
        transparent: true,
        cacheTimeout: '10',
        queryCachingTTL: 200000,
      };

      const { vizPanel } = buildGridItemForTest(panel);
      const runner = getQueryRunnerFor(vizPanel)!;
      expect(runner.state.cacheTimeout).toBe('10');
      expect(runner.state.queryCachingTTL).toBe(200000);
    });

    it('should convert saved lib panel to a viz panel with LibraryPanelBehavior', () => {
      const panel = {
        title: 'Panel',
        gridPos: { x: 0, y: 0, w: 12, h: 8 },
        transparent: true,
        libraryPanel: {
          uid: '123',
          name: 'My Panel',
          folderUid: '456',
        },
      };

      const gridItem = buildGridItemForPanel(new PanelModel(panel))!;
      const libPanelBehavior = gridItem.state.body.state.$behaviors![0];

      expect(libPanelBehavior).toBeInstanceOf(LibraryPanelBehavior);
      expect((libPanelBehavior as LibraryPanelBehavior).state.uid).toEqual(panel.libraryPanel.uid);
      expect((libPanelBehavior as LibraryPanelBehavior).state.name).toEqual(panel.libraryPanel.name);
      expect(gridItem.state.body.state.title).toEqual(panel.title);
    });
  });

  describe('Repeating rows', () => {
    it('Should build correct scene model', () => {
      const scene = transformSaveModelToScene({
        dashboard: repeatingRowsAndPanelsDashboardJson as DashboardDataDTO,
        meta: {},
      });

      const layout = scene.state.body as DefaultGridLayoutManager;
      const body = layout.state.grid;
      const row2 = body.state.children[1] as SceneGridRow;

      expect(row2.state.$behaviors?.[0]).toBeInstanceOf(RowRepeaterBehavior);

      const repeatBehavior = row2.state.$behaviors?.[0] as RowRepeaterBehavior;
      expect(repeatBehavior.state.variableName).toBe('server');

      const lastRow = body.state.children[body.state.children.length - 1] as SceneGridRow;
      expect(lastRow.state.isCollapsed).toBe(true);
    });
  });

  describe('Annotation queries', () => {
    it('Should build correct scene model', () => {
      const scene = transformSaveModelToScene({ dashboard: dashboard_to_load1 as DashboardDataDTO, meta: {} });

      expect(scene.state.$data).toBeInstanceOf(DashboardDataLayerSet);
      expect(scene.state.controls!.state.variableControls[1]).toBeInstanceOf(SceneDataLayerControls);

      const dataLayers = scene.state.$data as DashboardDataLayerSet;
      expect(dataLayers.state.annotationLayers).toHaveLength(4);
      expect(dataLayers.state.annotationLayers[0].state.name).toBe('Annotations & Alerts');
      expect(dataLayers.state.annotationLayers[0].state.isEnabled).toBe(true);
      expect(dataLayers.state.annotationLayers[0].state.isHidden).toBe(false);

      expect(dataLayers.state.annotationLayers[1].state.name).toBe('Enabled');
      expect(dataLayers.state.annotationLayers[1].state.isEnabled).toBe(true);
      expect(dataLayers.state.annotationLayers[1].state.isHidden).toBe(false);

      expect(dataLayers.state.annotationLayers[2].state.name).toBe('Disabled');
      expect(dataLayers.state.annotationLayers[2].state.isEnabled).toBe(false);
      expect(dataLayers.state.annotationLayers[2].state.isHidden).toBe(false);

      expect(dataLayers.state.annotationLayers[3].state.name).toBe('Hidden');
      expect(dataLayers.state.annotationLayers[3].state.isEnabled).toBe(true);
      expect(dataLayers.state.annotationLayers[3].state.isHidden).toBe(true);
    });
  });

  describe('Alerting data layer', () => {
    it('Should add alert states data layer if unified alerting enabled', () => {
      config.unifiedAlertingEnabled = true;
      const scene = transformSaveModelToScene({ dashboard: dashboard_to_load1 as DashboardDataDTO, meta: {} });

      expect(scene.state.$data).toBeInstanceOf(DashboardDataLayerSet);
      expect(scene.state.controls!.state.variableControls[1]).toBeInstanceOf(SceneDataLayerControls);

      const dataLayers = scene.state.$data as DashboardDataLayerSet;
      expect(dataLayers.state.alertStatesLayer).toBeDefined();
    });

    it('Should add alert states data layer if any panel has a legacy alert defined', () => {
      config.unifiedAlertingEnabled = false;
      const dashboard = { ...dashboard_to_load1 } as unknown as DashboardDataDTO;
      dashboard.panels![0].alert = {};
      const scene = transformSaveModelToScene({ dashboard: dashboard_to_load1 as DashboardDataDTO, meta: {} });

      expect(scene.state.$data).toBeInstanceOf(DashboardDataLayerSet);
      expect(scene.state.controls!.state.variableControls[1]).toBeInstanceOf(SceneDataLayerControls);

      const dataLayers = scene.state.$data as DashboardDataLayerSet;
      expect(dataLayers.state.alertStatesLayer).toBeDefined();
    });
  });

  describe('when rendering a legacy snapshot as scene', () => {
    it('should convert snapshotData to snapshot inside targets', () => {
      const panel = createPanelSaveModel({
        title: 'test',
        gridPos: { x: 1, y: 0, w: 12, h: 8 },
        // @ts-ignore
        snapshotData: [
          {
            fields: [
              {
                name: 'Field 1',
                type: 'time',
                values: ['value1', 'value2'],
                config: {},
              },
              {
                name: 'Field 2',
                type: 'number',
                values: [1],
                config: {},
              },
            ],
          },
        ],
      }) as Panel;

      const oldPanelModel = new PanelModel(panel);
      convertOldSnapshotToScenesSnapshot(oldPanelModel);

      expect(oldPanelModel.snapshotData?.length).toStrictEqual(0);
      expect(oldPanelModel.targets.length).toStrictEqual(1);
      expect(oldPanelModel.datasource).toStrictEqual(GRAFANA_DATASOURCE_REF);
      expect(oldPanelModel.targets[0].datasource).toStrictEqual(GRAFANA_DATASOURCE_REF);
      expect(oldPanelModel.targets[0].queryType).toStrictEqual('snapshot');
      // @ts-ignore
      expect(oldPanelModel.targets[0].snapshot.length).toBe(1);
      // @ts-ignore
      expect(oldPanelModel.targets[0].snapshot[0].data.values).toStrictEqual([['value1', 'value2'], [1]]);
      // @ts-ignore
      expect(oldPanelModel.targets[0].snapshot[0].schema.fields).toStrictEqual([
        { config: {}, name: 'Field 1', type: 'time' },
        { config: {}, name: 'Field 2', type: 'number' },
      ]);
    });
  });
});

function buildGridItemForTest(saveModel: Partial<Panel>): { gridItem: DashboardGridItem; vizPanel: VizPanel } {
  const gridItem = buildGridItemForPanel(new PanelModel(saveModel));
  if (gridItem instanceof DashboardGridItem) {
    return { gridItem, vizPanel: gridItem.state.body as VizPanel };
  }

  throw new Error('buildGridItemForPanel to return DashboardGridItem');
}
