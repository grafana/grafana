import { __assign, __awaiter, __generator, __read, __spreadArray } from "tslib";
import { configureStore } from 'app/store/configureStore';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import Receivers from './Receivers';
import React from 'react';
import { locationService, setDataSourceSrv } from '@grafana/runtime';
import { act, render, waitFor } from '@testing-library/react';
import { getAllDataSources } from './utils/config';
import { typeAsJestMock } from 'test/helpers/typeAsJestMock';
import { updateAlertManagerConfig, fetchAlertManagerConfig, fetchStatus, testReceivers } from './api/alertmanager';
import { mockDataSource, MockDataSourceSrv, someCloudAlertManagerConfig, someCloudAlertManagerStatus, someGrafanaAlertManagerConfig, } from './mocks';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';
import { fetchNotifiers } from './api/grafana';
import { grafanaNotifiersMock } from './mocks/grafana-notifiers';
import { byLabelText, byPlaceholderText, byRole, byTestId, byText } from 'testing-library-selector';
import userEvent from '@testing-library/user-event';
import { ALERTMANAGER_NAME_LOCAL_STORAGE_KEY, ALERTMANAGER_NAME_QUERY_KEY } from './utils/constants';
import store from 'app/core/store';
import { contextSrv } from 'app/core/services/context_srv';
import { selectOptionInTest } from '@grafana/ui';
import { AlertManagerImplementation } from 'app/plugins/datasource/alertmanager/types';
jest.mock('./api/alertmanager');
jest.mock('./api/grafana');
jest.mock('./utils/config');
var mocks = {
    getAllDataSources: typeAsJestMock(getAllDataSources),
    api: {
        fetchConfig: typeAsJestMock(fetchAlertManagerConfig),
        fetchStatus: typeAsJestMock(fetchStatus),
        updateConfig: typeAsJestMock(updateAlertManagerConfig),
        fetchNotifiers: typeAsJestMock(fetchNotifiers),
        testReceivers: typeAsJestMock(testReceivers),
    },
};
var renderReceivers = function (alertManagerSourceName) {
    var store = configureStore();
    locationService.push('/alerting/notifications' +
        (alertManagerSourceName ? "?" + ALERTMANAGER_NAME_QUERY_KEY + "=" + alertManagerSourceName : ''));
    return render(React.createElement(Provider, { store: store },
        React.createElement(Router, { history: locationService.getHistory() },
            React.createElement(Receivers, null))));
};
var dataSources = {
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
var ui = {
    newContactPointButton: byRole('link', { name: /new contact point/i }),
    saveContactButton: byRole('button', { name: /save contact point/i }),
    newContactPointTypeButton: byRole('button', { name: /new contact point type/i }),
    testContactPointButton: byRole('button', { name: /Test/ }),
    cancelButton: byTestId('cancel-button'),
    receiversTable: byTestId('receivers-table'),
    templatesTable: byTestId('templates-table'),
    alertManagerPicker: byTestId('alertmanager-picker'),
    channelFormContainer: byTestId('item-container'),
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
var clickSelectOption = function (selectElement, optionText) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                userEvent.click(byRole('textbox').get(selectElement));
                return [4 /*yield*/, selectOptionInTest(selectElement, optionText)];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
describe('Receivers', function () {
    beforeEach(function () {
        jest.resetAllMocks();
        mocks.getAllDataSources.mockReturnValue(Object.values(dataSources));
        mocks.api.fetchNotifiers.mockResolvedValue(grafanaNotifiersMock);
        setDataSourceSrv(new MockDataSourceSrv(dataSources));
        contextSrv.isEditor = true;
        store.delete(ALERTMANAGER_NAME_LOCAL_STORAGE_KEY);
    });
    it('Template and receiver tables are rendered, alertmanager can be selected', function () { return __awaiter(void 0, void 0, void 0, function () {
        var receiversTable, templatesTable, templateRows, receiverRows;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mocks.api.fetchConfig.mockImplementation(function (name) {
                        return Promise.resolve(name === GRAFANA_RULES_SOURCE_NAME ? someGrafanaAlertManagerConfig : someCloudAlertManagerConfig);
                    });
                    return [4 /*yield*/, renderReceivers()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, ui.receiversTable.find()];
                case 2:
                    receiversTable = _a.sent();
                    return [4 /*yield*/, ui.templatesTable.find()];
                case 3:
                    templatesTable = _a.sent();
                    templateRows = templatesTable.querySelectorAll('tbody tr');
                    expect(templateRows).toHaveLength(3);
                    expect(templateRows[0]).toHaveTextContent('first template');
                    expect(templateRows[1]).toHaveTextContent('second template');
                    expect(templateRows[2]).toHaveTextContent('third template');
                    receiverRows = receiversTable.querySelectorAll('tbody tr');
                    expect(receiverRows[0]).toHaveTextContent('default');
                    expect(receiverRows[1]).toHaveTextContent('critical');
                    expect(receiverRows).toHaveLength(2);
                    expect(mocks.api.fetchConfig).toHaveBeenCalledTimes(1);
                    expect(mocks.api.fetchConfig).toHaveBeenCalledWith(GRAFANA_RULES_SOURCE_NAME);
                    expect(mocks.api.fetchNotifiers).toHaveBeenCalledTimes(1);
                    expect(locationService.getSearchObject()[ALERTMANAGER_NAME_QUERY_KEY]).toEqual(undefined);
                    // select external cloud alertmanager, check that data is retrieved and contents are rendered as appropriate
                    return [4 /*yield*/, clickSelectOption(ui.alertManagerPicker.get(), 'CloudManager')];
                case 4:
                    // select external cloud alertmanager, check that data is retrieved and contents are rendered as appropriate
                    _a.sent();
                    return [4 /*yield*/, byText('cloud-receiver').find()];
                case 5:
                    _a.sent();
                    expect(mocks.api.fetchConfig).toHaveBeenCalledTimes(2);
                    expect(mocks.api.fetchConfig).toHaveBeenLastCalledWith('CloudManager');
                    return [4 /*yield*/, ui.receiversTable.find()];
                case 6:
                    receiversTable = _a.sent();
                    return [4 /*yield*/, ui.templatesTable.find()];
                case 7:
                    templatesTable = _a.sent();
                    templateRows = templatesTable.querySelectorAll('tbody tr');
                    expect(templateRows[0]).toHaveTextContent('foo template');
                    expect(templateRows).toHaveLength(1);
                    receiverRows = receiversTable.querySelectorAll('tbody tr');
                    expect(receiverRows[0]).toHaveTextContent('cloud-receiver');
                    expect(receiverRows).toHaveLength(1);
                    expect(locationService.getSearchObject()[ALERTMANAGER_NAME_QUERY_KEY]).toEqual('CloudManager');
                    return [2 /*return*/];
            }
        });
    }); });
    it('Grafana receiver can be tested', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, _b, email;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    mocks.api.fetchConfig.mockResolvedValue(someGrafanaAlertManagerConfig);
                    return [4 /*yield*/, renderReceivers()];
                case 1:
                    _c.sent();
                    // go to new contact point page
                    _b = (_a = userEvent).click;
                    return [4 /*yield*/, ui.newContactPointButton.find()];
                case 2:
                    // go to new contact point page
                    _b.apply(_a, [_c.sent()]);
                    return [4 /*yield*/, byRole('heading', { name: /create contact point/i }).find()];
                case 3:
                    _c.sent();
                    expect(locationService.getLocation().pathname).toEqual('/alerting/notifications/receivers/new');
                    // type in a name for the new receiver
                    userEvent.type(ui.inputs.name.get(), 'my new receiver');
                    email = ui.inputs.email.addresses.get();
                    userEvent.clear(email);
                    userEvent.type(email, 'tester@grafana.com');
                    // try to test the contact point
                    userEvent.click(ui.testContactPointButton.get());
                    return [4 /*yield*/, waitFor(function () { return expect(mocks.api.testReceivers).toHaveBeenCalled(); })];
                case 4:
                    _c.sent();
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
                    ]);
                    return [2 /*return*/];
            }
        });
    }); });
    it('Grafana receiver can be created', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a, _b, urlInput, apiKeyInput;
        var _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    mocks.api.fetchConfig.mockResolvedValue(someGrafanaAlertManagerConfig);
                    mocks.api.updateConfig.mockResolvedValue();
                    return [4 /*yield*/, renderReceivers()];
                case 1:
                    _d.sent();
                    _b = (_a = userEvent).click;
                    return [4 /*yield*/, ui.newContactPointButton.find()];
                case 2: 
                // go to new contact point page
                return [4 /*yield*/, _b.apply(_a, [_d.sent()])];
                case 3:
                    // go to new contact point page
                    _d.sent();
                    return [4 /*yield*/, byRole('heading', { name: /create contact point/i }).find()];
                case 4:
                    _d.sent();
                    expect(locationService.getLocation().pathname).toEqual('/alerting/notifications/receivers/new');
                    // type in a name for the new receiver
                    userEvent.type(byPlaceholderText('Name').get(), 'my new receiver');
                    // check that default email form is rendered
                    return [4 /*yield*/, ui.inputs.email.addresses.find()];
                case 5:
                    // check that default email form is rendered
                    _d.sent();
                    // select hipchat
                    return [4 /*yield*/, clickSelectOption(byTestId('items.0.type').get(), 'HipChat')];
                case 6:
                    // select hipchat
                    _d.sent();
                    // check that email options are gone and hipchat options appear
                    expect(ui.inputs.email.addresses.query()).not.toBeInTheDocument();
                    urlInput = ui.inputs.hipchat.url.get();
                    apiKeyInput = ui.inputs.hipchat.apiKey.get();
                    userEvent.type(urlInput, 'http://hipchat');
                    userEvent.type(apiKeyInput, 'foobarbaz');
                    // it seems react-hook-form does some async state updates after submit
                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, userEvent.click(ui.saveContactButton.get())];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 7:
                    // it seems react-hook-form does some async state updates after submit
                    _d.sent();
                    // see that we're back to main page and proper api calls have been made
                    return [4 /*yield*/, ui.receiversTable.find()];
                case 8:
                    // see that we're back to main page and proper api calls have been made
                    _d.sent();
                    expect(mocks.api.updateConfig).toHaveBeenCalledTimes(1);
                    expect(mocks.api.fetchConfig).toHaveBeenCalledTimes(3);
                    expect(locationService.getLocation().pathname).toEqual('/alerting/notifications');
                    expect(mocks.api.updateConfig).toHaveBeenLastCalledWith(GRAFANA_RULES_SOURCE_NAME, __assign(__assign({}, someGrafanaAlertManagerConfig), { alertmanager_config: __assign(__assign({}, someGrafanaAlertManagerConfig.alertmanager_config), { receivers: __spreadArray(__spreadArray([], __read(((_c = someGrafanaAlertManagerConfig.alertmanager_config.receivers) !== null && _c !== void 0 ? _c : [])), false), [
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
                            ], false) }) }));
                    return [2 /*return*/];
            }
        });
    }); });
    it('Cloud alertmanager receiver can be edited', function () { return __awaiter(void 0, void 0, void 0, function () {
        var receiversTable, receiverRows, slackContainer, _a, _b, confirmSubform, _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    mocks.api.fetchConfig.mockResolvedValue(someCloudAlertManagerConfig);
                    mocks.api.updateConfig.mockResolvedValue();
                    return [4 /*yield*/, renderReceivers('CloudManager')];
                case 1:
                    _f.sent();
                    return [4 /*yield*/, ui.receiversTable.find()];
                case 2:
                    receiversTable = _f.sent();
                    receiverRows = receiversTable.querySelectorAll('tbody tr');
                    expect(receiverRows[0]).toHaveTextContent('cloud-receiver');
                    return [4 /*yield*/, userEvent.click(byTestId('edit').get(receiverRows[0]))];
                case 3:
                    _f.sent();
                    // check that form is open
                    return [4 /*yield*/, byRole('heading', { name: /update contact point/i }).find()];
                case 4:
                    // check that form is open
                    _f.sent();
                    expect(locationService.getLocation().pathname).toEqual('/alerting/notifications/receivers/cloud-receiver/edit');
                    expect(ui.channelFormContainer.queryAll()).toHaveLength(2);
                    // delete the email channel
                    expect(ui.channelFormContainer.queryAll()).toHaveLength(2);
                    return [4 /*yield*/, userEvent.click(byTestId('items.0.delete-button').get())];
                case 5:
                    _f.sent();
                    expect(ui.channelFormContainer.queryAll()).toHaveLength(1);
                    slackContainer = ui.channelFormContainer.get();
                    return [4 /*yield*/, userEvent.click(byText('Optional Slack settings').get(slackContainer))];
                case 6:
                    _f.sent();
                    userEvent.type(ui.inputs.slack.webhookURL.get(slackContainer), 'http://newgreaturl');
                    // add confirm button to action
                    return [4 /*yield*/, userEvent.click(byText(/Actions \(1\)/i).get(slackContainer))];
                case 7:
                    // add confirm button to action
                    _f.sent();
                    _b = (_a = userEvent).click;
                    return [4 /*yield*/, byTestId('items.1.settings.actions.0.confirm.add-button').find()];
                case 8: return [4 /*yield*/, _b.apply(_a, [_f.sent()])];
                case 9:
                    _f.sent();
                    confirmSubform = byTestId('items.1.settings.actions.0.confirm.container').get();
                    userEvent.type(byLabelText('Text').get(confirmSubform), 'confirm this');
                    // delete a field
                    return [4 /*yield*/, userEvent.click(byText(/Fields \(2\)/i).get(slackContainer))];
                case 10:
                    // delete a field
                    _f.sent();
                    return [4 /*yield*/, userEvent.click(byTestId('items.1.settings.fields.0.delete-button').get())];
                case 11:
                    _f.sent();
                    return [4 /*yield*/, byText(/Fields \(1\)/i).get(slackContainer)];
                case 12:
                    _f.sent();
                    // add another channel
                    return [4 /*yield*/, userEvent.click(ui.newContactPointTypeButton.get())];
                case 13:
                    // add another channel
                    _f.sent();
                    _c = clickSelectOption;
                    return [4 /*yield*/, byTestId('items.2.type').find()];
                case 14: return [4 /*yield*/, _c.apply(void 0, [_f.sent(), 'Webhook'])];
                case 15:
                    _f.sent();
                    _e = (_d = userEvent).type;
                    return [4 /*yield*/, ui.inputs.webhook.URL.find()];
                case 16:
                    _e.apply(_d, [_f.sent(), 'http://webhookurl']);
                    // it seems react-hook-form does some async state updates after submit
                    return [4 /*yield*/, act(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, userEvent.click(ui.saveContactButton.get())];
                                    case 1:
                                        _a.sent();
                                        return [2 /*return*/];
                                }
                            });
                        }); })];
                case 17:
                    // it seems react-hook-form does some async state updates after submit
                    _f.sent();
                    // see that we're back to main page and proper api calls have been made
                    return [4 /*yield*/, ui.receiversTable.find()];
                case 18:
                    // see that we're back to main page and proper api calls have been made
                    _f.sent();
                    expect(mocks.api.updateConfig).toHaveBeenCalledTimes(1);
                    expect(mocks.api.fetchConfig).toHaveBeenCalledTimes(3);
                    expect(locationService.getLocation().pathname).toEqual('/alerting/notifications');
                    expect(mocks.api.updateConfig).toHaveBeenLastCalledWith('CloudManager', __assign(__assign({}, someCloudAlertManagerConfig), { alertmanager_config: __assign(__assign({}, someCloudAlertManagerConfig.alertmanager_config), { receivers: [
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
                    return [2 /*return*/];
            }
        });
    }); });
    it('Prometheus Alertmanager receiver cannot be edited', function () { return __awaiter(void 0, void 0, void 0, function () {
        var receiversTable, receiverRows, channelForms;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mocks.api.fetchStatus.mockResolvedValue(__assign(__assign({}, someCloudAlertManagerStatus), { config: someCloudAlertManagerConfig.alertmanager_config }));
                    return [4 /*yield*/, renderReceivers(dataSources.promAlertManager.name)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, ui.receiversTable.find()];
                case 2:
                    receiversTable = _a.sent();
                    // there's no templates table for vanilla prom, API does not return templates
                    expect(ui.templatesTable.query()).not.toBeInTheDocument();
                    receiverRows = receiversTable.querySelectorAll('tbody tr');
                    expect(receiverRows[0]).toHaveTextContent('cloud-receiver');
                    expect(byTestId('edit').query(receiverRows[0])).not.toBeInTheDocument();
                    return [4 /*yield*/, userEvent.click(byTestId('view').get(receiverRows[0]))];
                case 3:
                    _a.sent();
                    // check that form is open
                    return [4 /*yield*/, byRole('heading', { name: /contact point/i }).find()];
                case 4:
                    // check that form is open
                    _a.sent();
                    expect(locationService.getLocation().pathname).toEqual('/alerting/notifications/receivers/cloud-receiver/edit');
                    channelForms = ui.channelFormContainer.queryAll();
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
                    return [2 /*return*/];
            }
        });
    }); });
    it('Loads config from status endpoint if there is no user config', function () { return __awaiter(void 0, void 0, void 0, function () {
        var receiversTable, receiverRows;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // loading an empty config with make it fetch config from status endpoint
                    mocks.api.fetchConfig.mockResolvedValue({
                        template_files: {},
                        alertmanager_config: {},
                    });
                    mocks.api.fetchStatus.mockResolvedValue(someCloudAlertManagerStatus);
                    return [4 /*yield*/, renderReceivers('CloudManager')];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, ui.receiversTable.find()];
                case 2:
                    receiversTable = _a.sent();
                    receiverRows = receiversTable.querySelectorAll('tbody tr');
                    expect(receiverRows[0]).toHaveTextContent('default-email');
                    // check that both config and status endpoints were called
                    expect(mocks.api.fetchConfig).toHaveBeenCalledTimes(1);
                    expect(mocks.api.fetchConfig).toHaveBeenLastCalledWith('CloudManager');
                    expect(mocks.api.fetchStatus).toHaveBeenCalledTimes(1);
                    expect(mocks.api.fetchStatus).toHaveBeenLastCalledWith('CloudManager');
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=Receivers.test.js.map