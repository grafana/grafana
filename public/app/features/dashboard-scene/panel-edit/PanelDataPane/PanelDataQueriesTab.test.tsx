import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { of, map } from 'rxjs';

import {
  DataQuery,
  DataQueryRequest,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataSourceJsonData,
  DataSourceRef,
  FieldType,
  LoadingState,
  PanelData,
  PluginType,
  TimeRange,
  toDataFrame,
} from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { selectors } from '@grafana/e2e-selectors';
import { config, locationService } from '@grafana/runtime';
import { PANEL_EDIT_LAST_USED_DATASOURCE } from 'app/features/dashboard/utils/dashboard';
import { InspectTab } from 'app/features/inspector/types';
import { SHARED_DASHBOARD_QUERY, DASHBOARD_DATASOURCE_PLUGIN_ID } from 'app/plugins/datasource/dashboard/constants';
import { DashboardDataDTO } from 'app/types';

import { PanelTimeRange, PanelTimeRangeState } from '../../scene/PanelTimeRange';
import { transformSaveModelToScene } from '../../serialization/transformSaveModelToScene';
import { findVizPanelByKey } from '../../utils/utils';
import { buildPanelEditScene } from '../PanelEditor';
import { testDashboard, panelWithTransformations, panelWithQueriesOnly } from '../testfiles/testDashboard';

import { PanelDataQueriesTab, PanelDataQueriesTabRendered } from './PanelDataQueriesTab';

async function createModelMock() {
  const { queriesTab } = await setupScene('panel-1');

  // mock queryRunner data state
  jest.spyOn(queriesTab.queryRunner, 'state', 'get').mockReturnValue({
    ...queriesTab.queryRunner.state,
    data: {
      state: LoadingState.Done,
      series: [
        toDataFrame({
          name: 'A',
          fields: [
            { name: 'time', type: FieldType.time, values: [100, 200, 300] },
            { name: 'values', type: FieldType.number, values: [1, 2, 3] },
          ],
        }),
      ],
      timeRange: {} as TimeRange,
    },
  });

  return queriesTab;
}

const runRequestMock = jest.fn().mockImplementation((ds: DataSourceApi, request: DataQueryRequest) => {
  const result: PanelData = {
    state: LoadingState.Loading,
    series: [],
    timeRange: request.range,
  };

  return of([]).pipe(
    map(() => {
      result.state = LoadingState.Done;
      result.series = [
        toDataFrame({
          name: 'A',
          fields: [
            { name: 'time', type: FieldType.time, values: [100, 200, 300] },
            { name: 'values', type: FieldType.number, values: [1, 2, 3] },
          ],
        }),
      ];

      return result;
    })
  );
});

const ds1Mock: DataSourceApi = {
  meta: {
    id: 'grafana-testdata-datasource',
  },
  name: 'grafana-testdata-datasource',
  type: 'grafana-testdata-datasource',
  uid: 'gdev-testdata',
  getRef: () => {
    return { type: 'grafana-testdata-datasource', uid: 'gdev-testdata' };
  },
} as DataSourceApi<DataQuery, DataSourceJsonData, {}>;

const ds2Mock: DataSourceApi = {
  meta: {
    id: 'grafana-prometheus-datasource',
  },
  name: 'grafana-prometheus-datasource',
  type: 'grafana-prometheus-datasource',
  uid: 'gdev-prometheus',
  getRef: () => {
    return { type: 'grafana-prometheus-datasource', uid: 'gdev-prometheus' };
  },
} as DataSourceApi<DataQuery, DataSourceJsonData, {}>;

const ds3Mock: DataSourceApi = {
  meta: {
    id: DASHBOARD_DATASOURCE_PLUGIN_ID,
  },
  name: SHARED_DASHBOARD_QUERY,
  type: SHARED_DASHBOARD_QUERY,
  uid: SHARED_DASHBOARD_QUERY,
  getRef: () => {
    return { type: SHARED_DASHBOARD_QUERY, uid: SHARED_DASHBOARD_QUERY };
  },
} as DataSourceApi<DataQuery, DataSourceJsonData, {}>;

