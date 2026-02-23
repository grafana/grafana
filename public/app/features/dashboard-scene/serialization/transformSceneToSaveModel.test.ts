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
  StandardVariableQuery,
  toDataFrame,
  VariableSupportType,
} from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { MultiValueVariable, sceneGraph, SceneGridLayout, SceneGridRow, VizPanel } from '@grafana/scenes';
import { Dashboard, LoadingState, Panel, RowPanel, VariableRefresh } from '@grafana/schema';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { getTimeRange } from 'app/features/dashboard/utils/timeRange';
import { getReduceTransformRegistryItem } from 'app/features/transformers/editors/ReduceTransformerEditor';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard/constants';
import { DashboardDataDTO } from 'app/types/dashboard';

import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
import { LibraryPanelBehavior } from '../scene/LibraryPanelBehavior';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { RowRepeaterBehavior } from '../scene/layout-default/RowRepeaterBehavior';
import { RowItem } from '../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../scene/layout-rows/RowsLayoutManager';
import { NEW_LINK } from '../settings/links/utils';
import { activateFullSceneTree, buildPanelRepeaterScene } from '../utils/test-utils';
import { getVizPanelKeyForPanelId } from '../utils/utils';

import { GRAFANA_DATASOURCE_REF } from './const';
import dashboard_to_load1 from './testfiles/dashboard_to_load1.json';
import repeatingRowsAndPanelsDashboardJson from './testfiles/repeating_rows_and_panels.json';
import snapshotableDashboardJson from './testfiles/snapshotable_dashboard.json';
import snapshotableWithRowsDashboardJson from './testfiles/snapshotable_with_rows.json';
import { buildGridItemForPanel, transformSaveModelToScene } from './transformSaveModelToScene';
import {
  gridItemToPanel,
  gridRowToSaveModel,
  panelRepeaterToPanels,
  rowItemToSaveModel,
  transformSceneToSaveModel,
  trimDashboardForSnapshot,
} from './transformSceneToSaveModel';

standardTransformersRegistry.setInit(() => [getReduceTransformRegistryItem()]);
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

const CFrame = toDataFrame({
  name: 'C',
  fields: [
    { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
    { name: 'values', type: FieldType.number, values: [100, 200, 300] },
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
  C: CFrame,
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
        toDataQuery: (q: StandardVariableQuery) => q,
      },
    }),
    // mock getInstanceSettings()
    getInstanceSettings: jest.fn(),
  }),
  getRunRequest: () => (ds: DataSourceApi, request: DataQueryRequest) => {
    return runRequestMock(ds, request);
  },
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    panels: {
      text: { skipDataQuery: true },
    },
    featureToggles: {
      dataTrails: false,
    },
    theme2: {
      visualization: {
        getColorByName: jest.fn().mockReturnValue('red'),
      },
    },
  },
  setPluginExtensionGetter: jest.fn(),
  getPluginLinkExtensions: jest.fn(),
}));

jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  setWeekStart: jest.fn(),
}));

jest.mock('@grafana/scenes', () => ({
  ...jest.requireActual('@grafana/scenes'),
  sceneUtils: {
    ...jest.requireActual('@grafana/scenes').sceneUtils,
    registerVariableMacro: jest.fn(),
  },
}));

