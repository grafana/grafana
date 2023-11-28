import { __awaiter } from "tslib";
import { render, waitFor, within, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';
import { byLabelText, byPlaceholderText, byRole, byTestId, byText } from 'testing-library-selector';
import { locationService, setDataSourceSrv } from '@grafana/runtime';
import { interceptLinkClicks } from 'app/core/navigation/patch/interceptLinkClicks';
import { contextSrv } from 'app/core/services/context_srv';
import store from 'app/core/store';
import { AlertmanagerChoice, AlertManagerImplementation, } from 'app/plugins/datasource/alertmanager/types';
import { AccessControlAction } from 'app/types';
import 'whatwg-fetch';
import 'core-js/stable/structured-clone';
import { fetchAlertManagerConfig, fetchStatus, testReceivers, updateAlertManagerConfig } from '../../api/alertmanager';
import { discoverAlertmanagerFeatures } from '../../api/buildInfo';
import { fetchNotifiers } from '../../api/grafana';
import * as receiversApi from '../../api/receiversApi';
import * as grafanaApp from '../../components/receivers/grafanaAppReceivers/grafanaApp';
import { mockApi, setupMswServer } from '../../mockApi';
import { grantUserPermissions, mockDataSource, MockDataSourceSrv, onCallPluginMetaMock, someCloudAlertManagerConfig, someCloudAlertManagerStatus, someGrafanaAlertManagerConfig, } from '../../mocks';
import { mockAlertmanagerChoiceResponse } from '../../mocks/alertmanagerApi';
import { grafanaNotifiersMock } from '../../mocks/grafana-notifiers';
import { AlertmanagerProvider } from '../../state/AlertmanagerContext';
import { getAllDataSources } from '../../utils/config';
import { ALERTMANAGER_NAME_LOCAL_STORAGE_KEY, ALERTMANAGER_NAME_QUERY_KEY } from '../../utils/constants';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import Receivers from './ContactPoints.v1';
jest.mock('../../api/alertmanager');
jest.mock('../../api/grafana');
jest.mock('../../utils/config');
jest.mock('app/core/services/context_srv');
jest.mock('../../api/buildInfo');
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
const alertmanagerChoiceMockedResponse = {
    alertmanagersChoice: AlertmanagerChoice.Internal,
    numExternalAlertmanagers: 0,
};
const dataSources = {
    alertManager: mockDataSource({
        name: 'CloudManager',
        type: DataSourceType.Alertmanager,
    }),
    promAlertManager: mockDataSource({
        name: 'PromManager',
        type: DataSourceType.Alertmanager,
        jsonData: {
            implementation: AlertManagerImplementation.prometheus,
        },
    }),
};
const renderReceivers = (alertManagerSourceName) => {
    locationService.push('/alerting/notifications');
    return render(React.createElement(TestProvider, null,
        React.createElement(AlertmanagerProvider, { accessType: "notification", alertmanagerSourceName: alertManagerSourceName },
            React.createElement(Receivers, null))));
};
const ui = {
    newContactPointButton: byRole('link', { name: /add contact point/i }),
    saveContactButton: byRole('button', { name: /save contact point/i }),
    newContactPointIntegrationButton: byRole('button', { name: /add contact point integration/i }),
    testContactPointButton: byRole('button', { name: /Test/ }),
    testContactPointModal: byRole('heading', { name: /test contact point/i }),
    customContactPointOption: byRole('radio', { name: /custom/i }),
    contactPointAnnotationSelect: (idx) => byTestId(`annotation-key-${idx}`),
    contactPointAnnotationValue: (idx) => byTestId(`annotation-value-${idx}`),
    contactPointLabelKey: (idx) => byTestId(`label-key-${idx}`),
    contactPointLabelValue: (idx) => byTestId(`label-value-${idx}`),
    testContactPoint: byRole('button', { name: /send test notification/i }),
    cancelButton: byTestId('cancel-button'),
    receiversTable: byTestId('dynamic-table'),
    templatesTable: byTestId('templates-table'),
    alertManagerPicker: byTestId('alertmanager-picker'),
    channelFormContainer: byTestId('item-container'),
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
const clickSelectOption = (selectElement, optionText) => __awaiter(void 0, void 0, void 0, function* () {
    yield userEvent.click(byRole('combobox').get(selectElement));
    yield selectOptionInTest(selectElement, optionText);
});
document.addEventListener('click', interceptLinkClicks);
const emptyContactPointsState = { receivers: {}, errorCount: 0 };
const useGetGrafanaReceiverTypeCheckerMock = jest.spyOn(grafanaApp, 'useGetGrafanaReceiverTypeChecker');
const server = setupMswServer();
describe('Receivers', () => {
    beforeEach(() => {
        server.resetHandlers();
        jest.resetAllMocks();
        mockApi(server).grafanaNotifiers(grafanaNotifiersMock);
        mockApi(server).plugins.getPluginSettings(onCallPluginMetaMock);
        useGetGrafanaReceiverTypeCheckerMock.mockReturnValue(() => undefined);
        mocks.getAllDataSources.mockReturnValue(Object.values(dataSources));
        mocks.api.fetchNotifiers.mockResolvedValue(grafanaNotifiersMock);
        mocks.api.discoverAlertmanagerFeatures.mockResolvedValue({ lazyConfigInit: false });
        mocks.hooks.useGetContactPointsState.mockReturnValue(emptyContactPointsState);
        setDataSourceSrv(new MockDataSourceSrv(dataSources));
        store.delete(ALERTMANAGER_NAME_LOCAL_STORAGE_KEY);
        grantUserPermissions([
            AccessControlAction.AlertingNotificationsRead,
            AccessControlAction.AlertingNotificationsWrite,
            AccessControlAction.AlertingNotificationsExternalRead,
            AccessControlAction.AlertingNotificationsExternalWrite,
        ]);
    });
    it('Template and receiver tables are rendered, alertmanager can be selected, no notification errors', () => __awaiter(void 0, void 0, void 0, function* () {
        mockAlertmanagerChoiceResponse(server, alertmanagerChoiceMockedResponse);
        mocks.api.fetchConfig.mockImplementation((name) => Promise.resolve(name === GRAFANA_RULES_SOURCE_NAME ? someGrafanaAlertManagerConfig : someCloudAlertManagerConfig));
        renderReceivers();
        // check that by default grafana templates & receivers are fetched rendered in appropriate tables
        yield ui.receiversTable.find();
        let templatesTable = yield ui.templatesTable.find();
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
    }));
    it('Grafana receiver can be tested', () => __awaiter(void 0, void 0, void 0, function* () {
        mockAlertmanagerChoiceResponse(server, alertmanagerChoiceMockedResponse);
        mocks.api.fetchConfig.mockResolvedValue(someGrafanaAlertManagerConfig);
        renderReceivers();
        // go to new contact point page
        yield userEvent.click(yield ui.newContactPointButton.find());
        yield byRole('heading', { name: /create contact point/i }).find();
        expect(locationService.getLocation().pathname).toEqual('/alerting/notifications/receivers/new');
        // type in a name for the new receiver
        yield userEvent.type(ui.inputs.name.get(), 'my new receiver');
        // enter some email
        const email = ui.inputs.email.addresses.get();
        yield userEvent.clear(email);
        yield userEvent.type(email, 'tester@grafana.com');
        // try to test the contact point
        yield userEvent.click(yield ui.testContactPointButton.find());
        yield waitFor(() => expect(ui.testContactPointModal.get()).toBeInTheDocument(), { timeout: 1000 });
        yield userEvent.click(ui.customContactPointOption.get());
        // enter custom annotations and labels
        yield userEvent.type(screen.getByPlaceholderText('Enter a description...'), 'Test contact point');
        yield userEvent.type(ui.contactPointLabelKey(0).get(), 'foo');
        yield userEvent.type(ui.contactPointLabelValue(0).get(), 'bar');
        yield userEvent.click(ui.testContactPoint.get());
        yield waitFor(() => expect(mocks.api.testReceivers).toHaveBeenCalled());
        expect(mocks.api.testReceivers).toHaveBeenCalledWith('grafana', [
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
        ], { annotations: { description: 'Test contact point' }, labels: { foo: 'bar' } });
    }));
    it('Grafana receiver can be created', () => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        mockAlertmanagerChoiceResponse(server, alertmanagerChoiceMockedResponse);
        mocks.api.fetchConfig.mockResolvedValue(someGrafanaAlertManagerConfig);
        mocks.api.updateConfig.mockResolvedValue();
        renderReceivers();
        // go to new contact point page
        yield userEvent.click(yield ui.newContactPointButton.find());
        yield byRole('heading', { name: /create contact point/i }).find();
        expect(locationService.getLocation().pathname).toEqual('/alerting/notifications/receivers/new');
        // type in a name for the new receiver
        yield userEvent.type(byPlaceholderText('Name').get(), 'my new receiver');
        // check that default email form is rendered
        yield ui.inputs.email.addresses.find();
        // select hipchat
        yield clickSelectOption(byTestId('items.0.type').get(), 'HipChat');
        // check that email options are gone and hipchat options appear
        expect(ui.inputs.email.addresses.query()).not.toBeInTheDocument();
        const urlInput = ui.inputs.hipchat.url.get();
        const apiKeyInput = ui.inputs.hipchat.apiKey.get();
        yield userEvent.type(urlInput, 'http://hipchat');
        yield userEvent.type(apiKeyInput, 'foobarbaz');
        yield userEvent.click(yield ui.saveContactButton.find());
        // see that we're back to main page and proper api calls have been made
        yield ui.receiversTable.find();
        expect(mocks.api.updateConfig).toHaveBeenCalledTimes(1);
        expect(mocks.api.fetchConfig).toHaveBeenCalledTimes(2);
        expect(locationService.getLocation().pathname).toEqual('/alerting/notifications');
        expect(mocks.api.updateConfig).toHaveBeenLastCalledWith(GRAFANA_RULES_SOURCE_NAME, Object.assign(Object.assign({}, someGrafanaAlertManagerConfig), { alertmanager_config: Object.assign(Object.assign({}, someGrafanaAlertManagerConfig.alertmanager_config), { receivers: [
                    ...((_a = someGrafanaAlertManagerConfig.alertmanager_config.receivers) !== null && _a !== void 0 ? _a : []),
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
                ] }) }));
    }));
    it('Hides create contact point button for users without permission', () => __awaiter(void 0, void 0, void 0, function* () {
        mockAlertmanagerChoiceResponse(server, alertmanagerChoiceMockedResponse);
        mocks.api.fetchConfig.mockResolvedValue(someGrafanaAlertManagerConfig);
        mocks.api.updateConfig.mockResolvedValue();
        grantUserPermissions([
            AccessControlAction.AlertingNotificationsRead,
            AccessControlAction.AlertingNotificationsExternalRead,
        ]);
        mocks.hooks.useGetContactPointsState.mockReturnValue(emptyContactPointsState);
        renderReceivers();
        yield ui.receiversTable.find();
        expect(ui.newContactPointButton.query()).not.toBeInTheDocument();
    }));
    it('Cloud alertmanager receiver can be edited', () => __awaiter(void 0, void 0, void 0, function* () {
        mockAlertmanagerChoiceResponse(server, alertmanagerChoiceMockedResponse);
        mocks.api.fetchConfig.mockResolvedValue(someCloudAlertManagerConfig);
        mocks.api.updateConfig.mockResolvedValue();
        renderReceivers('CloudManager');
        // click edit button for the receiver
        yield ui.receiversTable.find();
        const receiverRows = within(screen.getByTestId('dynamic-table')).getAllByTestId('row');
        expect(receiverRows[0]).toHaveTextContent('cloud-receiver');
        yield userEvent.click(byTestId('edit').get(receiverRows[0]));
        // check that form is open
        yield byRole('heading', { name: /update contact point/i }).find();
        expect(locationService.getLocation().pathname).toEqual('/alerting/notifications/receivers/cloud-receiver/edit');
        expect(ui.channelFormContainer.queryAll()).toHaveLength(2);
        // delete the email channel
        expect(ui.channelFormContainer.queryAll()).toHaveLength(2);
        yield userEvent.click(byTestId('items.0.delete-button').get());
        expect(ui.channelFormContainer.queryAll()).toHaveLength(1);
        // modify webhook url
        const slackContainer = ui.channelFormContainer.get();
        yield userEvent.click(byText('Optional Slack settings').get(slackContainer));
        yield userEvent.type(ui.inputs.slack.webhookURL.get(slackContainer), 'http://newgreaturl');
        // add confirm button to action
        yield userEvent.click(byText(/Actions \(1\)/i).get(slackContainer));
        yield userEvent.click(yield byTestId('items.1.settings.actions.0.confirm.add-button').find());
        const confirmSubform = byTestId('items.1.settings.actions.0.confirm.container').get();
        yield userEvent.type(byLabelText('Text').get(confirmSubform), 'confirm this');
        // delete a field
        yield userEvent.click(byText(/Fields \(2\)/i).get(slackContainer));
        yield userEvent.click(byTestId('items.1.settings.fields.0.delete-button').get());
        byText(/Fields \(1\)/i).get(slackContainer);
        // add another channel
        yield userEvent.click(ui.newContactPointIntegrationButton.get());
        yield clickSelectOption(yield byTestId('items.2.type').find(), 'Webhook');
        yield userEvent.type(yield ui.inputs.webhook.URL.find(), 'http://webhookurl');
        yield userEvent.click(ui.saveContactButton.get());
        // see that we're back to main page and proper api calls have been made
        yield ui.receiversTable.find();
        expect(mocks.api.updateConfig).toHaveBeenCalledTimes(1);
        expect(mocks.api.fetchConfig).toHaveBeenCalledTimes(2);
        expect(locationService.getLocation().pathname).toEqual('/alerting/notifications');
        expect(mocks.api.updateConfig).toHaveBeenLastCalledWith('CloudManager', Object.assign(Object.assign({}, someCloudAlertManagerConfig), { alertmanager_config: Object.assign(Object.assign({}, someCloudAlertManagerConfig.alertmanager_config), { receivers: [
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
                ] }) }));
    }));
    it('Prometheus Alertmanager receiver cannot be edited', () => __awaiter(void 0, void 0, void 0, function* () {
        mockAlertmanagerChoiceResponse(server, alertmanagerChoiceMockedResponse);
        mocks.api.fetchStatus.mockResolvedValue(Object.assign(Object.assign({}, someCloudAlertManagerStatus), { config: someCloudAlertManagerConfig.alertmanager_config }));
        renderReceivers(dataSources.promAlertManager.name);
        yield ui.receiversTable.find();
        // there's no templates table for vanilla prom, API does not return templates
        expect(ui.templatesTable.query()).not.toBeInTheDocument();
        // click view button on the receiver
        const receiverRows = within(screen.getByTestId('dynamic-table')).getAllByTestId('row');
        expect(receiverRows[0]).toHaveTextContent('cloud-receiver');
        expect(byTestId('edit').query(receiverRows[0])).not.toBeInTheDocument();
        yield userEvent.click(byTestId('view').get(receiverRows[0]));
        // check that form is open
        yield byRole('heading', { name: /contact point/i }).find();
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
    }));
    it('Loads config from status endpoint if there is no user config', () => __awaiter(void 0, void 0, void 0, function* () {
        mockAlertmanagerChoiceResponse(server, alertmanagerChoiceMockedResponse);
        // loading an empty config with make it fetch config from status endpoint
        mocks.api.fetchConfig.mockResolvedValue({
            template_files: {},
            alertmanager_config: {},
        });
        mocks.api.fetchStatus.mockResolvedValue(someCloudAlertManagerStatus);
        renderReceivers('CloudManager');
        // check that receiver from the default config is represented
        yield ui.receiversTable.find();
        const receiverRows = within(screen.getByTestId('dynamic-table')).getAllByTestId('row');
        expect(receiverRows[0]).toHaveTextContent('default-email');
        // check that both config and status endpoints were called
        expect(mocks.api.fetchConfig).toHaveBeenCalledTimes(1);
        expect(mocks.api.fetchConfig).toHaveBeenLastCalledWith('CloudManager');
        expect(mocks.api.fetchStatus).toHaveBeenCalledTimes(1);
        expect(mocks.api.fetchStatus).toHaveBeenLastCalledWith('CloudManager');
    }));
    it('Shows an empty config when config returns an error and the AM supports lazy config initialization', () => __awaiter(void 0, void 0, void 0, function* () {
        mockAlertmanagerChoiceResponse(server, alertmanagerChoiceMockedResponse);
        mocks.api.discoverAlertmanagerFeatures.mockResolvedValue({ lazyConfigInit: true });
        mocks.api.fetchConfig.mockRejectedValue({ message: 'alertmanager storage object not found' });
        renderReceivers('CloudManager');
        const templatesTable = yield ui.templatesTable.find();
        const receiversTable = yield ui.receiversTable.find();
        expect(templatesTable).toBeInTheDocument();
        expect(receiversTable).toBeInTheDocument();
    }));
    describe('Contact points health', () => {
        it('Should render error notifications when there are some points state ', () => __awaiter(void 0, void 0, void 0, function* () {
            mockAlertmanagerChoiceResponse(server, alertmanagerChoiceMockedResponse);
            mocks.api.fetchConfig.mockResolvedValue(someGrafanaAlertManagerConfig);
            mocks.api.updateConfig.mockResolvedValue();
            const receiversMock = {
                receivers: {
                    default: {
                        active: true,
                        notifiers: {
                            email: [
                                {
                                    lastNotifyAttemptError: 'establish connection to server: dial tcp: lookup smtp.example.org on 8.8.8.8:53: no such host',
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
            renderReceivers();
            //
            yield ui.receiversTable.find();
            const receiverRows = within(screen.getByTestId('dynamic-table')).getAllByTestId('row');
            expect(receiverRows[0]).toHaveTextContent('1 error');
            expect(receiverRows[1]).not.toHaveTextContent('error');
            expect(receiverRows[1]).toHaveTextContent('OK');
            //should show error in contact points when expanding
            // expand contact point detail for default 2 emails - 2 errors
            yield userEvent.click(ui.contactPointsCollapseToggle.get(receiverRows[0]));
            const defaultDetailTable = screen.getAllByTestId('dynamic-table')[1];
            expect(byText('Error').getAll(defaultDetailTable)).toHaveLength(1);
            // expand contact point detail for slack and pagerduty - 0 errors
            yield userEvent.click(ui.contactPointsCollapseToggle.get(receiverRows[1]));
            const criticalDetailTable = screen.getAllByTestId('dynamic-table')[2];
            expect(byText('Error').query(criticalDetailTable)).toBeNull();
            expect(byText('OK').getAll(criticalDetailTable)).toHaveLength(2);
        }));
        it('Should render no attempt message when there are some points state with null lastNotifyAttempt, and "-" in null values', () => __awaiter(void 0, void 0, void 0, function* () {
            mockAlertmanagerChoiceResponse(server, alertmanagerChoiceMockedResponse);
            mocks.api.fetchConfig.mockResolvedValue(someGrafanaAlertManagerConfig);
            mocks.api.updateConfig.mockResolvedValue();
            const receiversMock = {
                receivers: {
                    default: {
                        active: true,
                        notifiers: {
                            email: [
                                {
                                    lastNotifyAttemptError: 'establish connection to server: dial tcp: lookup smtp.example.org on 8.8.8.8:53: no such host',
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
            renderReceivers();
            //
            yield ui.receiversTable.find();
            const receiverRows = within(screen.getByTestId('dynamic-table')).getAllByTestId('row');
            expect(receiverRows[0]).toHaveTextContent('1 error');
            expect(receiverRows[1]).not.toHaveTextContent('error');
            expect(receiverRows[1]).toHaveTextContent('No attempts');
            //should show error in contact points when expanding
            // expand contact point detail for default 2 emails - 2 errors
            yield userEvent.click(ui.contactPointsCollapseToggle.get(receiverRows[0]));
            const defaultDetailTable = screen.getAllByTestId('dynamic-table')[1];
            expect(byText('Error').getAll(defaultDetailTable)).toHaveLength(1);
            // expand contact point detail for slack and pagerduty - 0 errors
            yield userEvent.click(ui.contactPointsCollapseToggle.get(receiverRows[1]));
            const criticalDetailTableRows = within(screen.getAllByTestId('dynamic-table')[2]).getAllByTestId('row');
            // should render slack item with no attempt
            expect(criticalDetailTableRows[0]).toHaveTextContent('No attempt');
            expect(criticalDetailTableRows[0]).toHaveTextContent('--');
            //should render pagerduty with no attempt
            expect(criticalDetailTableRows[1]).toHaveTextContent('OK');
            expect(criticalDetailTableRows[1]).toHaveTextContent('117.2455ms');
        }));
        it('Should not render error notifications when fetching contact points state raises 404 error ', () => __awaiter(void 0, void 0, void 0, function* () {
            mockAlertmanagerChoiceResponse(server, alertmanagerChoiceMockedResponse);
            mocks.api.fetchConfig.mockResolvedValue(someGrafanaAlertManagerConfig);
            mocks.api.updateConfig.mockResolvedValue();
            mocks.hooks.useGetContactPointsState.mockReturnValue(emptyContactPointsState);
            renderReceivers();
            yield ui.receiversTable.find();
            //contact points are not expandable
            expect(ui.contactPointsCollapseToggle.query()).not.toBeInTheDocument();
            //should render receivers, only one dynamic table
            let receiverRows = within(screen.getByTestId('dynamic-table')).getAllByTestId('row');
            expect(receiverRows[0]).toHaveTextContent('default');
            expect(receiverRows[1]).toHaveTextContent('critical');
            expect(receiverRows).toHaveLength(2);
        }));
        it('Should render "Unused" warning if a contact point is not used in route configuration', () => __awaiter(void 0, void 0, void 0, function* () {
            mockAlertmanagerChoiceResponse(server, alertmanagerChoiceMockedResponse);
            mocks.api.updateConfig.mockResolvedValue();
            mocks.api.fetchConfig.mockResolvedValue(Object.assign(Object.assign({}, someGrafanaAlertManagerConfig), { alertmanager_config: Object.assign(Object.assign({}, someGrafanaAlertManagerConfig.alertmanager_config), { route: { receiver: 'default' } }) }));
            mocks.hooks.useGetContactPointsState.mockReturnValue(emptyContactPointsState);
            renderReceivers();
            yield ui.receiversTable.find();
            //contact points are not expandable
            expect(ui.contactPointsCollapseToggle.query()).not.toBeInTheDocument();
            //should render receivers, only one dynamic table
            let receiverRows = within(screen.getByTestId('dynamic-table')).getAllByTestId('row');
            expect(receiverRows).toHaveLength(2);
            expect(receiverRows[0]).toHaveTextContent('default');
            expect(receiverRows[1]).toHaveTextContent('critical');
            expect(receiverRows[1]).toHaveTextContent('Unused');
        }));
    });
});
//# sourceMappingURL=ContactPoints.v1.test.js.map