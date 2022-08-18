import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';
import { byLabelText, byRole, byTestId, byText } from 'testing-library-selector';

import { locationService, setDataSourceSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import {
  AlertManagerCortexConfig,
  AlertManagerDataSourceJsonData,
  AlertManagerImplementation,
  MuteTimeInterval,
  Route,
} from 'app/plugins/datasource/alertmanager/types';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types';

import AmRoutes from './AmRoutes';
import { fetchAlertManagerConfig, fetchStatus, updateAlertManagerConfig } from './api/alertmanager';
import { discoverAlertmanagerFeatures } from './api/buildInfo';
import { mockDataSource, MockDataSourceSrv, someCloudAlertManagerConfig, someCloudAlertManagerStatus } from './mocks';
import { defaultGroupBy } from './utils/amroutes';
import { getAllDataSources } from './utils/config';
import { ALERTMANAGER_NAME_QUERY_KEY } from './utils/constants';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';

jest.mock('./api/alertmanager');
jest.mock('./utils/config');
jest.mock('app/core/services/context_srv');
jest.mock('./api/buildInfo');

const mocks = {
  getAllDataSourcesMock: jest.mocked(getAllDataSources),

  api: {
    fetchAlertManagerConfig: jest.mocked(fetchAlertManagerConfig),
    updateAlertManagerConfig: jest.mocked(updateAlertManagerConfig),
    fetchStatus: jest.mocked(fetchStatus),
    discoverAlertmanagerFeatures: jest.mocked(discoverAlertmanagerFeatures),
  },
  contextSrv: jest.mocked(contextSrv),
};

const renderAmRoutes = (alertManagerSourceName?: string) => {
  const store = configureStore();
  locationService.push(location);

  locationService.push(
    '/alerting/routes' + (alertManagerSourceName ? `?${ALERTMANAGER_NAME_QUERY_KEY}=${alertManagerSourceName}` : '')
  );

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
    name: 'Alertmanager',
    type: DataSourceType.Alertmanager,
  }),
  promAlertManager: mockDataSource<AlertManagerDataSourceJsonData>({
    name: 'PromManager',
    type: DataSourceType.Alertmanager,
    jsonData: {
      implementation: AlertManagerImplementation.prometheus,
    },
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

  setDefaultReceiverCTA: byRole('button', { name: 'Set a default contact point' }),

  editRouteButton: byLabelText('Edit route'),
  deleteRouteButton: byLabelText('Delete route'),
  newPolicyButton: byRole('button', { name: /New policy/ }),
  newPolicyCTAButton: byRole('button', { name: /New specific policy/ }),
  savePolicyButton: byRole('button', { name: /save policy/i }),

  receiverSelect: byTestId('am-receiver-select'),
  groupSelect: byTestId('am-group-select'),
  muteTimingSelect: byTestId('am-mute-timing-select'),

  groupWaitContainer: byTestId('am-group-wait'),
  groupIntervalContainer: byTestId('am-group-interval'),
  groupRepeatContainer: byTestId('am-repeat-interval'),

  confirmDeleteModal: byRole('dialog'),
  confirmDeleteButton: byLabelText('Confirm Modal Danger Button'),
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

  const emptyRoute: Route = {};

  const simpleRoute: Route = {
    receiver: 'simple-receiver',
    matchers: ['hello=world', 'foo!=bar'],
  };

  const rootRoute: Route = {
    receiver: 'default-receiver',
    group_by: ['a-group', 'another-group'],
    group_wait: '1s',
    group_interval: '2m',
    repeat_interval: '3d',
    routes: subroutes,
  };

  const muteInterval: MuteTimeInterval = {
    name: 'default-mute',
    time_intervals: [
      {
        times: [{ start_time: '12:00', end_time: '24:00' }],
        weekdays: ['monday:friday'],
        days_of_month: ['1:7', '-1:-7'],
        months: ['january:june'],
        years: ['2020:2022'],
      },
    ],
  };

  beforeEach(() => {
    mocks.getAllDataSourcesMock.mockReturnValue(Object.values(dataSources));
    mocks.contextSrv.hasAccess.mockImplementation(() => true);
    mocks.contextSrv.hasPermission.mockImplementation(() => true);
    mocks.contextSrv.evaluatePermission.mockImplementation(() => []);
    mocks.api.discoverAlertmanagerFeatures.mockResolvedValue({ lazyConfigInit: false });
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
    await userEvent.click(ui.editButton.get(rootRouteContainer));

    // configure receiver & group by
    const receiverSelect = await ui.receiverSelect.find();
    await clickSelectOption(receiverSelect, 'critical');

    const groupSelect = ui.groupSelect.get();
    await userEvent.type(byRole('combobox').get(groupSelect), 'namespace{enter}');

    // configure timing intervals
    await userEvent.click(byText('Timing options').get(rootRouteContainer));

    await updateTiming(ui.groupWaitContainer.get(), '1', 'Minutes');
    await updateTiming(ui.groupIntervalContainer.get(), '4', 'Minutes');
    await updateTiming(ui.groupRepeatContainer.get(), '5', 'Hours');

    //save
    await userEvent.click(ui.saveButton.get(rootRouteContainer));

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
          mute_time_intervals: [],
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
    await userEvent.click(ui.editButton.get(rootRouteContainer));

    // configure receiver & group by
    const receiverSelect = await ui.receiverSelect.find();
    await clickSelectOption(receiverSelect, 'default');

    const groupSelect = ui.groupSelect.get();
    await userEvent.type(byRole('combobox').get(groupSelect), 'severity{enter}');
    await userEvent.type(byRole('combobox').get(groupSelect), 'namespace{enter}');
    //save
    await userEvent.click(ui.saveButton.get(rootRouteContainer));

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
          group_by: defaultGroupBy.concat(['severity', 'namespace']),
          receiver: 'default',
          routes: [],
          mute_time_intervals: [],
        },
      },
      template_files: {},
    });
  });

  it('hides create and edit button if user does not have permission', () => {
    mocks.contextSrv.hasAccess.mockImplementation((action) =>
      [AccessControlAction.AlertingNotificationsRead, AccessControlAction.AlertingNotificationsRead].includes(
        action as AccessControlAction
      )
    );

    renderAmRoutes();
    expect(ui.newPolicyButton.query()).not.toBeInTheDocument();
    expect(ui.editButton.query()).not.toBeInTheDocument();
  });

  it('Show error message if loading Alertmanager config fails', async () => {
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

  it('Converts matchers to object_matchers for grafana alertmanager', async () => {
    const defaultConfig: AlertManagerCortexConfig = {
      alertmanager_config: {
        receivers: [{ name: 'default' }, { name: 'critical' }],
        route: {
          continue: false,
          receiver: 'default',
          group_by: ['alertname'],
          routes: [simpleRoute],
          group_interval: '4m',
          group_wait: '1m',
          repeat_interval: '5h',
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

    await renderAmRoutes(GRAFANA_RULES_SOURCE_NAME);
    expect(await ui.rootReceiver.find()).toHaveTextContent('default');
    expect(mocks.api.fetchAlertManagerConfig).toHaveBeenCalled();

    // Toggle a save to test new object_matchers
    const rootRouteContainer = await ui.rootRouteContainer.find();
    await userEvent.click(ui.editButton.get(rootRouteContainer));
    await userEvent.click(ui.saveButton.get(rootRouteContainer));

    await waitFor(() => expect(ui.editButton.query(rootRouteContainer)).not.toBeInTheDocument());

    expect(mocks.api.updateAlertManagerConfig).toHaveBeenCalled();
    expect(mocks.api.updateAlertManagerConfig).toHaveBeenCalledWith(GRAFANA_RULES_SOURCE_NAME, {
      alertmanager_config: {
        receivers: [{ name: 'default' }, { name: 'critical' }],
        route: {
          continue: false,
          group_by: ['alertname'],
          group_interval: '4m',
          group_wait: '1m',
          receiver: 'default',
          repeat_interval: '5h',
          mute_time_intervals: [],
          routes: [
            {
              continue: false,
              group_by: [],
              object_matchers: [
                ['hello', '=', 'world'],
                ['foo', '!=', 'bar'],
              ],
              receiver: 'simple-receiver',
              mute_time_intervals: [],
              routes: [],
            },
          ],
        },
        templates: [],
      },
      template_files: {},
    });
  });

  it('Should be able to delete an empty route', async () => {
    const routeConfig = {
      continue: false,
      receiver: 'default',
      group_by: ['alertname'],
      routes: [emptyRoute],
      group_interval: '4m',
      group_wait: '1m',
      repeat_interval: '5h',
      mute_time_intervals: [],
    };

    const defaultConfig: AlertManagerCortexConfig = {
      alertmanager_config: {
        receivers: [{ name: 'default' }, { name: 'critical' }],
        route: routeConfig,
        templates: [],
      },
      template_files: {},
    };

    mocks.api.fetchAlertManagerConfig.mockImplementation(() => {
      return Promise.resolve(defaultConfig);
    });

    mocks.api.updateAlertManagerConfig.mockResolvedValue(Promise.resolve());

    await renderAmRoutes(GRAFANA_RULES_SOURCE_NAME);
    await waitFor(() => expect(mocks.api.fetchAlertManagerConfig).toHaveBeenCalled());

    const deleteButtons = await ui.deleteRouteButton.findAll();
    expect(deleteButtons).toHaveLength(1);

    await userEvent.click(deleteButtons[0]);

    const confirmDeleteButton = ui.confirmDeleteButton.get(ui.confirmDeleteModal.get());
    expect(confirmDeleteButton).toBeInTheDocument();

    await userEvent.click(confirmDeleteButton);

    expect(mocks.api.updateAlertManagerConfig).toHaveBeenCalledWith<[string, AlertManagerCortexConfig]>(
      GRAFANA_RULES_SOURCE_NAME,
      {
        ...defaultConfig,
        alertmanager_config: {
          ...defaultConfig.alertmanager_config,
          route: {
            ...routeConfig,
            routes: [],
          },
        },
      }
    );
  });

  it('Keeps matchers for non-grafana alertmanager sources', async () => {
    const defaultConfig: AlertManagerCortexConfig = {
      alertmanager_config: {
        receivers: [{ name: 'default' }, { name: 'critical' }],
        route: {
          continue: false,
          receiver: 'default',
          group_by: ['alertname'],
          routes: [simpleRoute],
          group_interval: '4m',
          group_wait: '1m',
          repeat_interval: '5h',
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

    await renderAmRoutes(dataSources.am.name);
    expect(await ui.rootReceiver.find()).toHaveTextContent('default');
    expect(mocks.api.fetchAlertManagerConfig).toHaveBeenCalled();

    // Toggle a save to test new object_matchers
    const rootRouteContainer = await ui.rootRouteContainer.find();
    await userEvent.click(ui.editButton.get(rootRouteContainer));
    await userEvent.click(ui.saveButton.get(rootRouteContainer));

    await waitFor(() => expect(ui.editButton.query(rootRouteContainer)).not.toBeInTheDocument());

    expect(mocks.api.updateAlertManagerConfig).toHaveBeenCalled();
    expect(mocks.api.updateAlertManagerConfig).toHaveBeenCalledWith(dataSources.am.name, {
      alertmanager_config: {
        receivers: [{ name: 'default' }, { name: 'critical' }],
        route: {
          continue: false,
          group_by: ['alertname'],
          group_interval: '4m',
          group_wait: '1m',
          matchers: [],
          receiver: 'default',
          repeat_interval: '5h',
          mute_time_intervals: [],
          routes: [
            {
              continue: false,
              group_by: [],
              matchers: ['hello=world', 'foo!=bar'],
              receiver: 'simple-receiver',
              routes: [],
              mute_time_intervals: [],
            },
          ],
        },
        templates: [],
      },
      template_files: {},
    });
  });

  it('Prometheus Alertmanager routes cannot be edited', async () => {
    mocks.api.fetchStatus.mockResolvedValue({
      ...someCloudAlertManagerStatus,
      config: someCloudAlertManagerConfig.alertmanager_config,
    });
    await renderAmRoutes(dataSources.promAlertManager.name);
    const rootRouteContainer = await ui.rootRouteContainer.find();
    expect(ui.editButton.query(rootRouteContainer)).not.toBeInTheDocument();
    const rows = await ui.row.findAll();
    expect(rows).toHaveLength(2);
    expect(ui.editRouteButton.query()).not.toBeInTheDocument();
    expect(ui.deleteRouteButton.query()).not.toBeInTheDocument();
    expect(ui.saveButton.query()).not.toBeInTheDocument();

    expect(mocks.api.fetchAlertManagerConfig).not.toHaveBeenCalled();
    expect(mocks.api.fetchStatus).toHaveBeenCalledTimes(1);
  });

  it('Prometheus Alertmanager has no CTA button if there are no specific policies', async () => {
    mocks.api.fetchStatus.mockResolvedValue({
      ...someCloudAlertManagerStatus,
      config: {
        ...someCloudAlertManagerConfig.alertmanager_config,
        route: {
          ...someCloudAlertManagerConfig.alertmanager_config.route,
          routes: undefined,
        },
      },
    });
    await renderAmRoutes(dataSources.promAlertManager.name);
    const rootRouteContainer = await ui.rootRouteContainer.find();
    expect(ui.editButton.query(rootRouteContainer)).not.toBeInTheDocument();
    expect(ui.newPolicyCTAButton.query()).not.toBeInTheDocument();
    expect(mocks.api.fetchAlertManagerConfig).not.toHaveBeenCalled();
    expect(mocks.api.fetchStatus).toHaveBeenCalledTimes(1);
  });

  it('Can add a mute timing to a route', async () => {
    const defaultConfig: AlertManagerCortexConfig = {
      alertmanager_config: {
        receivers: [{ name: 'default' }, { name: 'critical' }],
        route: {
          continue: false,
          receiver: 'default',
          group_by: ['alertname'],
          routes: [simpleRoute],
          group_interval: '4m',
          group_wait: '1m',
          repeat_interval: '5h',
        },
        templates: [],
        mute_time_intervals: [muteInterval],
      },
      template_files: {},
    };

    const currentConfig = { current: defaultConfig };
    mocks.api.updateAlertManagerConfig.mockImplementation((amSourceName, newConfig) => {
      currentConfig.current = newConfig;
      return Promise.resolve();
    });

    mocks.api.fetchAlertManagerConfig.mockResolvedValue(defaultConfig);

    await renderAmRoutes(dataSources.am.name);
    const rows = await ui.row.findAll();
    expect(rows).toHaveLength(1);
    await userEvent.click(ui.editRouteButton.get(rows[0]));

    const muteTimingSelect = ui.muteTimingSelect.get();
    await clickSelectOption(muteTimingSelect, 'default-mute');
    expect(muteTimingSelect).toHaveTextContent('default-mute');

    const savePolicyButton = ui.savePolicyButton.get();
    expect(savePolicyButton).toBeInTheDocument();

    await userEvent.click(savePolicyButton);

    await waitFor(() => expect(savePolicyButton).not.toBeInTheDocument());

    expect(mocks.api.updateAlertManagerConfig).toHaveBeenCalled();
    expect(mocks.api.updateAlertManagerConfig).toHaveBeenCalledWith(dataSources.am.name, {
      ...defaultConfig,
      alertmanager_config: {
        ...defaultConfig.alertmanager_config,
        route: {
          ...defaultConfig.alertmanager_config.route,
          mute_time_intervals: [],
          matchers: [],
          routes: [
            {
              ...simpleRoute,
              mute_time_intervals: [muteInterval.name],
              routes: [],
              continue: false,
              group_by: [],
            },
          ],
        },
      },
    });
  });

  it('Shows an empty config when config returns an error and the AM supports lazy config initialization', async () => {
    mocks.api.discoverAlertmanagerFeatures.mockResolvedValue({ lazyConfigInit: true });

    mocks.api.fetchAlertManagerConfig.mockRejectedValue({
      message: 'alertmanager storage object not found',
    });

    await renderAmRoutes();

    await waitFor(() => expect(mocks.api.fetchAlertManagerConfig).toHaveBeenCalledTimes(1));

    expect(ui.rootReceiver.query()).toBeInTheDocument();
    expect(ui.setDefaultReceiverCTA.query()).toBeInTheDocument();
  });
});

const clickSelectOption = async (selectElement: HTMLElement, optionText: string): Promise<void> => {
  await userEvent.click(byRole('combobox').get(selectElement));
  await selectOptionInTest(selectElement, optionText);
};

const updateTiming = async (selectElement: HTMLElement, value: string, timeUnit: string): Promise<void> => {
  const input = byRole('textbox').get(selectElement);
  const select = byRole('combobox').get(selectElement);
  await userEvent.clear(input);
  await userEvent.type(input, value);
  await userEvent.click(select);
  await selectOptionInTest(selectElement, timeUnit);
};