const defaultDsMock: DataSourceApi = {
  meta: {
    id: 'grafana-testdata-datasource',
  },
  name: 'grafana-testdata-datasource',
  type: 'grafana-testdata-datasource',
  uid: 'gdev-testdata',
  getRef: () => {
    return { type: 'grafana-testdata-datasource', uid: 'gdev-testdata' };
  },
} as DataSourceApi<DataQuery, DataSourceJsonData, {}>;

const instance1SettingsMock = {
  id: 1,
  uid: 'gdev-testdata',
  name: 'testDs1',
  type: 'grafana-testdata-datasource',
  meta: {
    id: 'grafana-testdata-datasource',
    info: {
      logos: {
        small: 'test-logo.png',
      },
    },
  },
};

const instance2SettingsMock = {
  id: 1,
  uid: 'gdev-prometheus',
  name: 'testDs2',
  type: 'grafana-prometheus-datasource',
  meta: {
    id: 'grafana-prometheus-datasource',
  },
};

// Mocking the build in Grafana data source to avoid annotations data layer errors.
const grafanaDs = {
  id: 1,
  uid: '-- Grafana --',
  name: 'grafana',
  type: 'grafana',
  meta: {
    id: 'grafana',
  },
};

// Mocking the build in Grafana data source to avoid annotations data layer errors.
const MixedDs = {
  id: 5,
  uid: '-- Mixed --',
  name: 'Mixed',
  type: 'datasource',
  meta: {
    id: 'grafana',
    mixed: true,
  },
};

const MixedDsSettingsMock = {
  id: 5,
  uid: '-- Mixed --',
  name: 'Mixed',
  type: 'datasource',
  meta: {
    id: 'grafana',
    mixed: true,
  },
};

const panelPlugin = getPanelPlugin({ id: 'timeseries', skipDataQuery: false });

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getRunRequest: () => (ds: DataSourceApi, request: DataQueryRequest) => {
    return runRequestMock(ds, request);
  },
  getPluginImportUtils: () => ({
    getPanelPluginFromCache: jest.fn(() => panelPlugin),
  }),
  getPluginLinkExtensions: jest.fn(),
  getDataSourceSrv: () => ({
    get: async (ref: DataSourceRef) => {
      // Mocking the build in Grafana data source to avoid annotations data layer errors.
      if (ref.uid === '-- Grafana --') {
        return grafanaDs;
      }

      if (ref.uid === 'gdev-testdata') {
        return ds1Mock;
      }

      if (ref.uid === 'gdev-prometheus') {
        return ds2Mock;
      }

      if (ref.uid === '-- Mixed --') {
        return MixedDs;
      }

      if (ref.uid === SHARED_DASHBOARD_QUERY) {
        return ds3Mock;
      }

      // if datasource is not found, return default datasource
      return defaultDsMock;
    },
    getInstanceSettings: (ref: DataSourceRef) => {
      if (ref.uid === 'gdev-testdata') {
        return instance1SettingsMock;
      }

      if (ref.uid === 'gdev-prometheus') {
        return instance2SettingsMock;
      }

      if (ref.uid === '-- Mixed --') {
        return MixedDsSettingsMock;
      }

      // if datasource is not found, return default instance settings
      return instance1SettingsMock;
    },
  }),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    defaultDatasource: 'gdev-testdata',
    expressionsEnabled: true,
  },
}));

jest.mock('app/core/store', () => ({
  exists: jest.fn(),
  get: jest.fn(),
  getObject: jest.fn((_a, b) => b),
  setObject: jest.fn(),
  delete: jest.fn(),
}));

const store = jest.requireMock('app/core/store');
let deactivators = [] as Array<() => void>;