describe('transformSceneToSaveModel', () => {
  describe('Given a simple scene with custom settings', () => {
    it('Should transform back to persisted model', () => {
      const dashboardWithCustomSettings = {
        ...dashboard_to_load1,
        title: 'My custom title',
        description: 'My custom description',
        tags: ['tag1', 'tag2'],
        timezone: 'America/New_York',
        weekStart: 'monday',
        graphTooltip: 1,
        editable: false,
        refresh: '5m',
        timepicker: {
          ...dashboard_to_load1.timepicker,
          refresh_intervals: ['5m', '15m', '30m', '1h'],
          hidden: true,
        },
        links: [{ ...NEW_LINK, title: 'Link 1' }],
      };
      const scene = transformSaveModelToScene({ dashboard: dashboardWithCustomSettings as DashboardDataDTO, meta: {} });
      const saveModel = transformSceneToSaveModel(scene);

      expect(saveModel).toMatchSnapshot();
    });
  });

  describe('Given a simple scene with variables', () => {
    it('Should transform back to persisted model', () => {
      const scene = transformSaveModelToScene({ dashboard: dashboard_to_load1 as DashboardDataDTO, meta: {} });
      const saveModel = transformSceneToSaveModel(scene);

      expect(saveModel).toMatchSnapshot();
    });
  });

  describe('Given a scene with rows', () => {
    it('Should transform back to persisted model', () => {
      const scene = transformSaveModelToScene({
        dashboard: repeatingRowsAndPanelsDashboardJson as DashboardDataDTO,
        meta: {},
      });

      const saveModel = transformSceneToSaveModel(scene);

      const row2: RowPanel = saveModel.panels![2] as RowPanel;

      expect(row2.type).toBe('row');
      expect(row2.repeat).toBe('server');
      expect(saveModel).toMatchSnapshot();
    });

    it('Should remove repeated rows in save model', () => {
      const scene = transformSaveModelToScene({
        dashboard: repeatingRowsAndPanelsDashboardJson as DashboardDataDTO,
        meta: {},
      });

      const variable = scene.state.$variables?.state.variables[0] as MultiValueVariable;
      variable.changeValueTo(['a', 'b', 'c']);

      const layout = scene.state.body as DefaultGridLayoutManager;
      const grid = layout.state.grid;
      const rowWithRepeat = grid.state.children[1] as SceneGridRow;
      const rowRepeater = rowWithRepeat.state.$behaviors![0] as RowRepeaterBehavior;

      // trigger row repeater
      rowRepeater.performRepeat();

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

    it('interval', () => {
      const gridItem = buildGridItemFromPanelSchema({ interval: '20m' });
      const saveModel = gridItemToPanel(gridItem);

      expect(saveModel.interval).toBe('20m');
    });

    it('With angular options', () => {
      const gridItem = buildGridItemFromPanelSchema({});
      const vizPanel = gridItem.state.body as VizPanel;
      vizPanel.setState({
        options: {
          angularOptions: {
            bars: true,
          },
        },
      });

      const saveModel = gridItemToPanel(gridItem);
      expect(saveModel.options?.angularOptions).toBe(undefined);
      expect((saveModel as any).bars).toBe(true);
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
    it('Given panel with links', () => {
      const gridItem = buildGridItemFromPanelSchema({
        title: '',
        type: 'text-plugin-34',
        gridPos: { x: 1, y: 2, w: 12, h: 8 },
        links: [
          // @ts-expect-error Panel link is wrongly typed as DashboardLink
          {
            title: 'Link 1',
            url: 'http://some.test.link1',
          },
          // @ts-expect-error Panel link is wrongly typed as DashboardLink
          {
            targetBlank: true,
            title: 'Link 2',
            url: 'http://some.test.link2',
          },
        ],
      });

      const saveModel = gridItemToPanel(gridItem);
      expect(saveModel.links).toEqual([
        {
          title: 'Link 1',
          url: 'http://some.test.link1',
        },
        {
          targetBlank: true,
          title: 'Link 2',
          url: 'http://some.test.link2',
        },
      ]);
    });
  });

  describe('Library panels', () => {
    it('given a library panel', () => {
      const libVizPanel = new VizPanel({
        key: 'panel-4',
        title: 'Panel blahh blah',
        $behaviors: [
          new LibraryPanelBehavior({
            name: 'Some lib panel panel',
            uid: 'lib-panel-uid',
          }),
        ],
        fieldConfig: {
          defaults: {},
          overrides: [],
        },
        options: {
          legend: {
            calcs: [],
            displayMode: 'list',
            placement: 'bottom',
            showLegend: true,
          },
          tooltip: {
            maxHeight: 600,
            mode: 'single',
            sort: 'none',
          },
        },
      });

      const panel = new DashboardGridItem({
        body: libVizPanel,
        y: 0,
        x: 0,
        width: 12,
        height: 8,
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
      expect(result.title).toBe('Panel blahh blah');
      expect(result.transformations).toBeUndefined();
      expect(result.fieldConfig).toBeUndefined();
      expect(result.options).toBeUndefined();
    });

    it('given a library panel widget', () => {
      const panel = buildGridItemFromPanelSchema({
        id: 4,
        gridPos: {
          h: 8,
          w: 12,
          x: 0,
          y: 0,
        },
        type: 'add-library-panel',
      });

      const result = gridItemToPanel(panel);

      expect(result.id).toBe(4);
      expect(result.gridPos).toEqual({
        h: 8,
        w: 12,
        x: 0,
        y: 0,
      });
      expect(result.type).toBe('add-library-panel');
    });
  });

  describe('Annotations', () => {
    it('should transform annotations to save model', () => {
      const scene = transformSaveModelToScene({ dashboard: dashboard_to_load1 as DashboardDataDTO, meta: {} });
      const saveModel = transformSceneToSaveModel(scene);

      expect(saveModel.annotations?.list?.length).toBe(4);
      expect(saveModel.annotations?.list).toMatchSnapshot();
    });

    it('should transform annotations to save model after state changes', () => {
      const scene = transformSaveModelToScene({ dashboard: dashboard_to_load1 as DashboardDataDTO, meta: {} });

      const layers = (scene.state.$data as DashboardDataLayerSet)?.state.annotationLayers;
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

      expect(result.transformations?.length).toBe(1);

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

      expect(result.transformations?.length).toBe(1);

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

    it('Given panel with query caching options', () => {
      const panel = buildGridItemFromPanelSchema({
        datasource: {
          type: 'grafana-testdata',
          uid: 'abc',
        },
        cacheTimeout: '10',
        queryCachingTTL: 200000,
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

      expect(result.cacheTimeout).toBe('10');
      expect(result.queryCachingTTL).toBe(200000);
    });
  });

  describe('Snapshots', () => {
    const fakeCurrentDate = dateTime('2023-01-01T20:00:00.000Z').toDate();

    beforeEach(() => {
      advanceTo(fakeCurrentDate);
    });

    it('attaches snapshot data to panels using Grafana snapshot query', async () => {
      const scene = transformSaveModelToScene({ dashboard: snapshotableDashboardJson as DashboardDataDTO, meta: {} });

      activateFullSceneTree(scene);

      await new Promise((r) => setTimeout(r, 1));

      const snapshot = transformSceneToSaveModel(scene, true);

      expect(snapshot.panels?.length).toBe(3);

      // Regular panel with SceneQueryRunner
      expect(snapshot.panels?.[0].datasource).toEqual(GRAFANA_DATASOURCE_REF);
      // @ts-expect-error
      expect(snapshot.panels?.[0].targets?.[0].datasource).toEqual(GRAFANA_DATASOURCE_REF);
      // @ts-expect-error
      expect(snapshot.panels?.[0].targets?.[0].snapshot[0].data).toEqual({
        values: [
          [100, 200, 300],
          [1, 2, 3],
        ],
      });

      // Panel with transformations
      expect(snapshot.panels?.[1].datasource).toEqual(GRAFANA_DATASOURCE_REF);
      // @ts-expect-error
      expect(snapshot.panels?.[1].targets?.[0].datasource).toEqual(GRAFANA_DATASOURCE_REF);
      // @ts-expect-error
      expect(snapshot.panels?.[1].targets?.[0].snapshot[0].data).toEqual({
        values: [
          [100, 200, 300],
          [10, 20, 30],
        ],
      });
      // @ts-expect-error
      expect(snapshot.panels?.[1].transformations).toEqual([
        {
          id: 'reduce',
          options: {},
        },
      ]);

      // Panel with a shared query (dahsboard query)
      expect(snapshot.panels?.[2].datasource).toEqual(GRAFANA_DATASOURCE_REF);
      // @ts-expect-error
      expect(snapshot.panels?.[2].targets?.[0].datasource).toEqual(GRAFANA_DATASOURCE_REF);
      // @ts-expect-error
      expect(snapshot.panels?.[2].targets?.[0].snapshot[0].data).toEqual({
        values: [
          [100, 200, 300],
          [1, 2, 3],
        ],
      });
    });

    it('handles basic rows', async () => {
      const scene = transformSaveModelToScene({
        dashboard: snapshotableWithRowsDashboardJson as DashboardDataDTO,
        meta: {},
      });

      activateFullSceneTree(scene);

      await new Promise((r) => setTimeout(r, 1));

      const snapshot = transformSceneToSaveModel(scene, true);

      expect(snapshot.panels?.length).toBe(5);

      // @ts-expect-error
      expect(snapshot.panels?.[0].targets?.[0].datasource).toEqual(GRAFANA_DATASOURCE_REF);
      // @ts-expect-error
      expect(snapshot.panels?.[0].targets?.[0].snapshot[0].data).toEqual({
        values: [
          [100, 200, 300],
          [1, 2, 3],
        ],
      });

      // @ts-expect-error
      expect(snapshot.panels?.[1].targets).toBeUndefined();
      // @ts-expect-error
      expect(snapshot.panels?.[1].panels).toEqual([]);
      // @ts-expect-error
      expect(snapshot.panels?.[1].collapsed).toEqual(false);

      // @ts-expect-error
      expect(snapshot.panels?.[2].targets?.[0].datasource).toEqual(GRAFANA_DATASOURCE_REF);
      // @ts-expect-error
      expect(snapshot.panels?.[2].targets?.[0].snapshot[0].data).toEqual({
        values: [
          [100, 200, 300],
          [10, 20, 30],
        ],
      });
      // @ts-expect-error
      expect(snapshot.panels?.[3].targets?.[0].datasource).toEqual(GRAFANA_DATASOURCE_REF);
      // @ts-expect-error
      expect(snapshot.panels?.[3].targets?.[0].snapshot[0].data).toEqual({
        values: [
          [1000, 2000, 3000],
          [100, 200, 300],
        ],
      });

      // @ts-expect-error
      expect(snapshot.panels?.[4].targets).toBeUndefined();
      // @ts-expect-error
      expect(snapshot.panels?.[4].panels).toHaveLength(1);
      // @ts-expect-error
      expect(snapshot.panels?.[4].collapsed).toEqual(true);
    });

    describe('repeats', () => {
      it('handles repeated panels', async () => {
        const { scene, repeater } = buildPanelRepeaterScene({ variableQueryTime: 0, numberOfOptions: 2 });

        activateFullSceneTree(scene);

        expect(repeater.state.repeatedPanels?.length).toBe(1);
        const result = panelRepeaterToPanels(repeater, true);

        expect(result).toHaveLength(2);

        // @ts-expect-error
        expect(result[0].scopedVars).toEqual({
          server: {
            text: 'A',
            value: '1',
          },
        });
        // @ts-expect-error
        expect(result[1].scopedVars).toEqual({
          server: {
            text: 'B',
            value: '2',
          },
        });

        expect(result[0].title).toEqual('Panel $server');
        expect(result[1].title).toEqual('Panel $server');
      });

      it('handles repeated library panels', () => {
        const { scene, repeater } = buildPanelRepeaterScene(
          { variableQueryTime: 0, numberOfOptions: 2 },
          new VizPanel({
            key: 'panel-4',
            title: 'Panel blahh blah',
            fieldConfig: {
              defaults: {},
              overrides: [],
            },
            options: {
              legend: {
                calcs: [],
                displayMode: 'list',
                placement: 'bottom',
                showLegend: true,
              },
              tooltip: {
                maxHeight: 600,
                mode: 'single',
                sort: 'none',
              },
            },
            $behaviors: [
              new LibraryPanelBehavior({
                name: 'Some lib panel panel',
                uid: 'lib-panel-uid',
              }),
            ],
          })
        );

        activateFullSceneTree(scene);
        const result = panelRepeaterToPanels(repeater, true);

        expect(result).toHaveLength(1);

        expect(result[0]).toMatchObject({
          id: 4,
          title: 'Panel blahh blah',
          libraryPanel: {
            name: 'Some lib panel panel',
            uid: 'lib-panel-uid',
          },
        });
      });

      it('handles row repeats ', () => {
        const { scene, row } = buildPanelRepeaterScene({
          variableQueryTime: 0,
          numberOfOptions: 2,
          useRowRepeater: true,
          usePanelRepeater: false,
        });

        activateFullSceneTree(scene);

        let panels: Panel[] = [];
        gridRowToSaveModel(row, panels, true);

        expect(panels).toHaveLength(2);
        expect(panels[0].repeat).toBe('handler');

        // @ts-expect-error
        expect(panels[0].scopedVars).toEqual({
          handler: {
            text: 'AA',
            value: '11',
          },
        });

        expect(panels[1].title).toEqual('Panel $server');
        expect(panels[1].gridPos).toEqual({ x: 0, y: 0, w: 10, h: 10 });
      });

      it('handles row repeats with panel repeater', () => {
        const { scene, row } = buildPanelRepeaterScene({
          variableQueryTime: 0,
          numberOfOptions: 2,
          useRowRepeater: true,
          usePanelRepeater: true,
        });

        activateFullSceneTree(scene);

        let panels: Panel[] = [];
        gridRowToSaveModel(row, panels, true);

        expect(panels[0].repeat).toBe('handler');

        // @ts-expect-error
        expect(panels[0].scopedVars).toEqual({
          handler: {
            text: 'AA',
            value: '11',
          },
        });

        // @ts-expect-error
        expect(panels[1].scopedVars).toEqual({
          server: {
            text: 'A',
            value: '1',
          },
        });
        // @ts-expect-error
        expect(panels[2].scopedVars).toEqual({
          server: {
            text: 'B',
            value: '2',
          },
        });

        expect(panels[1].title).toEqual('Panel $server');
        expect(panels[2].title).toEqual('Panel $server');
      });
    });

    describe('trimDashboardForSnapshot', () => {
      let snapshot: Dashboard = {} as Dashboard;

      beforeEach(() => {
        const scene = transformSaveModelToScene({ dashboard: snapshotableDashboardJson as DashboardDataDTO, meta: {} });
        activateFullSceneTree(scene);
        snapshot = transformSceneToSaveModel(scene, true);
      });

      it('should not mutate provided dashboard', () => {
        const result = trimDashboardForSnapshot('Snap title', getTimeRange({ from: 'now-6h', to: 'now' }), snapshot);
        expect(result).not.toBe(snapshot);
      });

      it('should apply provided title and absolute time range', async () => {
        const result = trimDashboardForSnapshot('Snap title', getTimeRange({ from: 'now-6h', to: 'now' }), snapshot);

        expect(result.title).toBe('Snap title');
        expect(result.time).toBeDefined();
        expect(result.time!.from).toEqual('2023-01-01T14:00:00.000Z');
        expect(result.time!.to).toEqual('2023-01-01T20:00:00.000Z');
      });

      it('should remove queries from annotations and attach empty snapshotData', () => {
        expect(snapshot.annotations?.list?.[0].target).toBeDefined();
        expect(snapshot.annotations?.list?.[1].target).toBeDefined();

        const result = trimDashboardForSnapshot('Snap title', getTimeRange({ from: 'now-6h', to: 'now' }), snapshot);

        expect(result.annotations?.list?.length).toBe(2);
        expect(result.annotations?.list?.[0].target).toBeUndefined();
        expect(result.annotations?.list?.[0].snapshotData).toEqual([]);
        expect(result.annotations?.list?.[1].target).toBeUndefined();
        expect(result.annotations?.list?.[1].snapshotData).toEqual([]);
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

      it('should snapshot a single panel when provided', () => {
        const vizPanel = new VizPanel({
          key: getVizPanelKeyForPanelId(2),
        });

        const result = trimDashboardForSnapshot(
          'Snap title',
          getTimeRange({ from: 'now-6h', to: 'now' }),
          snapshot,
          vizPanel
        );

        expect(snapshot.panels?.length).toBe(3);
        expect(result.panels?.length).toBe(1);
        expect(result.panels?.[0].gridPos).toEqual({ w: 24, x: 0, y: 0, h: 20 });
      });

      it('should remove links', async () => {
        const scene = transformSaveModelToScene({ dashboard: snapshotableDashboardJson as DashboardDataDTO, meta: {} });
        activateFullSceneTree(scene);
        const snapshot = transformSceneToSaveModel(scene, true);
        expect(snapshot.links?.length).toBe(1);
        const result = trimDashboardForSnapshot('Snap title', getTimeRange({ from: 'now-6h', to: 'now' }), snapshot);
        expect(result.links?.length).toBe(0);
      });
    });
  });

  describe('Given a scene with repeated panels and non-repeated panels', () => {
    it('should save repeated panels itemHeight as height', () => {
      const scene = transformSaveModelToScene({
        dashboard: repeatingRowsAndPanelsDashboardJson as DashboardDataDTO,
        meta: {},
      });
      const gridItem = sceneGraph.findByKey(scene, 'grid-item-2') as DashboardGridItem;
      expect(gridItem).toBeInstanceOf(DashboardGridItem);
      expect(gridItem.state.height).toBe(10);
      expect(gridItem.state.itemHeight).toBe(10);
      expect(gridItem.state.itemHeight).toBe(10);
      expect(gridItem.state.variableName).toBe('pod');
      gridItem.setState({ itemHeight: 24 });
      const saveModel = transformSceneToSaveModel(scene);
      expect(saveModel.panels?.[3].gridPos?.h).toBe(24);
    });

    it('should not save non-repeated panels itemHeight as height', () => {
      const scene = transformSaveModelToScene({
        dashboard: repeatingRowsAndPanelsDashboardJson as DashboardDataDTO,
        meta: {},
      });
      const gridItem = sceneGraph.findByKey(scene, 'grid-item-15') as DashboardGridItem;
      expect(gridItem).toBeInstanceOf(DashboardGridItem);
      expect(gridItem.state.height).toBe(2);
      expect(gridItem.state.itemHeight).toBe(2);
      expect(gridItem.state.variableName).toBeUndefined();
      gridItem.setState({ itemHeight: 24 });
      let saveModel = transformSceneToSaveModel(scene);
      expect(saveModel.panels?.[1].gridPos?.h).toBe(2);

      gridItem.setState({ height: 34 });
      saveModel = transformSceneToSaveModel(scene);
      expect(saveModel.panels?.[1].gridPos?.h).toBe(34);
    });
  });
});

describe('Given a scene with custom quick ranges', () => {
  it('should save quick ranges to save model', () => {
    const dashboardWithCustomSettings = {
      ...dashboard_to_load1,
      timepicker: {
        ...dashboard_to_load1.timepicker,
        quick_ranges: [
          {
            display: 'Last 6 hours',
            from: 'now-6h',
            to: 'now',
          },
          {
            display: 'Last 3 days',
            from: 'now-3d',
            to: 'now',
          },
        ],
      },
    };
    const scene = transformSaveModelToScene({ dashboard: dashboardWithCustomSettings as DashboardDataDTO, meta: {} });
    const saveModel = transformSceneToSaveModel(scene);

    expect(saveModel).toMatchSnapshot();
  });
});

export function buildGridItemFromPanelSchema(panel: Partial<Panel>) {
  return buildGridItemForPanel(new PanelModel(panel));
}

describe('rowItemToSaveModel', () => {
  it('should convert an expanded row with panels to v1beta1 format with correct Y positions', () => {
    // Create a row with a panel at relative Y=0
    const gridItem = new DashboardGridItem({
      key: 'griditem-1',
      x: 0,
      y: 0,
      width: 12,
      height: 8,
      body: new VizPanel({
        key: 'panel-1',
        title: 'Test Panel',
        pluginId: 'timeseries',
      }),
    });

    const rowItem = new RowItem({
      title: 'Test Row',
      collapse: false,
      layout: new DefaultGridLayoutManager({
        grid: new SceneGridLayout({
          children: [gridItem],
        }),
      }),
    });

    const panelsArray: Array<Panel | RowPanel> = [];
    const nextY = rowItemToSaveModel(rowItem, panelsArray, false, 5);

    // Should have 2 items: row panel + content panel
    expect(panelsArray).toHaveLength(2);

    // Row panel should be at Y=5 (the starting currentY)
    const rowPanel = panelsArray[0] as RowPanel;
    expect(rowPanel.type).toBe('row');
    expect(rowPanel.title).toBe('Test Row');
    expect(rowPanel.gridPos?.y).toBe(5);
    expect(rowPanel.gridPos?.h).toBe(1);
    expect(rowPanel.collapsed).toBe(false);

    // Content panel should be at Y=6 (panelStartY = currentY + 1)
    // Panel at relative Y=0 gets absolute Y = 0 + 6 = 6
    const contentPanel = panelsArray[1] as Panel;
    expect(contentPanel.title).toBe('Test Panel');
    expect(contentPanel.gridPos?.y).toBe(6);
    expect(contentPanel.gridPos?.h).toBe(8);

    // Next Y should be panelStartY + maxRelativeY = 6 + 8 = 14
    expect(nextY).toBe(14);
  });

  it('should convert a collapsed row with panels stored inside the row panel', () => {
    const gridItem = new DashboardGridItem({
      key: 'griditem-1',
      x: 0,
      y: 0,
      width: 12,
      height: 8,
      body: new VizPanel({
        key: 'panel-1',
        title: 'Collapsed Panel',
        pluginId: 'timeseries',
      }),
    });

    const rowItem = new RowItem({
      title: 'Collapsed Row',
      collapse: true,
      layout: new DefaultGridLayoutManager({
        grid: new SceneGridLayout({
          children: [gridItem],
        }),
      }),
    });

    const panelsArray: Array<Panel | RowPanel> = [];
    const nextY = rowItemToSaveModel(rowItem, panelsArray, false, 10);

    // Should have only 1 item: the row panel (panels are stored inside)
    expect(panelsArray).toHaveLength(1);

    const rowPanel = panelsArray[0] as RowPanel;
    expect(rowPanel.type).toBe('row');
    expect(rowPanel.title).toBe('Collapsed Row');
    expect(rowPanel.gridPos?.y).toBe(10);
    expect(rowPanel.collapsed).toBe(true);

    // Collapsed panels should be stored inside the row with absolute Y
    // panelStartY = 10 + 1 = 11, panel Y = 0 + 11 = 11
    expect(rowPanel.panels).toHaveLength(1);
    expect(rowPanel.panels![0].title).toBe('Collapsed Panel');
    expect(rowPanel.panels![0].gridPos?.y).toBe(11);

    // Next Y should be panelStartY + maxRelativeY = 11 + 8 = 19
    expect(nextY).toBe(19);
  });

  it('should handle hidden header rows without creating a row panel', () => {
    const gridItem = new DashboardGridItem({
      key: 'griditem-1',
      x: 0,
      y: 0,
      width: 12,
      height: 8,
      body: new VizPanel({
        key: 'panel-1',
        title: 'Panel in Hidden Header Row',
        pluginId: 'timeseries',
      }),
    });

    const rowItem = new RowItem({
      title: 'Hidden Header Row',
      collapse: false,
      hideHeader: true,
      layout: new DefaultGridLayoutManager({
        grid: new SceneGridLayout({
          children: [gridItem],
        }),
      }),
    });

    const panelsArray: Array<Panel | RowPanel> = [];
    const nextY = rowItemToSaveModel(rowItem, panelsArray, false, 3);

    // Should have only 1 item: the content panel (no row panel for hidden header)
    expect(panelsArray).toHaveLength(1);

    const contentPanel = panelsArray[0] as Panel;
    expect(contentPanel.title).toBe('Panel in Hidden Header Row');
    // Hidden header rows keep relative Y positions (no adjustment)
    expect(contentPanel.gridPos?.y).toBe(0);

    // For hidden header rows with DefaultGridLayoutManager, currentY IS updated
    // based on panel heights so next row starts after this content
    // Panel at y=0 with h=8 means max extent = 8
    expect(nextY).toBe(8);
  });

  it('should handle row with repeat variable', () => {
    const gridItem = new DashboardGridItem({
      key: 'griditem-1',
      x: 0,
      y: 0,
      width: 12,
      height: 8,
      body: new VizPanel({
        key: 'panel-1',
        title: 'Repeated Panel',
        pluginId: 'timeseries',
      }),
    });

    const rowItem = new RowItem({
      title: 'Repeated Row $var',
      collapse: false,
      repeatByVariable: 'var',
      layout: new DefaultGridLayoutManager({
        grid: new SceneGridLayout({
          children: [gridItem],
        }),
      }),
    });

    const panelsArray: Array<Panel | RowPanel> = [];
    rowItemToSaveModel(rowItem, panelsArray, false, 0);

    const rowPanel = panelsArray[0] as RowPanel;
    expect(rowPanel.type).toBe('row');
    expect(rowPanel.repeat).toBe('var');
  });

  it('should handle multiple rows with correct Y progression', () => {
    // First row with a panel at relative Y=0, H=8
    const gridItem1 = new DashboardGridItem({
      key: 'griditem-1',
      x: 0,
      y: 0,
      width: 12,
      height: 8,
      body: new VizPanel({
        key: 'panel-1',
        title: 'Panel 1',
        pluginId: 'timeseries',
      }),
    });

    const rowItem1 = new RowItem({
      title: 'Row 1',
      collapse: false,
      layout: new DefaultGridLayoutManager({
        grid: new SceneGridLayout({
          children: [gridItem1],
        }),
      }),
    });

    // Second row with a panel at relative Y=0, H=4
    const gridItem2 = new DashboardGridItem({
      key: 'griditem-2',
      x: 0,
      y: 0,
      width: 12,
      height: 4,
      body: new VizPanel({
        key: 'panel-2',
        title: 'Panel 2',
        pluginId: 'timeseries',
      }),
    });

    const rowItem2 = new RowItem({
      title: 'Row 2',
      collapse: false,
      layout: new DefaultGridLayoutManager({
        grid: new SceneGridLayout({
          children: [gridItem2],
        }),
      }),
    });

    const panelsArray: Array<Panel | RowPanel> = [];

    // Process first row starting at Y=0
    // Row 1 at Y=0, panel at panelStartY=1, nextY = 1 + 8 = 9
    let nextY = rowItemToSaveModel(rowItem1, panelsArray, false, 0);
    expect(nextY).toBe(9);

    // Process second row starting at the returned Y=9
    // Row 2 at Y=9, panel at panelStartY=10, nextY = 10 + 4 = 14
    nextY = rowItemToSaveModel(rowItem2, panelsArray, false, nextY);
    expect(nextY).toBe(14);

    // Should have 4 items total: 2 row panels + 2 content panels
    expect(panelsArray).toHaveLength(4);

    // First row at Y=0
    expect((panelsArray[0] as RowPanel).gridPos?.y).toBe(0);
    // First panel at panelStartY = 0 + 1 = 1
    expect((panelsArray[1] as Panel).gridPos?.y).toBe(1);
    // Second row at Y=9
    expect((panelsArray[2] as RowPanel).gridPos?.y).toBe(9);
    // Second panel at panelStartY = 9 + 1 = 10
    expect((panelsArray[3] as Panel).gridPos?.y).toBe(10);
  });

  it('should handle expanded parent row with nested rows (flattening to top level)', () => {
    // Create a nested row with a panel
    const nestedGridItem = new DashboardGridItem({
      key: 'nested-griditem-1',
      x: 0,
      y: 0,
      width: 12,
      height: 6,
      body: new VizPanel({
        key: 'nested-panel-1',
        title: 'Nested Panel',
        pluginId: 'timeseries',
      }),
    });

    const nestedRow = new RowItem({
      title: 'Nested Row',
      collapse: false,
      layout: new DefaultGridLayoutManager({
        grid: new SceneGridLayout({
          children: [nestedGridItem],
        }),
      }),
    });

    // Create parent row that contains nested rows via RowsLayoutManager
    const parentRow = new RowItem({
      title: 'Parent Row',
      collapse: false,
      layout: new RowsLayoutManager({
        rows: [nestedRow],
      }),
    });

    const panelsArray: Array<Panel | RowPanel> = [];
    const nextY = rowItemToSaveModel(parentRow, panelsArray, false, 0);

    // For expanded parent with nested rows, content is flattened to top level
    // Should have: parent row panel + nested row panel + nested panel
    expect(panelsArray).toHaveLength(3);

    // Parent row at Y=0
    const parentRowPanel = panelsArray[0] as RowPanel;
    expect(parentRowPanel.type).toBe('row');
    expect(parentRowPanel.title).toBe('Parent Row');
    expect(parentRowPanel.gridPos?.y).toBe(0);

    // Nested row at Y=1 (currentY + 1 after parent row)
    const nestedRowPanel = panelsArray[1] as RowPanel;
    expect(nestedRowPanel.type).toBe('row');
    expect(nestedRowPanel.title).toBe('Nested Row');
    expect(nestedRowPanel.gridPos?.y).toBe(1);

    // Nested panel at Y=2 (panelStartY = 1 + 1 = 2)
    const nestedPanel = panelsArray[2] as Panel;
    expect(nestedPanel.title).toBe('Nested Panel');
    expect(nestedPanel.gridPos?.y).toBe(2);

    // Next Y should be after all nested content
    // Nested row: panelStartY=2, maxRelativeY=6, nextY = 2 + 6 = 8
    expect(nextY).toBe(8);
  });

  it('should handle collapsed parent row with nested rows (storing inside parent)', () => {
    // Create a nested row with a panel
    const nestedGridItem = new DashboardGridItem({
      key: 'nested-griditem-1',
      x: 0,
      y: 0,
      width: 12,
      height: 6,
      body: new VizPanel({
        key: 'nested-panel-1',
        title: 'Nested Panel in Collapsed Parent',
        pluginId: 'timeseries',
      }),
    });

    const nestedRow = new RowItem({
      title: 'Nested Row',
      collapse: false,
      layout: new DefaultGridLayoutManager({
        grid: new SceneGridLayout({
          children: [nestedGridItem],
        }),
      }),
    });

    // Create COLLAPSED parent row that contains nested rows
    const parentRow = new RowItem({
      title: 'Collapsed Parent Row',
      collapse: true,
      layout: new RowsLayoutManager({
        rows: [nestedRow],
      }),
    });

    const panelsArray: Array<Panel | RowPanel> = [];
    rowItemToSaveModel(parentRow, panelsArray, false, 5);

    // For collapsed parent with nested rows, only the parent row panel is added
    // Nested content is flattened and stored inside parent's panels array
    expect(panelsArray).toHaveLength(1);

    const parentRowPanel = panelsArray[0] as RowPanel;
    expect(parentRowPanel.type).toBe('row');
    expect(parentRowPanel.title).toBe('Collapsed Parent Row');
    expect(parentRowPanel.gridPos?.y).toBe(5);
    expect(parentRowPanel.collapsed).toBe(true);

    // Nested panels should be stored inside the parent row
    expect(parentRowPanel.panels).toHaveLength(1);
    expect(parentRowPanel.panels![0].title).toBe('Nested Panel in Collapsed Parent');
  });

  it('should handle multiple levels of nested rows when expanded', () => {
    // Create innermost panel
    const innerGridItem = new DashboardGridItem({
      key: 'inner-griditem',
      x: 0,
      y: 0,
      width: 12,
      height: 4,
      body: new VizPanel({
        key: 'inner-panel',
        title: 'Inner Panel',
        pluginId: 'timeseries',
      }),
    });

    // Create inner row
    const innerRow = new RowItem({
      title: 'Inner Row',
      collapse: false,
      layout: new DefaultGridLayoutManager({
        grid: new SceneGridLayout({
          children: [innerGridItem],
        }),
      }),
    });

    // Create middle row containing inner row
    const middleRow = new RowItem({
      title: 'Middle Row',
      collapse: false,
      layout: new RowsLayoutManager({
        rows: [innerRow],
      }),
    });

    // Create outer row containing middle row
    const outerRow = new RowItem({
      title: 'Outer Row',
      collapse: false,
      layout: new RowsLayoutManager({
        rows: [middleRow],
      }),
    });

    const panelsArray: Array<Panel | RowPanel> = [];
    const nextY = rowItemToSaveModel(outerRow, panelsArray, false, 0);

    // All rows should be flattened to top level
    // Should have: outer row + middle row + inner row + inner panel
    expect(panelsArray).toHaveLength(4);

    // Outer Row at Y=0
    expect((panelsArray[0] as RowPanel).title).toBe('Outer Row');
    expect((panelsArray[0] as RowPanel).gridPos?.y).toBe(0);
    // Middle Row at Y=1 (after outer)
    expect((panelsArray[1] as RowPanel).title).toBe('Middle Row');
    expect((panelsArray[1] as RowPanel).gridPos?.y).toBe(1);
    // Inner Row at Y=2 (after middle)
    expect((panelsArray[2] as RowPanel).title).toBe('Inner Row');
    expect((panelsArray[2] as RowPanel).gridPos?.y).toBe(2);
    // Inner Panel at Y=3 (panelStartY = 2 + 1)
    expect((panelsArray[3] as Panel).title).toBe('Inner Panel');
    expect((panelsArray[3] as Panel).gridPos?.y).toBe(3);

    // Next Y should be after all content
    // Inner row: panelStartY=3, maxRelativeY=4, nextY = 3 + 4 = 7
    expect(nextY).toBe(7);
  });

  it('should handle hidden header row with multiple panels and update currentY correctly', () => {
    // Create two panels at different Y positions
    const gridItem1 = new DashboardGridItem({
      key: 'griditem-1',
      x: 0,
      y: 0,
      width: 12,
      height: 8,
      body: new VizPanel({
        key: 'panel-1',
        title: 'Panel 1',
        pluginId: 'timeseries',
      }),
    });

    const gridItem2 = new DashboardGridItem({
      key: 'griditem-2',
      x: 0,
      y: 8,
      width: 12,
      height: 6,
      body: new VizPanel({
        key: 'panel-2',
        title: 'Panel 2',
        pluginId: 'timeseries',
      }),
    });

    const hiddenHeaderRow = new RowItem({
      title: '',
      collapse: false,
      hideHeader: true,
      layout: new DefaultGridLayoutManager({
        grid: new SceneGridLayout({
          children: [gridItem1, gridItem2],
        }),
      }),
    });

    // Following row to verify Y progression
    const gridItem3 = new DashboardGridItem({
      key: 'griditem-3',
      x: 0,
      y: 0,
      width: 12,
      height: 4,
      body: new VizPanel({
        key: 'panel-3',
        title: 'Panel 3',
        pluginId: 'timeseries',
      }),
    });

    const followingRow = new RowItem({
      title: 'Following Row',
      collapse: false,
      layout: new DefaultGridLayoutManager({
        grid: new SceneGridLayout({
          children: [gridItem3],
        }),
      }),
    });

    const panelsArray: Array<Panel | RowPanel> = [];

    // Process hidden header row starting at Y=0
    let nextY = rowItemToSaveModel(hiddenHeaderRow, panelsArray, false, 0);

    // Hidden header row panels keep relative Y, but currentY advances
    // Panel 1: y=0, h=8
    // Panel 2: y=8, h=6 -> max extent = 14
    expect(nextY).toBe(14);
    expect(panelsArray).toHaveLength(2);
    expect((panelsArray[0] as Panel).gridPos?.y).toBe(0);
    expect((panelsArray[1] as Panel).gridPos?.y).toBe(8);

    // Process following row - should start at Y=14
    nextY = rowItemToSaveModel(followingRow, panelsArray, false, nextY);

    expect(panelsArray).toHaveLength(4); // 2 from hidden header + row panel + panel
    const followingRowPanel = panelsArray[2] as RowPanel;
    expect(followingRowPanel.type).toBe('row');
    expect(followingRowPanel.title).toBe('Following Row');
    expect(followingRowPanel.gridPos?.y).toBe(14); // Starts after hidden header content
  });
});
