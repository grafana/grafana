import { advanceTo } from 'jest-date-mock';
import { map, of } from 'rxjs';

import {
  DataFrame,
  DataQueryRequest,
  DataSourceApi,
  dateTime,
  FieldType,
  PanelData,
  standardTransformersRegistry,
  toDataFrame,
  VariableSupportType,
} from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { setPluginImportUtils } from '@grafana/runtime';
import {
  MultiValueVariable,
  SceneDataLayers,
  SceneGridItemLike,
  SceneGridLayout,
  SceneGridRow,
  SceneVariable,
} from '@grafana/scenes';
import { Dashboard, LoadingState, Panel, RowPanel, VariableRefresh } from '@grafana/schema';
import { PanelModel } from 'app/features/dashboard/state';
import { getTimeRange } from 'app/features/dashboard/utils/timeRange';
import { reduceTransformRegistryItem } from 'app/features/transformers/editors/ReduceTransformerEditor';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard';

import { RowRepeaterBehavior } from '../scene/RowRepeaterBehavior';
import { activateFullSceneTree } from '../utils/test-utils';

import dashboard_to_load1 from './testfiles/dashboard_to_load1.json';
import repeatingRowsAndPanelsDashboardJson from './testfiles/repeating_rows_and_panels.json';
import snapshotableDashboardJson from './testfiles/snapshotable_dashboard.json';
import {
  buildGridItemForLibPanel,
  buildGridItemForPanel,
  transformSaveModelToScene,
} from './transformSaveModelToScene';
import { gridItemToPanel, transformSceneToSaveModel, trimDashboardForSnapshot } from './transformSceneToSaveModel';

standardTransformersRegistry.setInit(() => [reduceTransformRegistryItem]);
setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

const AFrame = toDataFrame({
  name: 'A',
  fields: [
    { name: 'time', type: FieldType.time, values: [100, 200, 300] },
    { name: 'values', type: FieldType.number, values: [1, 2, 3] },
  ],
});

const BFrame = toDataFrame({
  name: 'B',
  fields: [
    { name: 'time', type: FieldType.time, values: [100, 200, 300] },
    { name: 'values', type: FieldType.number, values: [10, 20, 30] },
  ],
});

const AnnoFrame = toDataFrame({
  fields: [
    { name: 'time', values: [1, 2, 2, 5, 5] },
    { name: 'id', values: ['1', '2', '2', '5', '5'] },
    { name: 'text', values: ['t1', 't2', 't3', 't4', 't5'] },
  ],
});

const VariableQueryFrame = toDataFrame({
  fields: [{ name: 'text', type: FieldType.string, values: ['val1', 'val2', 'val11'] }],
});

const testSeries: Record<string, DataFrame> = {
  A: AFrame,
  B: BFrame,
  Anno: AnnoFrame,
  VariableQuery: VariableQueryFrame,
};

