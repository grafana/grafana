import React from 'react';
import { locationService, setDataSourceSrv } from '@grafana/runtime';
import { render, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { AlertManagerCortexConfig, Route } from 'app/plugins/datasource/alertmanager/types';
import { configureStore } from 'app/store/configureStore';
import { typeAsJestMock } from 'test/helpers/typeAsJestMock';
import { byRole, byTestId, byText } from 'testing-library-selector';
import AmRoutes from './AmRoutes';
import { fetchAlertManagerConfig, updateAlertManagerConfig } from './api/alertmanager';
import { mockDataSource, MockDataSourceSrv } from './mocks';
import { getAllDataSources } from './utils/config';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';
import userEvent from '@testing-library/user-event';
import selectEvent from 'react-select-event';

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
    updateAlertManagerConfig: typeAsJestMock(updateAlertManagerConfig),
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

  rootRouteContainer: byTestId('am-root-route-container'),

  editButton: byRole('button', { name: 'Edit' }),
  saveButton: byRole('button', { name: 'Save' }),

  receiverSelect: byTestId('am-receiver-select'),
  groupSelect: byTestId('am-group-select'),

  groupWaitContainer: byTestId('am-group-wait'),
  groupIntervalContainer: byTestId('am-group-interval'),
  groupRepeatContainer: byTestId('am-repeat-interval'),
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

  beforeEach(() => {
    mocks.getAllDataSourcesMock.mockReturnValue(Object.values(dataSources));
    setDataSourceSrv(new MockDataSourceSrv(dataSources));
  });

  afterEach(() => {
    jest.resetAllMocks();

    setDataSourceSrv(undefined as any);
  });

  it('loads and shows routes', async () => {
    mocks.api.fetchAlertManagerConfig.mockResolvedValue({
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
    });

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

  it('can edit root route if one is already defined', async () => {
    const defaultConfig: AlertManagerCortexConfig = {
      alertmanager_config: {
        receivers: [{ name: 'default' }, { name: 'critical' }],
        route: {
          receiver: 'default',
          group_by: ['alertname'],
        },
        templates: [],
      },
      template_files: {},
    };
    const currentConfig = { current: defaultConfig };
    mocks.api.updateAlertManagerConfig.mockImplementation((amSourceName, newConfig) => {
      currentConfig.current = newConfig;
      return Promise.resolve();
    });

    mocks.api.fetchAlertManagerConfig.mockImplementation(() => {
      return Promise.resolve(currentConfig.current);
    });

    await renderAmRoutes();
    expect(await ui.rootReceiver.find()).toHaveTextContent('default');
    expect(ui.rootGroupBy.get()).toHaveTextContent('alertname');

    // open root route for editing
    const rootRouteContainer = await ui.rootRouteContainer.find();
    userEvent.click(ui.editButton.get(rootRouteContainer));

    // configure receiver & group by
    const receiverSelect = await ui.receiverSelect.find();
    await clickSelectOption(receiverSelect, 'critical');

    const groupSelect = ui.groupSelect.get();
    await userEvent.type(byRole('textbox').get(groupSelect), 'namespace{enter}');

    // configure timing intervals
    userEvent.click(byText('Timing options').get(rootRouteContainer));

    await updateTiming(ui.groupWaitContainer.get(), '1', 'Minutes');
    await updateTiming(ui.groupIntervalContainer.get(), '4', 'Minutes');
    await updateTiming(ui.groupRepeatContainer.get(), '5', 'Hours');

    //save
    userEvent.click(ui.saveButton.get(rootRouteContainer));

    // wait for it to go out of edit mode
    await waitFor(() => expect(ui.editButton.query(rootRouteContainer)).not.toBeInTheDocument());

    // check that appropriate api calls were made
    expect(mocks.api.fetchAlertManagerConfig).toHaveBeenCalledTimes(3);
    expect(mocks.api.updateAlertManagerConfig).toHaveBeenCalledTimes(1);
    expect(mocks.api.updateAlertManagerConfig).toHaveBeenCalledWith(GRAFANA_RULES_SOURCE_NAME, {
      alertmanager_config: {
        receivers: [{ name: 'default' }, { name: 'critical' }],
        route: {
          continue: false,
          group_by: ['alertname', 'namespace'],
          receiver: 'critical',
          routes: [],
          group_interval: '4m',
          group_wait: '1m',
          repeat_interval: '5h',
        },
        templates: [],
      },
      template_files: {},
    });

    // check that new config values are rendered
    await waitFor(() => expect(ui.rootReceiver.query()).toHaveTextContent('critical'));
    expect(ui.rootGroupBy.get()).toHaveTextContent('alertname, namespace');
  });

  it('can edit root route if one is not defined yet', async () => {
    mocks.api.fetchAlertManagerConfig.mockResolvedValue({
      alertmanager_config: {
        receivers: [{ name: 'default' }],
      },
      template_files: {},
    });

    await renderAmRoutes();

    // open root route for editing
    const rootRouteContainer = await ui.rootRouteContainer.find();
    userEvent.click(ui.editButton.get(rootRouteContainer));

    // configure receiver & group by
    const receiverSelect = await ui.receiverSelect.find();
    await clickSelectOption(receiverSelect, 'default');

    const groupSelect = ui.groupSelect.get();
    await userEvent.type(byRole('textbox').get(groupSelect), 'severity{enter}');
    await userEvent.type(byRole('textbox').get(groupSelect), 'namespace{enter}');
    //save
    userEvent.click(ui.saveButton.get(rootRouteContainer));

    // wait for it to go out of edit mode
    await waitFor(() => expect(ui.editButton.query(rootRouteContainer)).not.toBeInTheDocument());

    // check that appropriate api calls were made
    expect(mocks.api.fetchAlertManagerConfig).toHaveBeenCalledTimes(3);
    expect(mocks.api.updateAlertManagerConfig).toHaveBeenCalledTimes(1);
    expect(mocks.api.updateAlertManagerConfig).toHaveBeenCalledWith(GRAFANA_RULES_SOURCE_NAME, {
      alertmanager_config: {
        receivers: [{ name: 'default' }],
        route: {
          continue: false,
          group_by: ['severity', 'namespace'],
          receiver: 'default',
          routes: [],
        },
      },
      template_files: {},
    });
  });

  it('Show error message if loading Alermanager config fails', async () => {
    mocks.api.fetchAlertManagerConfig.mockRejectedValue({
      status: 500,
      data: {
        message: "Alertmanager has exploded. it's gone. Forget about it.",
      },
    });
    await renderAmRoutes();
    await waitFor(() => expect(mocks.api.fetchAlertManagerConfig).toHaveBeenCalledTimes(1));
    expect(await byText("Alertmanager has exploded. it's gone. Forget about it.").find()).toBeInTheDocument();
    expect(ui.rootReceiver.query()).not.toBeInTheDocument();
    expect(ui.editButton.query()).not.toBeInTheDocument();
  });
});

const clickSelectOption = async (selectElement: HTMLElement, optionText: string): Promise<void> => {
  userEvent.click(byRole('textbox').get(selectElement));
  await selectEvent.select(selectElement, optionText, { container: document.body });
};

const updateTiming = async (selectElement: HTMLElement, value: string, timeUnit: string): Promise<void> => {
  const inputs = byRole('textbox').queryAll(selectElement);
  expect(inputs).toHaveLength(2);
  await userEvent.type(inputs[0], value);
  userEvent.click(inputs[1]);
  await selectEvent.select(selectElement, timeUnit, { container: document.body });
};
