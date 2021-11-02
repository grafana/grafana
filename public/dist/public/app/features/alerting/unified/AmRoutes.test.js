import { __assign, __awaiter, __generator, __read } from "tslib";
import React from 'react';
import { locationService, setDataSourceSrv } from '@grafana/runtime';
import { render, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { AlertManagerImplementation, } from 'app/plugins/datasource/alertmanager/types';
import { configureStore } from 'app/store/configureStore';
import { typeAsJestMock } from 'test/helpers/typeAsJestMock';
import { byRole, byTestId, byText } from 'testing-library-selector';
import AmRoutes from './AmRoutes';
import { fetchAlertManagerConfig, fetchStatus, updateAlertManagerConfig } from './api/alertmanager';
import { mockDataSource, MockDataSourceSrv, someCloudAlertManagerConfig, someCloudAlertManagerStatus } from './mocks';
import { getAllDataSources } from './utils/config';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';
import userEvent from '@testing-library/user-event';
import { selectOptionInTest } from '@grafana/ui';
import { ALERTMANAGER_NAME_QUERY_KEY } from './utils/constants';
jest.mock('./api/alertmanager');
jest.mock('./utils/config');
var mocks = {
    getAllDataSourcesMock: typeAsJestMock(getAllDataSources),
    api: {
        fetchAlertManagerConfig: typeAsJestMock(fetchAlertManagerConfig),
        updateAlertManagerConfig: typeAsJestMock(updateAlertManagerConfig),
        fetchStatus: typeAsJestMock(fetchStatus),
    },
};
var renderAmRoutes = function (alertManagerSourceName) {
    var store = configureStore();
    locationService.push(location);
    locationService.push('/alerting/routes' + (alertManagerSourceName ? "?" + ALERTMANAGER_NAME_QUERY_KEY + "=" + alertManagerSourceName : ''));
    return render(React.createElement(Provider, { store: store },
        React.createElement(Router, { history: locationService.getHistory() },
            React.createElement(AmRoutes, null))));
};
var dataSources = {
    am: mockDataSource({
        name: 'Alertmanager',
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
    rootReceiver: byTestId('am-routes-root-receiver'),
    rootGroupBy: byTestId('am-routes-root-group-by'),
    rootTimings: byTestId('am-routes-root-timings'),
    row: byTestId('am-routes-row'),
    rootRouteContainer: byTestId('am-root-route-container'),
    editButton: byRole('button', { name: 'Edit' }),
    saveButton: byRole('button', { name: 'Save' }),
    editRouteButton: byTestId('edit-route'),
    deleteRouteButton: byTestId('delete-route'),
    newPolicyButton: byRole('button', { name: /New policy/ }),
    receiverSelect: byTestId('am-receiver-select'),
    groupSelect: byTestId('am-group-select'),
    groupWaitContainer: byTestId('am-group-wait'),
    groupIntervalContainer: byTestId('am-group-interval'),
    groupRepeatContainer: byTestId('am-repeat-interval'),
};
describe('AmRoutes', function () {
    var subroutes = [
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
    var simpleRoute = {
        receiver: 'simple-receiver',
        matchers: ['hello=world', 'foo!=bar'],
    };
    var rootRoute = {
        receiver: 'default-receiver',
        group_by: ['a-group', 'another-group'],
        group_wait: '1s',
        group_interval: '2m',
        repeat_interval: '3d',
        routes: subroutes,
    };
    beforeEach(function () {
        mocks.getAllDataSourcesMock.mockReturnValue(Object.values(dataSources));
        setDataSourceSrv(new MockDataSourceSrv(dataSources));
    });
    afterEach(function () {
        jest.resetAllMocks();
        setDataSourceSrv(undefined);
    });
    it('loads and shows routes', function () { return __awaiter(void 0, void 0, void 0, function () {
        var rootTimings, rows;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
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
                    return [4 /*yield*/, renderAmRoutes()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, waitFor(function () { return expect(mocks.api.fetchAlertManagerConfig).toHaveBeenCalledTimes(1); })];
                case 2:
                    _a.sent();
                    expect(ui.rootReceiver.get()).toHaveTextContent(rootRoute.receiver);
                    expect(ui.rootGroupBy.get()).toHaveTextContent(rootRoute.group_by.join(', '));
                    rootTimings = ui.rootTimings.get();
                    expect(rootTimings).toHaveTextContent(rootRoute.group_wait);
                    expect(rootTimings).toHaveTextContent(rootRoute.group_interval);
                    expect(rootTimings).toHaveTextContent(rootRoute.repeat_interval);
                    return [4 /*yield*/, ui.row.findAll()];
                case 3:
                    rows = _a.sent();
                    expect(rows).toHaveLength(2);
                    subroutes.forEach(function (route, index) {
                        var _a, _b;
                        Object.entries((_a = route.match) !== null && _a !== void 0 ? _a : {}).forEach(function (_a) {
                            var _b = __read(_a, 2), label = _b[0], value = _b[1];
                            expect(rows[index]).toHaveTextContent(label + "=" + value);
                        });
                        Object.entries((_b = route.match_re) !== null && _b !== void 0 ? _b : {}).forEach(function (_a) {
                            var _b = __read(_a, 2), label = _b[0], value = _b[1];
                            expect(rows[index]).toHaveTextContent(label + "=~" + value);
                        });
                        if (route.group_by) {
                            expect(rows[index]).toHaveTextContent(route.group_by.join(', '));
                        }
                        if (route.receiver) {
                            expect(rows[index]).toHaveTextContent(route.receiver);
                        }
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    it('can edit root route if one is already defined', function () { return __awaiter(void 0, void 0, void 0, function () {
        var defaultConfig, currentConfig, _a, rootRouteContainer, receiverSelect, groupSelect;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    defaultConfig = {
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
                    currentConfig = { current: defaultConfig };
                    mocks.api.updateAlertManagerConfig.mockImplementation(function (amSourceName, newConfig) {
                        currentConfig.current = newConfig;
                        return Promise.resolve();
                    });
                    mocks.api.fetchAlertManagerConfig.mockImplementation(function () {
                        return Promise.resolve(currentConfig.current);
                    });
                    return [4 /*yield*/, renderAmRoutes()];
                case 1:
                    _b.sent();
                    _a = expect;
                    return [4 /*yield*/, ui.rootReceiver.find()];
                case 2:
                    _a.apply(void 0, [_b.sent()]).toHaveTextContent('default');
                    expect(ui.rootGroupBy.get()).toHaveTextContent('alertname');
                    return [4 /*yield*/, ui.rootRouteContainer.find()];
                case 3:
                    rootRouteContainer = _b.sent();
                    userEvent.click(ui.editButton.get(rootRouteContainer));
                    return [4 /*yield*/, ui.receiverSelect.find()];
                case 4:
                    receiverSelect = _b.sent();
                    return [4 /*yield*/, clickSelectOption(receiverSelect, 'critical')];
                case 5:
                    _b.sent();
                    groupSelect = ui.groupSelect.get();
                    userEvent.type(byRole('textbox').get(groupSelect), 'namespace{enter}');
                    // configure timing intervals
                    userEvent.click(byText('Timing options').get(rootRouteContainer));
                    return [4 /*yield*/, updateTiming(ui.groupWaitContainer.get(), '1', 'Minutes')];
                case 6:
                    _b.sent();
                    return [4 /*yield*/, updateTiming(ui.groupIntervalContainer.get(), '4', 'Minutes')];
                case 7:
                    _b.sent();
                    return [4 /*yield*/, updateTiming(ui.groupRepeatContainer.get(), '5', 'Hours')];
                case 8:
                    _b.sent();
                    //save
                    userEvent.click(ui.saveButton.get(rootRouteContainer));
                    // wait for it to go out of edit mode
                    return [4 /*yield*/, waitFor(function () { return expect(ui.editButton.query(rootRouteContainer)).not.toBeInTheDocument(); })];
                case 9:
                    // wait for it to go out of edit mode
                    _b.sent();
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
                    return [4 /*yield*/, waitFor(function () { return expect(ui.rootReceiver.query()).toHaveTextContent('critical'); })];
                case 10:
                    // check that new config values are rendered
                    _b.sent();
                    expect(ui.rootGroupBy.get()).toHaveTextContent('alertname, namespace');
                    return [2 /*return*/];
            }
        });
    }); });
    it('can edit root route if one is not defined yet', function () { return __awaiter(void 0, void 0, void 0, function () {
        var rootRouteContainer, receiverSelect, groupSelect;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mocks.api.fetchAlertManagerConfig.mockResolvedValue({
                        alertmanager_config: {
                            receivers: [{ name: 'default' }],
                        },
                        template_files: {},
                    });
                    return [4 /*yield*/, renderAmRoutes()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, ui.rootRouteContainer.find()];
                case 2:
                    rootRouteContainer = _a.sent();
                    userEvent.click(ui.editButton.get(rootRouteContainer));
                    return [4 /*yield*/, ui.receiverSelect.find()];
                case 3:
                    receiverSelect = _a.sent();
                    return [4 /*yield*/, clickSelectOption(receiverSelect, 'default')];
                case 4:
                    _a.sent();
                    groupSelect = ui.groupSelect.get();
                    userEvent.type(byRole('textbox').get(groupSelect), 'severity{enter}');
                    userEvent.type(byRole('textbox').get(groupSelect), 'namespace{enter}');
                    //save
                    userEvent.click(ui.saveButton.get(rootRouteContainer));
                    // wait for it to go out of edit mode
                    return [4 /*yield*/, waitFor(function () { return expect(ui.editButton.query(rootRouteContainer)).not.toBeInTheDocument(); })];
                case 5:
                    // wait for it to go out of edit mode
                    _a.sent();
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
                    return [2 /*return*/];
            }
        });
    }); });
    it('Show error message if loading Alertmanager config fails', function () { return __awaiter(void 0, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    mocks.api.fetchAlertManagerConfig.mockRejectedValue({
                        status: 500,
                        data: {
                            message: "Alertmanager has exploded. it's gone. Forget about it.",
                        },
                    });
                    return [4 /*yield*/, renderAmRoutes()];
                case 1:
                    _b.sent();
                    return [4 /*yield*/, waitFor(function () { return expect(mocks.api.fetchAlertManagerConfig).toHaveBeenCalledTimes(1); })];
                case 2:
                    _b.sent();
                    _a = expect;
                    return [4 /*yield*/, byText("Alertmanager has exploded. it's gone. Forget about it.").find()];
                case 3:
                    _a.apply(void 0, [_b.sent()]).toBeInTheDocument();
                    expect(ui.rootReceiver.query()).not.toBeInTheDocument();
                    expect(ui.editButton.query()).not.toBeInTheDocument();
                    return [2 /*return*/];
            }
        });
    }); });
    it('Converts matchers to object_matchers for grafana alertmanager', function () { return __awaiter(void 0, void 0, void 0, function () {
        var defaultConfig, currentConfig, _a, rootRouteContainer;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    defaultConfig = {
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
                    currentConfig = { current: defaultConfig };
                    mocks.api.updateAlertManagerConfig.mockImplementation(function (amSourceName, newConfig) {
                        currentConfig.current = newConfig;
                        return Promise.resolve();
                    });
                    mocks.api.fetchAlertManagerConfig.mockImplementation(function () {
                        return Promise.resolve(currentConfig.current);
                    });
                    return [4 /*yield*/, renderAmRoutes(GRAFANA_RULES_SOURCE_NAME)];
                case 1:
                    _b.sent();
                    _a = expect;
                    return [4 /*yield*/, ui.rootReceiver.find()];
                case 2:
                    _a.apply(void 0, [_b.sent()]).toHaveTextContent('default');
                    expect(mocks.api.fetchAlertManagerConfig).toHaveBeenCalled();
                    return [4 /*yield*/, ui.rootRouteContainer.find()];
                case 3:
                    rootRouteContainer = _b.sent();
                    userEvent.click(ui.editButton.get(rootRouteContainer));
                    userEvent.click(ui.saveButton.get(rootRouteContainer));
                    return [4 /*yield*/, waitFor(function () { return expect(ui.editButton.query(rootRouteContainer)).not.toBeInTheDocument(); })];
                case 4:
                    _b.sent();
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
                                routes: [
                                    {
                                        continue: false,
                                        group_by: [],
                                        object_matchers: [
                                            ['hello', '=', 'world'],
                                            ['foo', '!=', 'bar'],
                                        ],
                                        receiver: 'simple-receiver',
                                        routes: [],
                                    },
                                ],
                            },
                            templates: [],
                        },
                        template_files: {},
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    it('Keeps matchers for non-grafana alertmanager sources', function () { return __awaiter(void 0, void 0, void 0, function () {
        var defaultConfig, currentConfig, _a, rootRouteContainer;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    defaultConfig = {
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
                    currentConfig = { current: defaultConfig };
                    mocks.api.updateAlertManagerConfig.mockImplementation(function (amSourceName, newConfig) {
                        currentConfig.current = newConfig;
                        return Promise.resolve();
                    });
                    mocks.api.fetchAlertManagerConfig.mockImplementation(function () {
                        return Promise.resolve(currentConfig.current);
                    });
                    return [4 /*yield*/, renderAmRoutes(dataSources.am.name)];
                case 1:
                    _b.sent();
                    _a = expect;
                    return [4 /*yield*/, ui.rootReceiver.find()];
                case 2:
                    _a.apply(void 0, [_b.sent()]).toHaveTextContent('default');
                    expect(mocks.api.fetchAlertManagerConfig).toHaveBeenCalled();
                    return [4 /*yield*/, ui.rootRouteContainer.find()];
                case 3:
                    rootRouteContainer = _b.sent();
                    userEvent.click(ui.editButton.get(rootRouteContainer));
                    userEvent.click(ui.saveButton.get(rootRouteContainer));
                    return [4 /*yield*/, waitFor(function () { return expect(ui.editButton.query(rootRouteContainer)).not.toBeInTheDocument(); })];
                case 4:
                    _b.sent();
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
                                routes: [
                                    {
                                        continue: false,
                                        group_by: [],
                                        matchers: ['hello=world', 'foo!=bar'],
                                        receiver: 'simple-receiver',
                                        routes: [],
                                    },
                                ],
                            },
                            templates: [],
                        },
                        template_files: {},
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    it('Prometheus Alertmanager routes cannot be edited', function () { return __awaiter(void 0, void 0, void 0, function () {
        var rootRouteContainer, rows;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mocks.api.fetchStatus.mockResolvedValue(__assign(__assign({}, someCloudAlertManagerStatus), { config: someCloudAlertManagerConfig.alertmanager_config }));
                    return [4 /*yield*/, renderAmRoutes(dataSources.promAlertManager.name)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, ui.rootRouteContainer.find()];
                case 2:
                    rootRouteContainer = _a.sent();
                    expect(ui.editButton.query(rootRouteContainer)).not.toBeInTheDocument();
                    return [4 /*yield*/, ui.row.findAll()];
                case 3:
                    rows = _a.sent();
                    expect(rows).toHaveLength(2);
                    expect(ui.editRouteButton.query()).not.toBeInTheDocument();
                    expect(ui.deleteRouteButton.query()).not.toBeInTheDocument();
                    expect(ui.saveButton.query()).not.toBeInTheDocument();
                    expect(mocks.api.fetchAlertManagerConfig).not.toHaveBeenCalled();
                    expect(mocks.api.fetchStatus).toHaveBeenCalledTimes(1);
                    return [2 /*return*/];
            }
        });
    }); });
});
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
var updateTiming = function (selectElement, value, timeUnit) { return __awaiter(void 0, void 0, void 0, function () {
    var inputs;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                inputs = byRole('textbox').queryAll(selectElement);
                expect(inputs).toHaveLength(2);
                userEvent.type(inputs[0], value);
                userEvent.click(inputs[1]);
                return [4 /*yield*/, selectOptionInTest(selectElement, timeUnit)];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
//# sourceMappingURL=AmRoutes.test.js.map