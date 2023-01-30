import { render, waitFor, within, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setupServer } from 'msw/node';
import React from 'react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';
import { byLabelText, byPlaceholderText, byRole, byTestId, byText } from 'testing-library-selector';

import { locationService, setBackendSrv, setDataSourceSrv } from '@grafana/runtime';
import { interceptLinkClicks } from 'app/core/navigation/patch/interceptLinkClicks';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import store from 'app/core/store';
import {
  AlertmanagerChoice,
  AlertManagerDataSourceJsonData,
  AlertManagerImplementation,
} from 'app/plugins/datasource/alertmanager/types';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction, ContactPointsState } from 'app/types';

import 'whatwg-fetch';

import Receivers from './Receivers';
import { fetchAlertManagerConfig, fetchStatus, testReceivers, updateAlertManagerConfig } from './api/alertmanager';
import { AlertmanagersChoiceResponse } from './api/alertmanagerApi';
import { discoverAlertmanagerFeatures } from './api/buildInfo';
import { fetchNotifiers } from './api/grafana';
import * as receiversApi from './api/receiversApi';
import * as grafanaApp from './components/receivers/grafanaAppReceivers/grafanaApp';
import {
  mockDataSource,
  MockDataSourceSrv,
  someCloudAlertManagerConfig,
  someCloudAlertManagerStatus,
  someGrafanaAlertManagerConfig,
} from './mocks';
import { mockAlertmanagerChoiceResponse } from './mocks/alertmanagerApi';
import { grafanaNotifiersMock } from './mocks/grafana-notifiers';
import { getAllDataSources } from './utils/config';
import { ALERTMANAGER_NAME_LOCAL_STORAGE_KEY, ALERTMANAGER_NAME_QUERY_KEY } from './utils/constants';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';
jest.mock('./api/alertmanager');
jest.mock('./api/grafana');
jest.mock('./utils/config');
jest.mock('app/core/services/context_srv');
jest.mock('./api/buildInfo');

const mocks = {
  getAllDataSources: jest.mocked(getAllDataSources),

  api: {
    fetchConfig: jest.mocked(fetchAlertManagerConfig),
    fetchStatus: jest.mocked(fetchStatus),
    updateConfig: jest.mocked(updateAlertManagerConfig),
    fetchNotifiers: jest.mocked(fetchNotifiers),
    testReceivers: jest.mocked(testReceivers),
    discoverAlertmanagerFeatures: jest.mocked(discoverAlertmanagerFeatures),
  },
  hooks: {
    useGetContactPointsState: jest.spyOn(receiversApi, 'useGetContactPointsState'),
  },
  contextSrv: jest.mocked(contextSrv),
};

const alertmanagerChoiceMockedResponse: AlertmanagersChoiceResponse = {
  alertmanagersChoice: AlertmanagerChoice.Internal,
  numExternalAlertmanagers: 0,
};

const renderReceivers = (alertManagerSourceName?: string) => {
  const store = configureStore();

  locationService.push(
    '/alerting/notifications' +
      (alertManagerSourceName ? `?${ALERTMANAGER_NAME_QUERY_KEY}=${alertManagerSourceName}` : '')
  );

  return render(
    <Provider store={store}>
      <Router history={locationService.getHistory()}>
        <Receivers />
      </Router>
    </Provider>
  );
};