describe('PanelDataQueriesTab', () => {
  beforeEach(() => {
    store.setObject.mockClear();
  });

  afterEach(() => {
    deactivators.forEach((deactivate) => deactivate());
    deactivators = [];
  });

  describe('Adding queries', () => {
    it('can add a new query', async () => {
      const { queriesTab } = await setupScene('panel-1');

      queriesTab.addQueryClick();

      expect(queriesTab.queryRunner.state.queries).toHaveLength(2);
      expect(queriesTab.queryRunner.state.queries[1].refId).toBe('B');
      expect(queriesTab.queryRunner.state.queries[1].hide).toBe(false);
      expect(queriesTab.queryRunner.state.queries[1].datasource).toEqual({
        type: 'grafana-testdata-datasource',
        uid: 'gdev-testdata',
      });
    });

    it('Can add a new query when datasource is mixed', async () => {
      const { queriesTab } = await setupScene('panel-7');

      expect(queriesTab.state.datasource?.uid).toBe('-- Mixed --');
      expect(queriesTab.queryRunner.state.datasource?.uid).toBe('-- Mixed --');

      queriesTab.addQueryClick();

      expect(queriesTab.queryRunner.state.queries).toHaveLength(2);
      expect(queriesTab.queryRunner.state.queries[1].refId).toBe('B');
      expect(queriesTab.queryRunner.state.queries[1].hide).toBe(false);
      expect(queriesTab.queryRunner.state.queries[1].datasource?.uid).toBe('gdev-testdata');
    });
  });

  describe('PanelDataQueriesTab', () => {
    it('renders query group top section', async () => {
      const modelMock = await createModelMock();

      render(<PanelDataQueriesTabRendered model={modelMock}></PanelDataQueriesTabRendered>);
      await screen.findByTestId(selectors.components.QueryTab.queryGroupTopSection);
    });

    it('renders queries rows when queries are set', async () => {
      const modelMock = await createModelMock();
      render(<PanelDataQueriesTabRendered model={modelMock}></PanelDataQueriesTabRendered>);

      await screen.findByTestId('query-editor-rows');
      expect(screen.getAllByTestId('query-editor-row')).toHaveLength(1);
    });

    it('allow to add a new query when user clicks on add new', async () => {
      const modelMock = await createModelMock();
      jest.spyOn(modelMock, 'addQueryClick');
      jest.spyOn(modelMock, 'onQueriesChange');
      render(<PanelDataQueriesTabRendered model={modelMock}></PanelDataQueriesTabRendered>);

      await screen.findByTestId(selectors.components.QueryTab.addQuery);
      await userEvent.click(screen.getByTestId(selectors.components.QueryTab.addQuery));

      const expectedQueries = [
        {
          datasource: { type: 'grafana-testdata-datasource', uid: 'gdev-testdata' },
          refId: 'A',
          scenarioId: 'random_walk',
          seriesCount: 1,
        },
        { datasource: { type: 'grafana-testdata-datasource', uid: 'gdev-testdata' }, hide: false, refId: 'B' },
      ];

      expect(modelMock.addQueryClick).toHaveBeenCalled();
      expect(modelMock.onQueriesChange).toHaveBeenCalledWith(expectedQueries);
    });

    it('allow to remove a query when user clicks on remove', async () => {
      const modelMock = await createModelMock();
      jest.spyOn(modelMock, 'addQueryClick');
      jest.spyOn(modelMock, 'onQueriesChange');
      render(<PanelDataQueriesTabRendered model={modelMock}></PanelDataQueriesTabRendered>);

      await screen.findByTestId('data-testid Remove query');
      await userEvent.click(screen.getByTestId('data-testid Remove query'));

      expect(modelMock.onQueriesChange).toHaveBeenCalledWith([]);
    });

    it('renders add expression button when datasource meta.backend is true', async () => {
      // arrange
      const modelMock = await createModelMock();
      const dsSettingsMock: DataSourceInstanceSettings<DataSourceJsonData> = {
        id: 1,
        uid: 'gdev-testdata',
        name: 'testDs1',
        type: 'grafana-testdata-datasource',
        meta: {
          id: 'grafana-testdata-datasource',
          info: {
            logos: {
              small: 'test-logo.png',
              large: 'test-logo.png',
            },
            author: {
              name: '',
              url: undefined,
            },
            description: '',
            links: [],
            screenshots: [],
            updated: '',
            version: '',
          },
          backend: true,
          name: '',
          type: PluginType.datasource,
          module: '',
          baseUrl: '',
        },
        readOnly: false,
        jsonData: {},
        access: 'proxy',
      };
      modelMock.setState({ datasource: ds1Mock, dsSettings: dsSettingsMock });

      // act
      render(<PanelDataQueriesTabRendered model={modelMock}></PanelDataQueriesTabRendered>);

      // assert
      await screen.findByTestId(selectors.components.QueryTab.addExpression);
    });
  });

  describe('query options', () => {
    describe('activation', () => {
      it('should load data source', async () => {
        const { queriesTab } = await setupScene('panel-1');

        expect(queriesTab.state.datasource).toEqual(ds1Mock);
        expect(queriesTab.state.dsSettings).toEqual(instance1SettingsMock);
      });

      it('should store loaded data source in local storage', async () => {
        await setupScene('panel-1');

        expect(store.setObject).toHaveBeenCalledWith('grafana.dashboards.panelEdit.lastUsedDatasource', {
          dashboardUid: 'ffbe00e2-803c-4d49-adb7-41aad336234f',
          datasourceUid: 'gdev-testdata',
        });
      });

      it('should load default datasource if the datasource passed is not found', async () => {
        const { queriesTab } = await setupScene('panel-6');

        expect(queriesTab.queryRunner.state.datasource).toEqual({
          uid: 'abc',
          type: 'datasource',
        });

        expect(config.defaultDatasource).toBe('gdev-testdata');
        expect(queriesTab.state.datasource).toEqual(defaultDsMock);
        expect(queriesTab.state.dsSettings).toEqual(instance1SettingsMock);
      });
    });

    describe('data source change', () => {
      it('should load new data source', async () => {
        const { queriesTab, panel } = await setupScene('panel-1');
        panel.state.$data?.activate();

        await queriesTab.onChangeDataSource(
          { type: 'grafana-prometheus-datasource', uid: 'gdev-prometheus' } as DataSourceInstanceSettings,
          []
        );

        expect(store.setObject).toHaveBeenCalledTimes(2);
        expect(store.setObject).toHaveBeenLastCalledWith('grafana.dashboards.panelEdit.lastUsedDatasource', {
          dashboardUid: 'ffbe00e2-803c-4d49-adb7-41aad336234f',
          datasourceUid: 'gdev-prometheus',
        });

        expect(queriesTab.state.datasource).toEqual(ds2Mock);
        expect(queriesTab.state.dsSettings).toEqual(instance2SettingsMock);
      });
    });

    describe('query options change', () => {
      describe('time overrides', () => {
        it('should create PanelTimeRange object', async () => {
          const { queriesTab, panel } = await setupScene('panel-1');

          panel.state.$data?.activate();

          expect(panel.state.$timeRange).toBeUndefined();

          queriesTab.onQueryOptionsChange({
            dataSource: { name: 'grafana-testdata', type: 'grafana-testdata-datasource', default: true },
            queries: [],
            timeRange: { from: '1h' },
          });

          expect(panel.state.$timeRange).toBeInstanceOf(PanelTimeRange);
        });

        it('should update hoverHeader', async () => {
          const { queriesTab, panel } = await setupScene('panel-1');

          panel.setState({ title: '', hoverHeader: true });

          panel.state.$data?.activate();

          queriesTab.onQueryOptionsChange({
            dataSource: { name: 'grafana-testdata', type: 'grafana-testdata-datasource', default: true },
            queries: [],
            timeRange: { from: '1h' },
          });

          expect(panel.state.hoverHeader).toBe(false);
        });

        it('should update PanelTimeRange object on time options update', async () => {
          const { queriesTab, panel } = await setupScene('panel-1');

          expect(panel.state.$timeRange).toBeUndefined();

          queriesTab.onQueryOptionsChange({
            dataSource: { name: 'grafana-testdata', type: 'grafana-testdata-datasource', default: true },
            queries: [],
            timeRange: { from: '1h' },
          });

          expect(panel.state.$timeRange).toBeInstanceOf(PanelTimeRange);
          expect((panel.state.$timeRange?.state as PanelTimeRangeState).timeFrom).toBe('1h');

          queriesTab.onQueryOptionsChange({
            dataSource: { name: 'grafana-testdata', type: 'grafana-testdata-datasource', default: true },
            queries: [],
            timeRange: { from: '2h' },
          });

          expect((panel.state.$timeRange?.state as PanelTimeRangeState).timeFrom).toBe('2h');
        });

        it('should remove PanelTimeRange object on time options cleared', async () => {
          const { queriesTab, panel } = await setupScene('panel-1');

          expect(panel.state.$timeRange).toBeUndefined();

          queriesTab.onQueryOptionsChange({
            dataSource: { name: 'grafana-testdata', type: 'grafana-testdata-datasource', default: true },
            queries: [],
            timeRange: { from: '1h' },
          });

          queriesTab.onQueryOptionsChange({
            dataSource: {
              name: 'grafana-testdata',
              type: 'grafana-testdata-datasource',
              default: true,
            },
            queries: [],
            timeRange: { from: null },
          });

          expect(panel.state.$timeRange).toBeUndefined();
        });
      });

      describe('max data points and interval', () => {
        it('should update max data points', async () => {
          const { queriesTab } = await setupScene('panel-1');
          const dataObj = queriesTab.queryRunner;

          expect(dataObj.state.maxDataPoints).toBeUndefined();

          queriesTab.onQueryOptionsChange({
            dataSource: { name: 'grafana-testdata', type: 'grafana-testdata-datasource', default: true },
            queries: [],
            maxDataPoints: 100,
          });

          expect(dataObj.state.maxDataPoints).toBe(100);
        });

        it('should update min interval', async () => {
          const { queriesTab } = await setupScene('panel-1');
          const dataObj = queriesTab.queryRunner;

          expect(dataObj.state.maxDataPoints).toBeUndefined();

          queriesTab.onQueryOptionsChange({
            dataSource: { name: 'grafana-testdata', type: 'grafana-testdata-datasource', default: true },
            queries: [],
            minInterval: '1s',
          });
          expect(dataObj.state.minInterval).toBe('1s');
        });

        it('should update min interval to undefined if empty input', async () => {
          const { queriesTab } = await setupScene('panel-1');
          const dataObj = queriesTab.queryRunner;

          expect(dataObj.state.maxDataPoints).toBeUndefined();

          queriesTab.onQueryOptionsChange({
            dataSource: { name: 'grafana-testdata', type: 'grafana-testdata-datasource', default: true },
            queries: [],
            minInterval: '1s',
          });
          expect(dataObj.state.minInterval).toBe('1s');

          queriesTab.onQueryOptionsChange({
            dataSource: { name: 'grafana-testdata', type: 'grafana-testdata-datasource', default: true },
            queries: [],
            minInterval: null,
          });
          expect(dataObj.state.minInterval).toBe(undefined);
        });
      });

      describe('query caching', () => {
        it('updates cacheTimeout and queryCachingTTL', async () => {
          const { queriesTab } = await setupScene('panel-1');
          const dataObj = queriesTab.queryRunner;

          queriesTab.onQueryOptionsChange({
            cacheTimeout: '60',
            queryCachingTTL: 200000,
            dataSource: { name: 'grafana-testdata', type: 'grafana-testdata-datasource', default: true },
            queries: [],
          });

          expect(dataObj.state.cacheTimeout).toBe('60');
          expect(dataObj.state.queryCachingTTL).toBe(200000);
        });
      });
    });

    describe('query inspection', () => {
      it('allows query inspection from the tab', async () => {
        const { queriesTab } = await setupScene('panel-1');
        queriesTab.onOpenInspector();

        const params = locationService.getSearchObject();
        expect(params.inspect).toBe('1');
        expect(params.inspectTab).toBe(InspectTab.Query);
      });
    });

    describe('data source change', () => {
      it('changing from one plugin to another', async () => {
        const { queriesTab } = await setupScene('panel-1');

        expect(queriesTab.queryRunner.state.datasource).toEqual({
          uid: 'gdev-testdata',
          type: 'grafana-testdata-datasource',
        });

        await queriesTab.onChangeDataSource({
          name: 'grafana-prometheus',
          type: 'grafana-prometheus-datasource',
          uid: 'gdev-prometheus',
          meta: {
            name: 'Prometheus',
            module: 'prometheus',
            id: 'grafana-prometheus-datasource',
          },
        } as DataSourceInstanceSettings);

        expect(queriesTab.queryRunner.state.datasource).toEqual({
          uid: 'gdev-prometheus',
          type: 'grafana-prometheus-datasource',
        });
      });

      it('changing from a plugin to a dashboard data source', async () => {
        const { queriesTab } = await setupScene('panel-1');

        expect(queriesTab.queryRunner.state.datasource).toEqual({
          uid: 'gdev-testdata',
          type: 'grafana-testdata-datasource',
        });

        await queriesTab.onChangeDataSource({
          name: SHARED_DASHBOARD_QUERY,
          type: 'datasource',
          uid: SHARED_DASHBOARD_QUERY,
          meta: {
            name: 'Prometheus',
            module: 'prometheus',
            id: DASHBOARD_DATASOURCE_PLUGIN_ID,
          },
        } as DataSourceInstanceSettings);

        expect(queriesTab.queryRunner.state.datasource).toEqual({
          uid: SHARED_DASHBOARD_QUERY,
          type: 'datasource',
        });
      });

      it('changing from dashboard data source to a plugin', async () => {
        const { queriesTab } = await setupScene('panel-3');

        expect(queriesTab.queryRunner.state.datasource).toEqual({ uid: SHARED_DASHBOARD_QUERY, type: 'datasource' });

        await queriesTab.onChangeDataSource({
          name: 'grafana-prometheus',
          type: 'grafana-prometheus-datasource',
          uid: 'gdev-prometheus',
          meta: {
            name: 'Prometheus',
            module: 'prometheus',
            id: 'grafana-prometheus-datasource',
          },
        } as DataSourceInstanceSettings);

        expect(queriesTab.queryRunner.state.datasource).toEqual({
          uid: 'gdev-prometheus',
          type: 'grafana-prometheus-datasource',
        });
      });
    });

    describe('change queries', () => {
      describe('plugin queries', () => {
        it('should update queries', async () => {
          const { queriesTab, panel } = await setupScene('panel-1');

          panel.state.$data?.activate();

          queriesTab.onQueriesChange([
            {
              datasource: { type: 'grafana-testdata-datasource', uid: 'gdev-testdata' },
              refId: 'A',
              scenarioId: 'random_walk',
              seriesCount: 5,
            },
          ]);

          expect(queriesTab.queryRunner.state.queries).toEqual([
            {
              datasource: { type: 'grafana-testdata-datasource', uid: 'gdev-testdata' },
              refId: 'A',
              scenarioId: 'random_walk',
              seriesCount: 5,
            },
          ]);
        });
      });

      describe('dashboard queries', () => {
        it('should update queries', async () => {
          const { queriesTab, panel } = await setupScene('panel-3');

          panel.state.$data?.activate();

          // Changing dashboard query to a panel with transformations
          queriesTab.onQueriesChange([
            {
              refId: 'A',
              datasource: { type: DASHBOARD_DATASOURCE_PLUGIN_ID },
              panelId: panelWithTransformations.id,
            },
          ]);

          expect(queriesTab.queryRunner.state.queries[0].panelId).toEqual(panelWithTransformations.id);

          // Changing dashboard query to a panel with queries only
          queriesTab.onQueriesChange([
            {
              refId: 'A',
              datasource: { type: DASHBOARD_DATASOURCE_PLUGIN_ID },
              panelId: panelWithQueriesOnly.id,
            },
          ]);

          expect(queriesTab.queryRunner.state.queries[0].panelId).toBe(panelWithQueriesOnly.id);
        });

        it('should load last used data source if no data source specified for a panel', async () => {
          store.exists.mockReturnValue(true);
          store.getObject.mockImplementation((key: string, def: unknown) => {
            if (key === PANEL_EDIT_LAST_USED_DATASOURCE) {
              return {
                dashboardUid: 'ffbe00e2-803c-4d49-adb7-41aad336234f',
                datasourceUid: 'gdev-testdata',
              };
            }
            return def;
          });

          const { queriesTab } = await setupScene('panel-5');

          expect(queriesTab.state.datasource).toBe(ds1Mock);
          expect(queriesTab.state.dsSettings).toBe(instance1SettingsMock);
        });
      });
    });
  });
});

async function setupScene(panelId: string) {
  const dashboard = transformSaveModelToScene({ dashboard: testDashboard as unknown as DashboardDataDTO, meta: {} });
  const panel = findVizPanelByKey(dashboard, panelId)!;

  const panelEditor = buildPanelEditScene(panel);
  dashboard.setState({ editPanel: panelEditor });

  deactivators.push(dashboard.activate());
  deactivators.push(panelEditor.activate());

  const queriesTab = panelEditor.state.dataPane!.state.tabs[0] as PanelDataQueriesTab;
  deactivators.push(queriesTab.activate());

  await Promise.resolve();

  return { panel, scene: dashboard, queriesTab };
}
