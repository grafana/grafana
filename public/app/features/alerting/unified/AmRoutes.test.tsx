import React from 'react';
import { locationService, setDataSourceSrv } from '@grafana/runtime';
import { render, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { Route } from 'app/plugins/datasource/alertmanager/types';
import { configureStore } from 'app/store/configureStore';
import { typeAsJestMock } from 'test/helpers/typeAsJestMock';
import { byTestId } from 'testing-library-selector';
import AmRoutes from './AmRoutes';
import { fetchAlertManagerConfig } from './api/alertmanager';
import { mockDataSource, MockDataSourceSrv } from './mocks';
import { getAllDataSources } from './utils/config';
import { DataSourceType } from './utils/datasource';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

jest.mock('./api/alertmanager');
jest.mock('./utils/config');

const mocks = {
  getAllDataSourcesMock: typeAsJestMock(getAllDataSources),

  api: {
    fetchAlertManagerConfig: typeAsJestMock(fetchAlertManagerConfig),
  },
};

const renderAmRoutes = () => {
  const store = configureStore();

  return render(
    <Provider store={store}>
      <Router history={locationService.getHistory()}>
        <AmRoutes />
      </Router>
    </Provider>
  );
};

const dataSources = {
  am: mockDataSource({
    name: 'Alert Manager',
    type: DataSourceType.Alertmanager,
  }),
};

const ui = {
  rootReceiver: byTestId('am-routes-root-receiver'),
  rootGroupBy: byTestId('am-routes-root-group-by'),
  rootTimings: byTestId('am-routes-root-timings'),
  row: byTestId('am-routes-row'),
};

describe('AmRoutes', () => {
  const subroutes: Route[] = [
    {
      match: {
        sub1matcher1: 'sub1value1',
        sub1matcher2: 'sub1value2',
      },
      match_re: {
        sub1matcher3: 'sub1value3',
        sub1matcher4: 'sub1value4',
      },
      group_by: ['sub1group1', 'sub1group2'],
      receiver: 'a-receiver',
      continue: true,
      group_wait: '3s',
      group_interval: '2m',
      repeat_interval: '1s',
      routes: [
        {
          match: {
            sub1sub1matcher1: 'sub1sub1value1',
            sub1sub1matcher2: 'sub1sub1value2',
          },
          match_re: {
            sub1sub1matcher3: 'sub1sub1value3',
            sub1sub1matcher4: 'sub1sub1value4',
          },
          group_by: ['sub1sub1group1', 'sub1sub1group2'],
          receiver: 'another-receiver',
        },
        {
          match: {
            sub1sub2matcher1: 'sub1sub2value1',
            sub1sub2matcher2: 'sub1sub2value2',
          },
          match_re: {
            sub1sub2matcher3: 'sub1sub2value3',
            sub1sub2matcher4: 'sub1sub2value4',
          },
          group_by: ['sub1sub2group1', 'sub1sub2group2'],
          receiver: 'another-receiver',
        },
      ],
    },
    {
      match: {
        sub2matcher1: 'sub2value1',
        sub2matcher2: 'sub2value2',
      },
      match_re: {
        sub2matcher3: 'sub2value3',
        sub2matcher4: 'sub2value4',
      },
      receiver: 'another-receiver',
    },
  ];

  const rootRoute: Route = {
    receiver: 'default-receiver',
    group_by: ['a-group', 'another-group'],
    group_wait: '1s',
    group_interval: '2m',
    repeat_interval: '3d',
    routes: subroutes,
  };

  beforeAll(() => {
    mocks.getAllDataSourcesMock.mockReturnValue(Object.values(dataSources));

    mocks.api.fetchAlertManagerConfig.mockImplementation(() =>
      Promise.resolve({
        alertmanager_config: {
          route: rootRoute,
          receivers: [
            {
              name: 'default-receiver',
            },
            {
              name: 'a-receiver',
            },
            {
              name: 'another-receiver',
            },
          ],
        },
        template_files: {},
      })
    );
  });

  beforeEach(() => {
    setDataSourceSrv(new MockDataSourceSrv(dataSources));
  });

  afterEach(() => {
    jest.resetAllMocks();

    setDataSourceSrv(undefined as any);
  });

  it('loads and shows routes', async () => {
    await renderAmRoutes();

    await waitFor(() => expect(mocks.api.fetchAlertManagerConfig).toHaveBeenCalledTimes(1));

    expect(ui.rootReceiver.get()).toHaveTextContent(rootRoute.receiver!);
    expect(ui.rootGroupBy.get()).toHaveTextContent(rootRoute.group_by!.join(', '));
    const rootTimings = ui.rootTimings.get();
    expect(rootTimings).toHaveTextContent(rootRoute.group_wait!);
    expect(rootTimings).toHaveTextContent(rootRoute.group_interval!);
    expect(rootTimings).toHaveTextContent(rootRoute.repeat_interval!);

    const rows = await ui.row.findAll();
    expect(rows).toHaveLength(2);

    subroutes.forEach((route, index) => {
      Object.entries(route.match ?? {}).forEach(([label, value]) => {
        expect(rows[index]).toHaveTextContent(`${label}=${value}`);
      });

      Object.entries(route.match_re ?? {}).forEach(([label, value]) => {
        expect(rows[index]).toHaveTextContent(`${label}=~${value}`);
      });

      if (route.group_by) {
        expect(rows[index]).toHaveTextContent(route.group_by.join(', '));
      }

      if (route.receiver) {
        expect(rows[index]).toHaveTextContent(route.receiver);
      }
    });
  });
});