const dataSources = {
  alertManager: mockDataSource({
    name: 'CloudManager',
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
  newContactPointButton: byRole('link', { name: /add contact point/i }),
  saveContactButton: byRole('button', { name: /save contact point/i }),
  newContactPointIntegrationButton: byRole('button', { name: /add contact point integration/i }),
  testContactPointButton: byRole('button', { name: /Test/ }),
  testContactPointModal: byRole('heading', { name: /test contact point/i }),
  customContactPointOption: byRole('radio', { name: /custom/i }),
  contactPointAnnotationSelect: (idx: number) => byTestId(`annotation-key-${idx}`),
  contactPointAnnotationValue: (idx: number) => byTestId(`annotation-value-${idx}`),
  contactPointLabelKey: (idx: number) => byTestId(`label-key-${idx}`),
  contactPointLabelValue: (idx: number) => byTestId(`label-value-${idx}`),
  testContactPoint: byRole('button', { name: /send test notification/i }),
  cancelButton: byTestId('cancel-button'),

  receiversTable: byTestId('dynamic-table'),
  templatesTable: byTestId('templates-table'),
  alertManagerPicker: byTestId('alertmanager-picker'),

  channelFormContainer: byTestId('item-container'),

  notificationError: byTestId('receivers-notification-error'),
  contactPointsCollapseToggle: byTestId('collapse-toggle'),

  inputs: {
    name: byPlaceholderText('Name'),
    email: {
      addresses: byLabelText(/Addresses/),
      toEmails: byLabelText(/To/),
    },
    hipchat: {
      url: byLabelText('Hip Chat Url'),
      apiKey: byLabelText('API Key'),
    },
    slack: {
      webhookURL: byLabelText(/Webhook URL/i),
    },
    webhook: {
      URL: byLabelText(/The endpoint to send HTTP POST requests to/i),
    },
  },
};

const clickSelectOption = async (selectElement: HTMLElement, optionText: string): Promise<void> => {
  await userEvent.click(byRole('combobox').get(selectElement));
  await selectOptionInTest(selectElement, optionText);
};

document.addEventListener('click', interceptLinkClicks);
const emptyContactPointsState: ContactPointsState = { receivers: {}, errorCount: 0 };

const useGetGrafanaReceiverTypeCheckerMock = jest.spyOn(grafanaApp, 'useGetGrafanaReceiverTypeChecker');

describe('Receivers', () => {
  const server = setupServer();

  beforeAll(() => {
    setBackendSrv(backendSrv);
    server.listen({ onUnhandledRequest: 'error' });
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    server.resetHandlers();
    jest.resetAllMocks();
    useGetGrafanaReceiverTypeCheckerMock.mockReturnValue(() => undefined);
    mocks.getAllDataSources.mockReturnValue(Object.values(dataSources));
    mocks.api.fetchNotifiers.mockResolvedValue(grafanaNotifiersMock);
    mocks.api.discoverAlertmanagerFeatures.mockResolvedValue({ lazyConfigInit: false });
    mocks.hooks.useGetContactPointsState.mockReturnValue(emptyContactPointsState);
    setDataSourceSrv(new MockDataSourceSrv(dataSources));
    mocks.contextSrv.isEditor = true;
    store.delete(ALERTMANAGER_NAME_LOCAL_STORAGE_KEY);

    mocks.contextSrv.evaluatePermission.mockImplementation(() => []);
    mocks.contextSrv.hasPermission.mockImplementation((action) => {
      const permissions = [
        AccessControlAction.AlertingNotificationsRead,
        AccessControlAction.AlertingNotificationsWrite,
        AccessControlAction.AlertingNotificationsExternalRead,
        AccessControlAction.AlertingNotificationsExternalWrite,
      ];
      return permissions.includes(action as AccessControlAction);
    });

    mocks.contextSrv.hasAccess.mockImplementation(() => true);
  });

  it('Template and receiver tables are rendered, alertmanager can be selected, no notification errors', async () => {
    mockAlertmanagerChoiceResponse(server, alertmanagerChoiceMockedResponse);
    mocks.api.fetchConfig.mockImplementation((name) =>
      Promise.resolve(name === GRAFANA_RULES_SOURCE_NAME ? someGrafanaAlertManagerConfig : someCloudAlertManagerConfig)
    );
    await renderReceivers();

    // check that by default grafana templates & receivers are fetched rendered in appropriate tables
    await ui.receiversTable.find();
    let templatesTable = await ui.templatesTable.find();
    let templateRows = templatesTable.querySelectorAll('tbody tr');
    expect(templateRows).toHaveLength(3);
    expect(templateRows[0]).toHaveTextContent('first template');
    expect(templateRows[1]).toHaveTextContent('second template');
    expect(templateRows[2]).toHaveTextContent('third template');
    let receiverRows = within(screen.getByTestId('dynamic-table')).getAllByTestId('row');
    expect(receiverRows[0]).toHaveTextContent('default');
    expect(receiverRows[1]).toHaveTextContent('critical');
    expect(receiverRows).toHaveLength(2);

    expect(mocks.api.fetchConfig).toHaveBeenCalledTimes(1);
    expect(mocks.api.fetchConfig).toHaveBeenCalledWith(GRAFANA_RULES_SOURCE_NAME);
    expect(mocks.api.fetchNotifiers).toHaveBeenCalledTimes(1);
    expect(locationService.getSearchObject()[ALERTMANAGER_NAME_QUERY_KEY]).toEqual(undefined);

    // select external cloud alertmanager, check that data is retrieved and contents are rendered as appropriate
    await clickSelectOption(ui.alertManagerPicker.get(), 'CloudManager');
    await byText('cloud-receiver').find();
    expect(mocks.api.fetchConfig).toHaveBeenCalledTimes(2);
    expect(mocks.api.fetchConfig).toHaveBeenLastCalledWith('CloudManager');

    await ui.receiversTable.find();
    templatesTable = await ui.templatesTable.find();
    templateRows = templatesTable.querySelectorAll('tbody tr');
    expect(templateRows[0]).toHaveTextContent('foo template');
    expect(templateRows).toHaveLength(1);
    receiverRows = within(screen.getByTestId('dynamic-table')).getAllByTestId('row');
    expect(receiverRows[0]).toHaveTextContent('cloud-receiver');
    expect(receiverRows).toHaveLength(1);
    expect(locationService.getSearchObject()[ALERTMANAGER_NAME_QUERY_KEY]).toEqual('CloudManager');

    //should not render any notification error
    expect(ui.notificationError.query()).not.toBeInTheDocument();
  });

  it('Grafana receiver can be tested', async () => {
    mockAlertmanagerChoiceResponse(server, alertmanagerChoiceMockedResponse);

    mocks.api.fetchConfig.mockResolvedValue(someGrafanaAlertManagerConfig);

    await renderReceivers();

    // go to new contact point page
    await userEvent.click(await ui.newContactPointButton.find());

    await byRole('heading', { name: /create contact point/i }).find();

    expect(locationService.getLocation().pathname).toEqual('/alerting/notifications/receivers/new');

    // type in a name for the new receiver
    await userEvent.type(ui.inputs.name.get(), 'my new receiver');

    // enter some email
    const email = ui.inputs.email.addresses.get();
    await userEvent.clear(email);
    await userEvent.type(email, 'tester@grafana.com');

    // try to test the contact point
    await userEvent.click(await ui.testContactPointButton.find());

    await waitFor(() => expect(ui.testContactPointModal.get()).toBeInTheDocument(), { timeout: 1000 });
    await userEvent.click(ui.customContactPointOption.get());
    await waitFor(() => expect(ui.contactPointAnnotationSelect(0).get()).toBeInTheDocument());

    // enter custom annotations and labels
    await clickSelectOption(ui.contactPointAnnotationSelect(0).get(), 'Description');
    await userEvent.type(ui.contactPointAnnotationValue(0).get(), 'Test contact point');
    await userEvent.type(ui.contactPointLabelKey(0).get(), 'foo');
    await userEvent.type(ui.contactPointLabelValue(0).get(), 'bar');
    await userEvent.click(ui.testContactPoint.get());

    await waitFor(() => expect(mocks.api.testReceivers).toHaveBeenCalled());

    expect(mocks.api.testReceivers).toHaveBeenCalledWith(
      'grafana',
      [
        {
          grafana_managed_receiver_configs: [
            {
              disableResolveMessage: false,
              name: 'test',
              secureSettings: {},
              settings: { addresses: 'tester@grafana.com', singleEmail: false },
              type: 'email',
            },
          ],
          name: 'test',
        },
      ],
      { annotations: { description: 'Test contact point' }, labels: { foo: 'bar' } }
    );
  });

  it('Grafana receiver can be created', async () => {
    mockAlertmanagerChoiceResponse(server, alertmanagerChoiceMockedResponse);

    mocks.api.fetchConfig.mockResolvedValue(someGrafanaAlertManagerConfig);
    mocks.api.updateConfig.mockResolvedValue();
    await renderReceivers();

    // go to new contact point page
    await userEvent.click(await ui.newContactPointButton.find());

    await byRole('heading', { name: /create contact point/i }).find();
    expect(locationService.getLocation().pathname).toEqual('/alerting/notifications/receivers/new');

    // type in a name for the new receiver
    await userEvent.type(byPlaceholderText('Name').get(), 'my new receiver');

    // check that default email form is rendered
    await ui.inputs.email.addresses.find();

    // select hipchat
    await clickSelectOption(byTestId('items.0.type').get(), 'HipChat');

    // check that email options are gone and hipchat options appear
    expect(ui.inputs.email.addresses.query()).not.toBeInTheDocument();

    const urlInput = ui.inputs.hipchat.url.get();
    const apiKeyInput = ui.inputs.hipchat.apiKey.get();

    await userEvent.type(urlInput, 'http://hipchat');
    await userEvent.type(apiKeyInput, 'foobarbaz');

    await userEvent.click(await ui.saveContactButton.find());

    // see that we're back to main page and proper api calls have been made
    await ui.receiversTable.find();
    expect(mocks.api.updateConfig).toHaveBeenCalledTimes(1);
    expect(mocks.api.fetchConfig).toHaveBeenCalledTimes(3);
    expect(locationService.getLocation().pathname).toEqual('/alerting/notifications');
    expect(mocks.api.updateConfig).toHaveBeenLastCalledWith(GRAFANA_RULES_SOURCE_NAME, {
      ...someGrafanaAlertManagerConfig,
      alertmanager_config: {
        ...someGrafanaAlertManagerConfig.alertmanager_config,
        receivers: [
          ...(someGrafanaAlertManagerConfig.alertmanager_config.receivers ?? []),
          {
            name: 'my new receiver',
            grafana_managed_receiver_configs: [
              {
                disableResolveMessage: false,
                name: 'my new receiver',
                secureSettings: {},
                settings: {
                  apiKey: 'foobarbaz',
                  url: 'http://hipchat',
                },
                type: 'hipchat',
              },
            ],
          },
        ],
      },
    });
  });

  it('Hides create contact point button for users without permission', () => {
    mockAlertmanagerChoiceResponse(server, alertmanagerChoiceMockedResponse);

    mocks.api.fetchConfig.mockResolvedValue(someGrafanaAlertManagerConfig);
    mocks.api.updateConfig.mockResolvedValue();
    mocks.contextSrv.hasAccess.mockImplementation((action) =>
      [AccessControlAction.AlertingNotificationsRead, AccessControlAction.AlertingNotificationsExternalRead].some(
        (a) => a === action
      )
    );
    mocks.hooks.useGetContactPointsState.mockReturnValue(emptyContactPointsState);
    renderReceivers();

    expect(ui.newContactPointButton.query()).not.toBeInTheDocument();
  });

  it('Cloud alertmanager receiver can be edited', async () => {
    mockAlertmanagerChoiceResponse(server, alertmanagerChoiceMockedResponse);

    mocks.api.fetchConfig.mockResolvedValue(someCloudAlertManagerConfig);
    mocks.api.updateConfig.mockResolvedValue();
    await renderReceivers('CloudManager');

    // click edit button for the receiver
    await ui.receiversTable.find();
    const receiverRows = within(screen.getByTestId('dynamic-table')).getAllByTestId('row');
    expect(receiverRows[0]).toHaveTextContent('cloud-receiver');
    await userEvent.click(byTestId('edit').get(receiverRows[0]));

    // check that form is open
    await byRole('heading', { name: /update contact point/i }).find();
    expect(locationService.getLocation().pathname).toEqual('/alerting/notifications/receivers/cloud-receiver/edit');
    expect(ui.channelFormContainer.queryAll()).toHaveLength(2);

    // delete the email channel
    expect(ui.channelFormContainer.queryAll()).toHaveLength(2);
    await userEvent.click(byTestId('items.0.delete-button').get());
    expect(ui.channelFormContainer.queryAll()).toHaveLength(1);

    // modify webhook url
    const slackContainer = ui.channelFormContainer.get();
    await userEvent.click(byText('Optional Slack settings').get(slackContainer));
    await userEvent.type(ui.inputs.slack.webhookURL.get(slackContainer), 'http://newgreaturl');

    // add confirm button to action
    await userEvent.click(byText(/Actions \(1\)/i).get(slackContainer));
    await userEvent.click(await byTestId('items.1.settings.actions.0.confirm.add-button').find());
    const confirmSubform = byTestId('items.1.settings.actions.0.confirm.container').get();
    await userEvent.type(byLabelText('Text').get(confirmSubform), 'confirm this');

    // delete a field
    await userEvent.click(byText(/Fields \(2\)/i).get(slackContainer));
    await userEvent.click(byTestId('items.1.settings.fields.0.delete-button').get());
    await byText(/Fields \(1\)/i).get(slackContainer);

    // add another channel
    await userEvent.click(ui.newContactPointIntegrationButton.get());
    await clickSelectOption(await byTestId('items.2.type').find(), 'Webhook');
    await userEvent.type(await ui.inputs.webhook.URL.find(), 'http://webhookurl');

    await userEvent.click(ui.saveContactButton.get());

    // see that we're back to main page and proper api calls have been made
    await ui.receiversTable.find();
    expect(mocks.api.updateConfig).toHaveBeenCalledTimes(1);
    expect(mocks.api.fetchConfig).toHaveBeenCalledTimes(3);
    expect(locationService.getLocation().pathname).toEqual('/alerting/notifications');
    expect(mocks.api.updateConfig).toHaveBeenLastCalledWith('CloudManager', {
      ...someCloudAlertManagerConfig,
      alertmanager_config: {
        ...someCloudAlertManagerConfig.alertmanager_config,
        receivers: [
          {
            name: 'cloud-receiver',
            slack_configs: [
              {
                actions: [
                  {
                    confirm: {
                      text: 'confirm this',
                    },
                    text: 'action1text',
                    type: 'action1type',
                    url: 'http://action1',
                  },
                ],
                api_url: 'http://slack1http://newgreaturl',
                channel: '#mychannel',
                fields: [
                  {
                    short: false,
                    title: 'field2',
                    value: 'text2',
                  },
                ],
                link_names: false,
                send_resolved: false,
                short_fields: false,
              },
            ],
            webhook_configs: [
              {
                send_resolved: true,
                url: 'http://webhookurl',
              },
            ],
          },
        ],
      },
    });
  });

  it('Prometheus Alertmanager receiver cannot be edited', async () => {
    mockAlertmanagerChoiceResponse(server, alertmanagerChoiceMockedResponse);

    mocks.api.fetchStatus.mockResolvedValue({
      ...someCloudAlertManagerStatus,
      config: someCloudAlertManagerConfig.alertmanager_config,
    });
    await renderReceivers(dataSources.promAlertManager.name);

    await ui.receiversTable.find();
    // there's no templates table for vanilla prom, API does not return templates
    expect(ui.templatesTable.query()).not.toBeInTheDocument();

    // click view button on the receiver
    const receiverRows = within(screen.getByTestId('dynamic-table')).getAllByTestId('row');
    expect(receiverRows[0]).toHaveTextContent('cloud-receiver');
    expect(byTestId('edit').query(receiverRows[0])).not.toBeInTheDocument();
    await userEvent.click(byTestId('view').get(receiverRows[0]));

    // check that form is open
    await byRole('heading', { name: /contact point/i }).find();
    expect(locationService.getLocation().pathname).toEqual('/alerting/notifications/receivers/cloud-receiver/edit');

    const channelForms = ui.channelFormContainer.queryAll();
    expect(channelForms).toHaveLength(2);

    // check that inputs are disabled and there is no save button
    expect(ui.inputs.name.queryAll()[0]).toHaveAttribute('readonly');
    expect(ui.inputs.email.toEmails.get(channelForms[0])).toHaveAttribute('readonly');
    expect(ui.inputs.slack.webhookURL.get(channelForms[1])).toHaveAttribute('readonly');
    expect(ui.newContactPointButton.query()).not.toBeInTheDocument();
    expect(ui.testContactPointButton.query()).not.toBeInTheDocument();
    expect(ui.saveContactButton.query()).not.toBeInTheDocument();
    expect(ui.cancelButton.query()).toBeInTheDocument();

    expect(mocks.api.fetchConfig).not.toHaveBeenCalled();
    expect(mocks.api.fetchStatus).toHaveBeenCalledTimes(1);
  });

  it('Loads config from status endpoint if there is no user config', async () => {
    mockAlertmanagerChoiceResponse(server, alertmanagerChoiceMockedResponse);
    // loading an empty config with make it fetch config from status endpoint
    mocks.api.fetchConfig.mockResolvedValue({
      template_files: {},
      alertmanager_config: {},
    });
    mocks.api.fetchStatus.mockResolvedValue(someCloudAlertManagerStatus);
    await renderReceivers('CloudManager');

    // check that receiver from the default config is represented
    await ui.receiversTable.find();
    const receiverRows = within(screen.getByTestId('dynamic-table')).getAllByTestId('row');
    expect(receiverRows[0]).toHaveTextContent('default-email');

    // check that both config and status endpoints were called
    expect(mocks.api.fetchConfig).toHaveBeenCalledTimes(1);
    expect(mocks.api.fetchConfig).toHaveBeenLastCalledWith('CloudManager');
    expect(mocks.api.fetchStatus).toHaveBeenCalledTimes(1);
    expect(mocks.api.fetchStatus).toHaveBeenLastCalledWith('CloudManager');
  });

  it('Shows an empty config when config returns an error and the AM supports lazy config initialization', async () => {
    mockAlertmanagerChoiceResponse(server, alertmanagerChoiceMockedResponse);

    mocks.api.discoverAlertmanagerFeatures.mockResolvedValue({ lazyConfigInit: true });
    mocks.api.fetchConfig.mockRejectedValue({ message: 'alertmanager storage object not found' });

    await renderReceivers('CloudManager');

    const templatesTable = await ui.templatesTable.find();
    const receiversTable = await ui.receiversTable.find();

    expect(templatesTable).toBeInTheDocument();
    expect(receiversTable).toBeInTheDocument();
    expect(ui.newContactPointButton.get()).toBeInTheDocument();
  });

  describe('Contact points state', () => {
    it('Should render error notifications when there are some points state ', async () => {
      mockAlertmanagerChoiceResponse(server, alertmanagerChoiceMockedResponse);
      mocks.api.fetchConfig.mockResolvedValue(someGrafanaAlertManagerConfig);
      mocks.api.updateConfig.mockResolvedValue();

      const receiversMock: ContactPointsState = {
        receivers: {
          default: {
            active: true,
            notifiers: {
              email: [
                {
                  lastNotifyAttemptError:
                    'establish connection to server: dial tcp: lookup smtp.example.org on 8.8.8.8:53: no such host',
                  lastNotifyAttempt: '2022-09-19T15:34:40.696Z',
                  lastNotifyAttemptDuration: '117.2455ms',
                  name: 'email[0]',
                },
              ],
            },
            errorCount: 1,
          },
          critical: {
            active: true,
            notifiers: {
              slack: [
                {
                  lastNotifyAttempt: '2022-09-19T15:34:40.696Z',
                  lastNotifyAttemptDuration: '117.2455ms',
                  name: 'slack[0]',
                },
              ],
              pagerduty: [
                {
                  lastNotifyAttempt: '2022-09-19T15:34:40.696Z',
                  lastNotifyAttemptDuration: '117.2455ms',
                  name: 'pagerduty',
                },
              ],
            },
            errorCount: 0,
          },
        },
        errorCount: 1,
      };

      mocks.hooks.useGetContactPointsState.mockReturnValue(receiversMock);
      await renderReceivers();

      //
      await ui.receiversTable.find();
      //should render notification error
      expect(ui.notificationError.query()).toBeInTheDocument();
      expect(ui.notificationError.get()).toHaveTextContent('1 error with contact points');

      const receiverRows = within(screen.getByTestId('dynamic-table')).getAllByTestId('row');
      expect(receiverRows[0]).toHaveTextContent('1 error');
      expect(receiverRows[1]).not.toHaveTextContent('error');
      expect(receiverRows[1]).toHaveTextContent('OK');

      //should show error in contact points when expanding
      // expand contact point detail for default 2 emails - 2 errors
      await userEvent.click(ui.contactPointsCollapseToggle.get(receiverRows[0]));
      const defaultDetailTable = screen.getAllByTestId('dynamic-table')[1];
      expect(byText('Error').getAll(defaultDetailTable)).toHaveLength(1);

      // expand contact point detail for slack and pagerduty - 0 errors
      await userEvent.click(ui.contactPointsCollapseToggle.get(receiverRows[1]));
      const criticalDetailTable = screen.getAllByTestId('dynamic-table')[2];
      expect(byText('Error').query(criticalDetailTable)).toBeNull();
      expect(byText('OK').getAll(criticalDetailTable)).toHaveLength(2);
    });
    it('Should render no attempt message when there are some points state with null lastNotifyAttempt, and "-" in null values', async () => {
      mockAlertmanagerChoiceResponse(server, alertmanagerChoiceMockedResponse);
      mocks.api.fetchConfig.mockResolvedValue(someGrafanaAlertManagerConfig);
      mocks.api.updateConfig.mockResolvedValue();

      const receiversMock: ContactPointsState = {
        receivers: {
          default: {
            active: true,
            notifiers: {
              email: [
                {
                  lastNotifyAttemptError:
                    'establish connection to server: dial tcp: lookup smtp.example.org on 8.8.8.8:53: no such host',
                  lastNotifyAttempt: '2022-09-19T15:34:40.696Z',
                  lastNotifyAttemptDuration: '117.2455ms',
                  name: 'email[0]',
                },
              ],
            },
            errorCount: 1,
          },
          critical: {
            active: true,
            notifiers: {
              slack: [
                {
                  lastNotifyAttempt: '0001-01-01T00:00:00.000Z',
                  lastNotifyAttemptDuration: '0s',
                  name: 'slack[0]',
                },
              ],
              pagerduty: [
                {
                  lastNotifyAttempt: '2022-09-19T15:34:40.696Z',
                  lastNotifyAttemptDuration: '117.2455ms',
                  name: 'pagerduty',
                },
              ],
            },
            errorCount: 0,
          },
        },
        errorCount: 1,
      };

      mocks.hooks.useGetContactPointsState.mockReturnValue(receiversMock);
      await renderReceivers();

      //
      await ui.receiversTable.find();
      //should render notification error
      expect(ui.notificationError.query()).toBeInTheDocument();
      expect(ui.notificationError.get()).toHaveTextContent('1 error with contact points');

      const receiverRows = within(screen.getByTestId('dynamic-table')).getAllByTestId('row');
      expect(receiverRows[0]).toHaveTextContent('1 error');
      expect(receiverRows[1]).not.toHaveTextContent('error');
      expect(receiverRows[1]).toHaveTextContent('No attempts');

      //should show error in contact points when expanding
      // expand contact point detail for default 2 emails - 2 errors
      await userEvent.click(ui.contactPointsCollapseToggle.get(receiverRows[0]));
      const defaultDetailTable = screen.getAllByTestId('dynamic-table')[1];
      expect(byText('Error').getAll(defaultDetailTable)).toHaveLength(1);

      // expand contact point detail for slack and pagerduty - 0 errors
      await userEvent.click(ui.contactPointsCollapseToggle.get(receiverRows[1]));
      const criticalDetailTableRows = within(screen.getAllByTestId('dynamic-table')[2]).getAllByTestId('row');
      // should render slack item with no attempt
      expect(criticalDetailTableRows[0]).toHaveTextContent('No attempt');
      expect(criticalDetailTableRows[0]).toHaveTextContent('--');
      //should render pagerduty with no attempt
      expect(criticalDetailTableRows[1]).toHaveTextContent('OK');
      expect(criticalDetailTableRows[1]).toHaveTextContent('117.2455ms');
    });

    it('Should not render error notifications when fetching contact points state raises 404 error ', async () => {
      mockAlertmanagerChoiceResponse(server, alertmanagerChoiceMockedResponse);
      mocks.api.fetchConfig.mockResolvedValue(someGrafanaAlertManagerConfig);
      mocks.api.updateConfig.mockResolvedValue();

      mocks.hooks.useGetContactPointsState.mockReturnValue(emptyContactPointsState);
      await renderReceivers();

      await ui.receiversTable.find();
      //should not render notification error
      expect(ui.notificationError.query()).not.toBeInTheDocument();
      //contact points are not expandable
      expect(ui.contactPointsCollapseToggle.query()).not.toBeInTheDocument();
      //should render receivers, only one dynamic table
      let receiverRows = within(screen.getByTestId('dynamic-table')).getAllByTestId('row');
      expect(receiverRows[0]).toHaveTextContent('default');
      expect(receiverRows[1]).toHaveTextContent('critical');
      expect(receiverRows).toHaveLength(2);
    });
  });
});
