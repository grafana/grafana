import {
  CustomVariable,
  DataSourceVariable,
  QueryVariable,
  SceneGridLayout,
  SceneGridRow,
  SceneQueryRunner,
  VizPanel,
} from '@grafana/scenes';
import { defaultDashboard, LoadingState, Panel, RowPanel, VariableType } from '@grafana/schema';
import { DashboardLoaderSrv, setDashboardLoaderSrv } from 'app/features/dashboard/services/DashboardLoaderSrv';
import { DashboardModel, PanelModel } from 'app/features/dashboard/state';
import { createPanelJSONFixture } from 'app/features/dashboard/state/__fixtures__/dashboardFixtures';

import { DashboardScene } from './DashboardScene';
import {
  createDashboardSceneFromDashboardModel,
  createVizPanelFromPanelModel,
  createSceneVariableFromVariableModel,
  DashboardLoader,
} from './DashboardsLoader';

describe('DashboardLoader', () => {
  describe('when fetching/loading a dashboard', () => {
    beforeEach(() => {
      new DashboardLoader({});
    });

    it('should load the dashboard from the cache if it exists', () => {
      const loader = new DashboardLoader({});
      const dashboard = new DashboardScene({
        title: 'cached',
        uid: 'fake-uid',
        body: new SceneGridLayout({ children: [] }),
      });
      // @ts-expect-error
      loader.cache['fake-uid'] = dashboard;
      loader.load('fake-uid');
      expect(loader.state.dashboard).toBe(dashboard);
      expect(loader.state.isLoading).toBe(undefined);
    });

    it('should call dashboard loader server if the dashboard is not cached', async () => {
      const loadDashboardMock = jest.fn().mockResolvedValue({ dashboard: { uid: 'fake-dash' }, meta: {} });
      setDashboardLoaderSrv({
        loadDashboard: loadDashboardMock,
      } as unknown as DashboardLoaderSrv);

      const loader = new DashboardLoader({});
      await loader.load('fake-dash');

      expect(loadDashboardMock).toHaveBeenCalledWith('db', '', 'fake-dash');
    });

    it("should error when the dashboard doesn't exist", async () => {
      const loadDashboardMock = jest.fn().mockResolvedValue({ dashboard: undefined, meta: undefined });
      setDashboardLoaderSrv({
        loadDashboard: loadDashboardMock,
      } as unknown as DashboardLoaderSrv);

      const loader = new DashboardLoader({});
      await loader.load('fake-dash');

      expect(loader.state.dashboard).toBeUndefined();
      expect(loader.state.isLoading).toBe(false);
      // @ts-expect-error - private
      expect(loader.cache['fake-dash']).toBeUndefined();
      expect(loader.state.loadError).toBe('Error: Dashboard not found');
    });

    it('should initialize the dashboard scene with the loaded dashboard', async () => {
      const loadDashboardMock = jest.fn().mockResolvedValue({ dashboard: { uid: 'fake-dash' }, meta: {} });
      setDashboardLoaderSrv({
        loadDashboard: loadDashboardMock,
      } as unknown as DashboardLoaderSrv);

      const loader = new DashboardLoader({});
      await loader.load('fake-dash');

      expect(loader.state.dashboard?.state.uid).toBe('fake-dash');
      expect(loader.state.loadError).toBe(undefined);
      expect(loader.state.isLoading).toBe(false);
      // It updates the cache
      // @ts-expect-error - private
      expect(loader.cache['fake-dash']).toBeDefined();
    });

    it('should use DashboardScene creator to initialize the scene', async () => {
      const loadDashboardMock = jest.fn().mockResolvedValue({ dashboard: { uid: 'fake-dash' }, meta: {} });
      setDashboardLoaderSrv({
        loadDashboard: loadDashboardMock,
      } as unknown as DashboardLoaderSrv);

      const loader = new DashboardLoader({});
      await loader.load('fake-dash');
      expect(loader.state.dashboard).toBeInstanceOf(DashboardScene);
      // @ts-expect-error - private
      expect(loader.state.dashboard?.urlSyncManager).toBeDefined();
      expect(loader.state.isLoading).toBe(false);
    });
  });

  describe('when creating dashboard scene', () => {
    it('should initialize the DashboardScene with the model state', () => {
      const dash = {
        ...defaultDashboard,
        title: 'test',
        uid: 'test-uid',
        time: { from: 'now-10h', to: 'now' },
        templating: {
          list: [
            {
              hide: 2,
              name: 'constant',
              skipUrlSync: false,
              type: 'constant' as VariableType,
              rootStateKey: 'N4XLmH5Vz',
              query: 'test',
              id: 'constant',
              global: false,
              index: 3,
              state: LoadingState.Done,
              error: null,
              description: '',
              datasource: null,
            },
          ],
        },
      };
      const oldModel = new DashboardModel(dash);

      const scene = createDashboardSceneFromDashboardModel(oldModel);

      expect(scene.state.title).toBe('test');
      expect(scene.state.uid).toBe('test-uid');
      expect(scene.state?.$timeRange?.state.value.raw).toEqual(dash.time);
      expect(scene.state?.$variables?.state.variables).toHaveLength(1);
      expect(scene.state.controls).toBeDefined();
    });
  });

  describe('when organizing panels as scene children', () => {
    it('should create panels within collapsed rows', () => {
      const panel = createPanelJSONFixture({
        title: 'test',
        gridPos: { x: 1, y: 0, w: 12, h: 8 },
      }) as Panel;

      const row = createPanelJSONFixture({
        title: 'test',
        type: 'row',
        gridPos: { x: 0, y: 0, w: 12, h: 1 },
        collapsed: true,
        panels: [panel],
      }) as unknown as RowPanel;

      const dashboard = {
        ...defaultDashboard,
        panels: [row],
      };

      const oldModel = new DashboardModel(dashboard);

      const scene = createDashboardSceneFromDashboardModel(oldModel);
      const body = scene.state.body as SceneGridLayout;

      expect(body.state.children).toHaveLength(1);
      const rowScene = body.state.children[0] as SceneGridRow;
      expect(rowScene).toBeInstanceOf(SceneGridRow);
      expect(rowScene.state.title).toEqual(row.title);
      expect(rowScene.state.placement?.y).toEqual(row.gridPos!.y);
      expect(rowScene.state.isCollapsed).toEqual(row.collapsed);
      expect(rowScene.state.children).toHaveLength(1);
      expect(rowScene.state.children[0]).toBeInstanceOf(VizPanel);
    });

    it('should create panels within expanded row', () => {
      const panelOutOfRow = createPanelJSONFixture({
        title: 'Out of a row',
        gridPos: {
          h: 8,
          w: 12,
          x: 0,
          y: 0,
        },
      });
      const rowWithPanel = createPanelJSONFixture({
        title: 'Row with panel',
        type: 'row',
        collapsed: false,
        gridPos: {
          h: 1,
          w: 24,
          x: 0,
          y: 8,
        },
        // This panels array is not used if the row is not collapsed
        panels: [],
      });
      const panelInRow = createPanelJSONFixture({
        gridPos: {
          h: 8,
          w: 12,
          x: 0,
          y: 9,
        },
        title: 'In row 1',
      });
      const emptyRow = createPanelJSONFixture({
        collapsed: false,
        gridPos: {
          h: 1,
          w: 24,
          x: 0,
          y: 17,
        },
        // This panels array is not used if the row is not collapsed
        panels: [],
        title: 'Empty row',
        type: 'row',
      });
      const dashboard = {
        ...defaultDashboard,
        panels: [panelOutOfRow, rowWithPanel, panelInRow, emptyRow],
      };

      const oldModel = new DashboardModel(dashboard);

      const scene = createDashboardSceneFromDashboardModel(oldModel);
      const body = scene.state.body as SceneGridLayout;

      expect(body.state.children).toHaveLength(3);
      expect(body).toBeInstanceOf(SceneGridLayout);
      // Panel out of row
      expect(body.state.children[0]).toBeInstanceOf(VizPanel);
      const panelOutOfRowVizPanel = body.state.children[0] as VizPanel;
      expect(panelOutOfRowVizPanel.state.title).toBe(panelOutOfRow.title);
      // Row with panel
      expect(body.state.children[1]).toBeInstanceOf(SceneGridRow);
      const rowWithPanelsScene = body.state.children[1] as SceneGridRow;
      expect(rowWithPanelsScene.state.title).toBe(rowWithPanel.title);
      expect(rowWithPanelsScene.state.children).toHaveLength(1);
      // Panel within row
      expect(rowWithPanelsScene.state.children[0]).toBeInstanceOf(VizPanel);
      const panelInRowVizPanel = rowWithPanelsScene.state.children[0] as VizPanel;
      expect(panelInRowVizPanel.state.title).toBe(panelInRow.title);
      // Empty row
      expect(body.state.children[2]).toBeInstanceOf(SceneGridRow);
      const emptyRowScene = body.state.children[2] as SceneGridRow;
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
      const vizPanelSceneObject = createVizPanelFromPanelModel(new PanelModel(panel));

      expect(vizPanelSceneObject.state.title).toBe('test');
      expect(vizPanelSceneObject.state.pluginId).toBe('test-plugin');
      expect(vizPanelSceneObject.state.placement).toEqual({ x: 0, y: 0, width: 12, height: 8 });
      expect(vizPanelSceneObject.state.options).toEqual(panel.options);
      expect(vizPanelSceneObject.state.fieldConfig).toEqual(panel.fieldConfig);
      expect(vizPanelSceneObject.state.pluginVersion).toBe('1.0.0');
      expect((vizPanelSceneObject.state.$data as SceneQueryRunner)?.state.queries).toEqual(panel.targets);
      expect((vizPanelSceneObject.state.$data as SceneQueryRunner)?.state.maxDataPoints).toEqual(100);
      expect((vizPanelSceneObject.state.$data as SceneQueryRunner)?.state.transformations).toEqual(
        panel.transformations
      );
    });
  });

  describe('when creating variables objects', () => {
    it('should migrate custom variable', () => {
      const variable = {
        current: {
          selected: false,
          text: 'a',
          value: 'a',
        },
        hide: 0,
        includeAll: false,
        multi: false,
        name: 'query0',
        options: [
          {
            selected: true,
            text: 'a',
            value: 'a',
          },
          {
            selected: false,
            text: 'b',
            value: 'b',
          },
          {
            selected: false,
            text: 'c',
            value: 'c',
          },
          {
            selected: false,
            text: 'd',
            value: 'd',
          },
        ],
        query: 'a,b,c,d',
        skipUrlSync: false,
        type: 'custom' as VariableType,
        rootStateKey: 'N4XLmH5Vz',
        id: 'query0',
        global: false,
        index: 0,
        state: 'Done',
        error: null,
        description: null,
        allValue: null,
      };

      const migrated = createSceneVariableFromVariableModel(variable);
      const { key, ...rest } = migrated.state;

      expect(migrated).toBeInstanceOf(CustomVariable);
      expect(rest).toEqual({
        allValue: undefined,
        defaultToAll: false,
        description: null,
        includeAll: false,
        isMulti: false,
        label: undefined,
        name: 'query0',
        options: [],
        query: 'a,b,c,d',
        skipUrlSync: false,
        text: 'a',
        type: 'custom',
        value: 'a',
        hide: 0,
      });
    });
    it('should migrate query variable', () => {
      const variable = {
        allValue: null,
        current: {
          text: 'America',
          value: 'America',
          selected: false,
        },
        datasource: {
          uid: 'P15396BDD62B2BE29',
          type: 'influxdb',
        },
        definition: '',
        hide: 0,
        includeAll: false,
        label: 'Datacenter',
        multi: false,
        name: 'datacenter',
        options: [
          {
            text: 'America',
            value: 'America',
            selected: true,
          },
          {
            text: 'Africa',
            value: 'Africa',
            selected: false,
          },
          {
            text: 'Asia',
            value: 'Asia',
            selected: false,
          },
          {
            text: 'Europe',
            value: 'Europe',
            selected: false,
          },
        ],
        query: 'SHOW TAG VALUES  WITH KEY = "datacenter" ',
        refresh: 1,
        regex: '',
        skipUrlSync: false,
        sort: 0,
        tagValuesQuery: null,
        tagsQuery: null,
        type: 'query' as VariableType,
        useTags: false,
        rootStateKey: '000000002',
        id: 'datacenter',
        global: false,
        index: 0,
        state: 'Done',
        error: null,
        description: null,
      };

      const migrated = createSceneVariableFromVariableModel(variable);
      const { key, ...rest } = migrated.state;

      expect(migrated).toBeInstanceOf(QueryVariable);
      expect(rest).toEqual({
        allValue: undefined,
        datasource: {
          type: 'influxdb',
          uid: 'P15396BDD62B2BE29',
        },
        defaultToAll: false,
        description: null,
        includeAll: false,
        isMulti: false,
        label: 'Datacenter',
        name: 'datacenter',
        options: [],
        query: 'SHOW TAG VALUES  WITH KEY = "datacenter" ',
        refresh: 1,
        regex: '',
        skipUrlSync: false,
        sort: 0,
        text: 'America',
        type: 'query',
        value: 'America',
        hide: 0,
      });
    });

    it('should migrate datasource variable', () => {
      const variable = {
        id: 'query1',
        rootStateKey: 'N4XLmH5Vz',
        name: 'query1',
        type: 'datasource' as VariableType,
        global: false,
        index: 1,
        hide: 0,
        skipUrlSync: false,
        state: 'Done',
        error: null,
        description: null,
        current: {
          value: ['gdev-prometheus', 'gdev-slow-prometheus'],
          text: ['gdev-prometheus', 'gdev-slow-prometheus'],
          selected: true,
        },
        regex: '/^gdev/',
        options: [
          {
            text: 'All',
            value: '$__all',
            selected: false,
          },
          {
            text: 'gdev-prometheus',
            value: 'gdev-prometheus',
            selected: true,
          },
          {
            text: 'gdev-slow-prometheus',
            value: 'gdev-slow-prometheus',
            selected: false,
          },
        ],
        query: 'prometheus',
        multi: true,
        includeAll: true,
        refresh: 1,
        allValue: 'Custom all',
      };

      const migrated = createSceneVariableFromVariableModel(variable);
      const { key, ...rest } = migrated.state;

      expect(migrated).toBeInstanceOf(DataSourceVariable);
      expect(rest).toEqual({
        allValue: 'Custom all',
        defaultToAll: true,
        includeAll: true,
        label: undefined,
        name: 'query1',
        options: [],
        query: 'prometheus',
        regex: '/^gdev/',
        skipUrlSync: false,
        text: ['gdev-prometheus', 'gdev-slow-prometheus'],
        type: 'datasource',
        value: ['gdev-prometheus', 'gdev-slow-prometheus'],
        isMulti: true,
        description: null,
        hide: 0,
      });
    });

    it('should migrate constant variable', () => {
      const variable = {
        hide: 2,
        label: 'constant',
        name: 'constant',
        skipUrlSync: false,
        type: 'constant' as VariableType,
        rootStateKey: 'N4XLmH5Vz',
        current: {
          selected: true,
          text: 'test',
          value: 'test',
        },
        options: [
          {
            selected: true,
            text: 'test',
            value: 'test',
          },
        ],
        query: 'test',
        id: 'constant',
        global: false,
        index: 3,
        state: 'Done',
        error: null,
        description: null,
      };

      const migrated = createSceneVariableFromVariableModel(variable);
      const { key, ...rest } = migrated.state;

      expect(rest).toEqual({
        description: null,
        hide: 2,
        label: 'constant',
        name: 'constant',
        skipUrlSync: false,
        type: 'constant',
        value: 'test',
      });
    });

    it.each(['adhoc', 'interval', 'textbox', 'system'])('should throw for unsupported (yet) variables', (type) => {
      const variable = {
        name: 'query0',
        type: type as VariableType,
      };

      expect(() => createSceneVariableFromVariableModel(variable)).toThrow();
    });
  });
});