const runRequestMock = jest.fn().mockImplementation((ds: DataSourceApi, request: DataQueryRequest) => {
  const result: PanelData = {
    state: LoadingState.Loading,
    series: [],
    timeRange: request.range,
  };

  return of([]).pipe(
    map(() => {
      result.state = LoadingState.Done;

      const refId = request.targets[0].refId;
      result.series = [testSeries[refId]];

      return result;
    })
  );
});
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    get: () => ({
      getRef: () => ({ type: 'mock-ds', uid: 'mock-uid' }),
      variables: {
        getType: () => VariableSupportType.Standard,
        toDataQuery: (q) => q,
      },
    }),
  }),
  getRunRequest: () => (ds: DataSourceApi, request: DataQueryRequest) => {
    return runRequestMock(ds, request);
  },
  config: {
    panels: [],
    theme2: {
      visualization: {
        getColorByName: jest.fn().mockReturnValue('red'),
      },
    },
  },
}));
describe('transformSceneToSaveModel', () => {
  describe('Given a simple scene', () => {
    it('Should transform back to peristed model', () => {
      const scene = transformSaveModelToScene({ dashboard: dashboard_to_load1 as any, meta: {} });
      const saveModel = transformSceneToSaveModel(scene);

      expect(saveModel).toMatchSnapshot();
    });
  });

  describe('Given a scene with rows', () => {
    it('Should transform back to peristed model', () => {
      const scene = transformSaveModelToScene({ dashboard: repeatingRowsAndPanelsDashboardJson as any, meta: {} });
      const saveModel = transformSceneToSaveModel(scene);
      const row2: RowPanel = saveModel.panels![2] as RowPanel;

      expect(row2.type).toBe('row');
      expect(row2.repeat).toBe('server');
      expect(saveModel).toMatchSnapshot();
    });

    it('Should remove repeated rows in save model', () => {
      const scene = transformSaveModelToScene({ dashboard: repeatingRowsAndPanelsDashboardJson as any, meta: {} });

      const variable = scene.state.$variables?.state.variables[0] as MultiValueVariable;
      variable.changeValueTo(['a', 'b', 'c']);

      const grid = scene.state.body as SceneGridLayout;
      const rowWithRepeat = grid.state.children[1] as SceneGridRow;
      const rowRepeater = rowWithRepeat.state.$behaviors![0] as RowRepeaterBehavior;

      // trigger row repeater
      rowRepeater.variableDependency?.variableUpdatesCompleted(new Set<SceneVariable>([variable]));

      // Make sure the repeated rows have been added to runtime scene model
      expect(grid.state.children.length).toBe(5);

      const saveModel = transformSceneToSaveModel(scene);
      const rows = saveModel.panels!.filter((p) => p.type === 'row');
      // Verify the save model does not contain any repeated rows
      expect(rows.length).toBe(3);
    });
  });

  describe('Panel options', () => {
    it('Given panel with time override', () => {
      const gridItem = buildGridItemFromPanelSchema({
        timeFrom: '2h',
        timeShift: '1d',
        hideTimeOverride: true,
      });

      const saveModel = gridItemToPanel(gridItem);
      expect(saveModel.timeFrom).toBe('2h');
      expect(saveModel.timeShift).toBe('1d');
      expect(saveModel.hideTimeOverride).toBe(true);
    });

    it('transparent panel', () => {
      const gridItem = buildGridItemFromPanelSchema({ transparent: true });
      const saveModel = gridItemToPanel(gridItem);

      expect(saveModel.transparent).toBe(true);
    });

    it('Given panel with repeat', () => {
      const gridItem = buildGridItemFromPanelSchema({
        title: '',
        type: 'text-plugin-34',
        gridPos: { x: 1, y: 2, w: 12, h: 8 },
        repeat: 'server',
        repeatDirection: 'v',
        maxPerRow: 8,
      });

      const saveModel = gridItemToPanel(gridItem);
      expect(saveModel.repeat).toBe('server');
      expect(saveModel.repeatDirection).toBe('v');
      expect(saveModel.maxPerRow).toBe(8);
      expect(saveModel.gridPos?.x).toBe(1);
      expect(saveModel.gridPos?.y).toBe(2);
      expect(saveModel.gridPos?.w).toBe(12);
      expect(saveModel.gridPos?.h).toBe(8);
    });
  });

  describe('Library panels', () => {
    it('given a library panel', () => {
      const panel = buildGridItemFromPanelSchema({
        id: 4,
        gridPos: {
          h: 8,
          w: 12,
          x: 0,
          y: 0,
        },
        libraryPanel: {
          name: 'Some lib panel panel',
          uid: 'lib-panel-uid',
        },
        title: 'A panel',
        transformations: [],
        fieldConfig: {
          defaults: {},
          overrides: [],
        },
      });

      const result = gridItemToPanel(panel);

      expect(result.id).toBe(4);
      expect(result.libraryPanel).toEqual({
        name: 'Some lib panel panel',
        uid: 'lib-panel-uid',
      });
      expect(result.gridPos).toEqual({
        h: 8,
        w: 12,
        x: 0,
        y: 0,
      });
      expect(result.title).toBe('A panel');
      expect(result.transformations).toBeUndefined();
      expect(result.fieldConfig).toBeUndefined();
    });
  });

  describe('Annotations', () => {
    it('should transform annotations to save model', () => {
      const scene = transformSaveModelToScene({ dashboard: dashboard_to_load1 as any, meta: {} });
      const saveModel = transformSceneToSaveModel(scene);

      expect(saveModel.annotations?.list?.length).toBe(4);
      expect(saveModel.annotations?.list).toMatchSnapshot();
    });
    it('should transform annotations to save model after state changes', () => {
      const scene = transformSaveModelToScene({ dashboard: dashboard_to_load1 as any, meta: {} });

      const layers = (scene.state.$data as SceneDataLayers)?.state.layers;
      const enabledLayer = layers[1];
      const hiddenLayer = layers[3];

      enabledLayer.setState({
        isEnabled: false,
      });
      hiddenLayer.setState({
        isHidden: false,
      });

      const saveModel = transformSceneToSaveModel(scene);

      expect(saveModel.annotations?.list?.length).toBe(4);
      expect(saveModel.annotations?.list?.[1].enable).toEqual(false);
      expect(saveModel.annotations?.list?.[3].hide).toEqual(false);
    });
  });

  describe('Queries', () => {
    it('Given panel with queries', () => {
      const panel = buildGridItemFromPanelSchema({
        datasource: {
          type: 'grafana-testdata',
          uid: 'abc',
        },
        maxDataPoints: 100,
        targets: [
          {
            refId: 'A',
            expr: 'A',
            datasource: {
              type: 'grafana-testdata',
              uid: 'abc',
            },
          },
          {
            refId: 'B',
            expr: 'B',
          },
        ],
      });

      const result = gridItemToPanel(panel);

      expect(result.maxDataPoints).toBe(100);
      expect(result.targets?.length).toBe(2);
      expect(result.targets?.[0]).toEqual({
        refId: 'A',
        expr: 'A',
        datasource: {
          type: 'grafana-testdata',
          uid: 'abc',
        },
      });

      expect(result.datasource).toEqual({
        type: 'grafana-testdata',
        uid: 'abc',
      });
    });

    it('Given panel with transformations', () => {
      const panel = buildGridItemFromPanelSchema({
        datasource: {
          type: 'grafana-testdata',
          uid: 'abc',
        },
        maxDataPoints: 100,

        transformations: [
          {
            id: 'reduce',
            options: {
              reducers: ['max'],
              mode: 'reduceFields',
              includeTimeField: false,
            },
          },
        ],

        targets: [
          {
            refId: 'A',
            expr: 'A',
            datasource: {
              type: 'grafana-testdata',
              uid: 'abc',
            },
          },
          {
            refId: 'B',
            expr: 'B',
          },
        ],
      });

      const result = gridItemToPanel(panel);

      expect(result.transformations.length).toBe(1);

      expect(result.maxDataPoints).toBe(100);
      expect(result.targets?.length).toBe(2);
      expect(result.targets?.[0]).toEqual({
        refId: 'A',
        expr: 'A',
        datasource: {
          type: 'grafana-testdata',
          uid: 'abc',
        },
      });

      expect(result.datasource).toEqual({
        type: 'grafana-testdata',
        uid: 'abc',
      });
    });
    it('Given panel with shared query', () => {
      const panel = buildGridItemFromPanelSchema({
        datasource: {
          type: 'datasource',
          uid: SHARED_DASHBOARD_QUERY,
        },
        targets: [
          {
            refId: 'A',
            panelId: 1,
            datasource: {
              type: 'datasource',
              uid: SHARED_DASHBOARD_QUERY,
            },
          },
        ],
      });

      const result = gridItemToPanel(panel);

      expect(result.targets?.length).toBe(1);
      expect(result.targets?.[0]).toEqual({
        refId: 'A',
        panelId: 1,
        datasource: {
          type: 'datasource',
          uid: SHARED_DASHBOARD_QUERY,
        },
      });

      expect(result.datasource).toEqual({
        type: 'datasource',
        uid: SHARED_DASHBOARD_QUERY,
      });
    });

    it('Given panel with shared query and transformations', () => {
      const panel = buildGridItemFromPanelSchema({
        datasource: {
          type: 'datasource',
          uid: SHARED_DASHBOARD_QUERY,
        },
        targets: [
          {
            refId: 'A',
            panelId: 1,
            datasource: {
              type: 'datasource',
              uid: SHARED_DASHBOARD_QUERY,
            },
          },
        ],
        transformations: [
          {
            id: 'reduce',
            options: {
              reducers: ['max'],
              mode: 'reduceFields',
              includeTimeField: false,
            },
          },
        ],
      });

      const result = gridItemToPanel(panel);

      expect(result.transformations.length).toBe(1);

      expect(result.targets?.length).toBe(1);
      expect(result.targets?.[0]).toEqual({
        refId: 'A',
        panelId: 1,
        datasource: {
          type: 'datasource',
          uid: SHARED_DASHBOARD_QUERY,
        },
      });

      expect(result.datasource).toEqual({
        type: 'datasource',
        uid: SHARED_DASHBOARD_QUERY,
      });
    });
  });

  describe('Snapshots', () => {
    const fakeCurrentDate = dateTime('2023-01-01T20:00:00.000Z').toDate();

    beforeEach(() => {
      advanceTo(fakeCurrentDate);
    });

    it('attaches snapshotData to panels and annotations', async () => {
      const scene = transformSaveModelToScene({ dashboard: snapshotableDashboardJson as any, meta: {} });

      activateFullSceneTree(scene);

      await new Promise((r) => setTimeout(r, 1));

      const snapshot = transformSceneToSaveModel(scene, true);

      expect(snapshot.panels?.length).toBe(3);

      // Regular panel with SceneQueryRunner
      // @ts-expect-error
      expect(snapshot.panels?.[0].snapshotData).toBeDefined();
      // @ts-expect-error
      expect(snapshot.panels?.[0].snapshotData).toMatchInlineSnapshot(`
        [
          {
            "fields": [
              {
                "config": {},
                "name": "time",
                "type": "time",
                "values": [
                  100,
                  200,
                  300,
                ],
              },
              {
                "config": {},
                "name": "values",
                "type": "number",
                "values": [
                  1,
                  2,
                  3,
                ],
              },
            ],
            "name": "A",
          },
        ]
       `);

      // Panel with transformations
      // @ts-expect-error
      expect(snapshot.panels?.[1].snapshotData).toBeDefined();
      // @ts-expect-error
      expect(snapshot.panels?.[1].snapshotData).toMatchInlineSnapshot(`
        [
          {
            "fields": [
              {
                "config": {},
                "name": "Field",
                "type": "string",
                "values": [
                  "values",
                ],
              },
              {
                "config": {},
                "name": "Max",
                "type": "number",
                "values": [
                  30,
                ],
              },
            ],
            "meta": {
              "transformations": [
                "reduce",
              ],
            },
          },
        ]
      `);

      // Panel with a shared query (dahsboard query)
      // @ts-expect-error
      expect(snapshot.panels?.[2].snapshotData).toBeDefined();
      // @ts-expect-error
      expect(snapshot.panels?.[2].snapshotData).toMatchInlineSnapshot(`
        [
          {
            "fields": [
              {
                "config": {},
                "name": "time",
                "type": "time",
                "values": [
                  100,
                  200,
                  300,
                ],
              },
              {
                "config": {},
                "name": "values",
                "type": "number",
                "values": [
                  1,
                  2,
                  3,
                ],
              },
            ],
            "name": "A",
          },
        ]
       `);
      // @ts-expect-error
      expect(snapshot.annotations?.list?.[0].snapshotData).toBeDefined();
      // @ts-expect-error
      expect(snapshot.annotations?.list?.[0].snapshotData).toMatchInlineSnapshot(`
        [
          {
            "color": "red",
            "id": "1",
            "isRegion": false,
            "text": "t1",
            "time": 1,
            "type": "Annotations & Alerts",
          },
          {
            "color": "red",
            "id": "2",
            "isRegion": false,
            "text": "t2",
            "time": 2,
            "type": "Annotations & Alerts",
          },
          {
            "color": "red",
            "id": "5",
            "isRegion": false,
            "text": "t4",
            "time": 5,
            "type": "Annotations & Alerts",
          },
        ]
      `);

      // @ts-expect-error
      expect(snapshot.annotations?.list?.[1].snapshotData).toBeDefined();
      // @ts-expect-error
      expect(snapshot.annotations?.list?.[1].snapshotData).toMatchInlineSnapshot(`
      [
        {
          "color": "red",
          "id": "1",
          "isRegion": false,
          "text": "t1",
          "time": 1,
          "type": "New annotation",
        },
        {
          "color": "red",
          "id": "2",
          "isRegion": false,
          "text": "t2",
          "time": 2,
          "type": "New annotation",
        },
        {
          "color": "red",
          "id": "5",
          "isRegion": false,
          "text": "t4",
          "time": 5,
          "type": "New annotation",
        },
      ]
    `);
    });

    describe('trimDashboardForSnapshot', () => {
      let snapshot: Dashboard = {} as Dashboard;

      beforeEach(() => {
        const scene = transformSaveModelToScene({ dashboard: snapshotableDashboardJson as any, meta: {} });
        activateFullSceneTree(scene);
        snapshot = transformSceneToSaveModel(scene, true);
      });

      it('should apply provided title and absolute time range', async () => {
        const result = trimDashboardForSnapshot('Snap title', getTimeRange({ from: 'now-6h', to: 'now' }), snapshot);

        expect(result.title).toBe('Snap title');
        expect(result.time).toBeDefined();
        expect(result.time!.from).toEqual('2023-01-01T14:00:00.000Z');
        expect(result.time!.to).toEqual('2023-01-01T20:00:00.000Z');
      });

      it('should remove queries from annotations', () => {
        expect(snapshot.annotations?.list?.[0].target).toBeDefined();
        expect(snapshot.annotations?.list?.[1].target).toBeDefined();

        const result = trimDashboardForSnapshot('Snap title', getTimeRange({ from: 'now-6h', to: 'now' }), snapshot);

        expect(result.annotations?.list?.length).toBe(2);
        expect(result.annotations?.list?.[0].target).toBeUndefined();
        expect(result.annotations?.list?.[1].target).toBeUndefined();
      });
      it('should remove queries from variables', () => {
        expect(snapshot.templating?.list?.length).toBe(1);

        const result = trimDashboardForSnapshot('Snap title', getTimeRange({ from: 'now-6h', to: 'now' }), snapshot);

        expect(result.templating?.list?.length).toBe(1);
        expect(result.templating?.list?.[0].query).toBe('');
        expect(result.templating?.list?.[0].refresh).toBe(VariableRefresh.never);
        expect(result.templating?.list?.[0].options).toHaveLength(1);
        expect(result.templating?.list?.[0].options?.[0]).toEqual({
          text: 'annotations',
          value: 'annotations',
        });
      });

      it('should remove queries, datasource and links(???) from panels', () => {
        // @ts-expect-error
        expect(snapshot.panels?.[0].datasource).toBeDefined();
        // @ts-expect-error
        expect(snapshot.panels?.[1].datasource).toBeDefined();
        // @ts-expect-error
        expect(snapshot.panels?.[2].datasource).toBeDefined();
        // @ts-expect-error
        expect(snapshot.panels?.[0].targets).not.toEqual([]);
        // @ts-expect-error
        expect(snapshot.panels?.[1].targets).not.toEqual([]);
        // @ts-expect-error
        expect(snapshot.panels?.[2].targets).not.toEqual([]);

        const result = trimDashboardForSnapshot('Snap title', getTimeRange({ from: 'now-6h', to: 'now' }), snapshot);

        // @ts-expect-error
        expect(result.panels?.[0].datasource).toBeUndefined();
        // @ts-expect-error
        expect(result.panels?.[1].datasource).toBeUndefined();
        // @ts-expect-error
        expect(result.panels?.[2].datasource).toBeUndefined();
        // @ts-expect-error
        expect(result.panels?.[0].targets).toEqual([]);
        // @ts-expect-error
        expect(result.panels?.[1].targets).toEqual([]);
        // @ts-expect-error
        expect(result.panels?.[2].targets).toEqual([]);
      });

      // TODO: Uncomment when we support links
      // it('should remove links', async () => {
      //   const scene = transformSaveModelToScene({ dashboard: snapshotableDashboardJson as any, meta: {} });
      //   activateFullSceneTree(scene);
      //   const snapshot = transformSceneToSaveModel(scene, true);
      //   expect(snapshot.links?.length).toBe(1);
      //   const result = trimDashboardForSnapshot('Snap title', getTimeRange({ from: 'now-6h', to: 'now' }), snapshot);
      //   expect(result.links?.length).toBe(0);
      // });
    });
  });
});

export function buildGridItemFromPanelSchema(panel: Partial<Panel>): SceneGridItemLike {
  if (panel.libraryPanel) {
    return buildGridItemForLibPanel(new PanelModel(panel))!;
  }
  return buildGridItemForPanel(new PanelModel(panel));
}
