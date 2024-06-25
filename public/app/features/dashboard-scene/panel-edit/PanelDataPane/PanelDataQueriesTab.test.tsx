import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { of, map } from 'rxjs';

import {
  DataQuery,
  DataQueryRequest,
  DataSourceApi,
  DataSourceJsonData,
  DataSourceRef,
  FieldType,
  LoadingState,
  PanelData,
  TimeRange,
  toDataFrame,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { SHARED_DASHBOARD_QUERY } from 'app/plugins/datasource/dashboard';
import { DASHBOARD_DATASOURCE_PLUGIN_ID } from 'app/plugins/datasource/dashboard/types';
import { DashboardDataDTO } from 'app/types';

import { transformSaveModelToScene } from '../../serialization/transformSaveModelToScene';
import { DashboardModelCompatibilityWrapper } from '../../utils/DashboardModelCompatibilityWrapper';
import { findVizPanelByKey } from '../../utils/utils';
import { VizPanelManager } from '../VizPanelManager';
import { testDashboard } from '../testfiles/testDashboard';

import { PanelDataQueriesTab, PanelDataQueriesTabRendered } from './PanelDataQueriesTab';

async function createModelMock() {
  const panelManager = setupVizPanelManger('panel-1');
  panelManager.activate();
  await Promise.resolve();
  const queryTabModel = new PanelDataQueriesTab(panelManager);

  // mock queryRunner data state
  jest.spyOn(queryTabModel.queryRunner, 'state', 'get').mockReturnValue({
    ...queryTabModel.queryRunner.state,
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

  return queryTabModel;
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

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getRunRequest: () => (ds: DataSourceApi, request: DataQueryRequest) => {
    return runRequestMock(ds, request);
  },
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
  locationService: {
    partial: jest.fn(),
    getSearchObject: jest.fn().mockReturnValue({
      firstPanel: false,
    }),
  },
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    defaultDatasource: 'gdev-testdata',
  },
}));
describe('PanelDataQueriesModel', () => {
  it('can add a new query', async () => {
    const vizPanelManager = setupVizPanelManger('panel-1');
    vizPanelManager.activate();
    await Promise.resolve();

    const model = new PanelDataQueriesTab(vizPanelManager);
    model.addQueryClick();
    expect(model.queryRunner.state.queries).toHaveLength(2);
    expect(model.queryRunner.state.queries[1].refId).toBe('B');
    expect(model.queryRunner.state.queries[1].hide).toBe(false);
    expect(model.queryRunner.state.queries[1].datasource).toEqual({
      type: 'grafana-testdata-datasource',
      uid: 'gdev-testdata',
    });
  });

  it('can add a new query when datasource is mixed', async () => {
    const vizPanelManager = setupVizPanelManger('panel-7');
    vizPanelManager.activate();
    await Promise.resolve();

    const model = new PanelDataQueriesTab(vizPanelManager);
    expect(vizPanelManager.state.datasource?.uid).toBe('-- Mixed --');
    expect(model.queryRunner.state.datasource?.uid).toBe('-- Mixed --');
    model.addQueryClick();

    expect(model.queryRunner.state.queries).toHaveLength(2);
    expect(model.queryRunner.state.queries[1].refId).toBe('B');
    expect(model.queryRunner.state.queries[1].hide).toBe(false);
    expect(model.queryRunner.state.queries[1].datasource?.uid).toBe('gdev-testdata');
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
});

const setupVizPanelManger = (panelId: string) => {
  const scene = transformSaveModelToScene({ dashboard: testDashboard as unknown as DashboardDataDTO, meta: {} });
  const panel = findVizPanelByKey(scene, panelId)!;

  const vizPanelManager = VizPanelManager.createFor(panel);

  // The following happens on DahsboardScene activation. For the needs of this test this activation aint needed hence we hand-call it
  // @ts-expect-error
  getDashboardSrv().setCurrent(new DashboardModelCompatibilityWrapper(scene));

  return vizPanelManager;
};
