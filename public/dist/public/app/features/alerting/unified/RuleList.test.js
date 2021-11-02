import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { configureStore } from 'app/store/configureStore';
import { Provider } from 'react-redux';
import { RuleList } from './RuleList';
import { byLabelText, byRole, byTestId, byText } from 'testing-library-selector';
import { typeAsJestMock } from 'test/helpers/typeAsJestMock';
import { getAllDataSources } from './utils/config';
import { fetchRules } from './api/prometheus';
import { fetchRulerRules, deleteRulerRulesGroup, deleteNamespace, setRulerRuleGroup } from './api/ruler';
import { mockDataSource, mockPromAlert, mockPromAlertingRule, mockPromRecordingRule, mockPromRuleGroup, mockPromRuleNamespace, MockDataSourceSrv, somePromRules, someRulerRules, } from './mocks';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';
import userEvent from '@testing-library/user-event';
import { locationService, setDataSourceSrv } from '@grafana/runtime';
import { Router } from 'react-router-dom';
jest.mock('./api/prometheus');
jest.mock('./api/ruler');
jest.mock('./utils/config');
jest.mock('app/core/core', function () { return ({
    appEvents: {
        subscribe: function () {
            return { unsubscribe: function () { } };
        },
        emit: function () { },
    },
}); });
var mocks = {
    getAllDataSourcesMock: typeAsJestMock(getAllDataSources),
    api: {
        fetchRules: typeAsJestMock(fetchRules),
        fetchRulerRules: typeAsJestMock(fetchRulerRules),
        deleteGroup: typeAsJestMock(deleteRulerRulesGroup),
        deleteNamespace: typeAsJestMock(deleteNamespace),
        setRulerRuleGroup: typeAsJestMock(setRulerRuleGroup),
    },
};
var renderRuleList = function () {
    var store = configureStore();
    locationService.push('/');
    return render(React.createElement(Provider, { store: store },
        React.createElement(Router, { history: locationService.getHistory() },
            React.createElement(RuleList, null))));
};
var dataSources = {
    prom: mockDataSource({
        name: 'Prometheus',
        type: DataSourceType.Prometheus,
    }),
    promdisabled: mockDataSource({
        name: 'Prometheus-disabled',
        type: DataSourceType.Prometheus,
        jsonData: {
            manageAlerts: false,
        },
    }),
    loki: mockDataSource({
        name: 'Loki',
        type: DataSourceType.Loki,
    }),
    promBroken: mockDataSource({
        name: 'Prometheus-broken',
        type: DataSourceType.Prometheus,
    }),
};
var ui = {
    ruleGroup: byTestId('rule-group'),
    cloudRulesSourceErrors: byTestId('cloud-rulessource-errors'),
    groupCollapseToggle: byTestId('group-collapse-toggle'),
    ruleCollapseToggle: byTestId('collapse-toggle'),
    rulesTable: byTestId('rules-table'),
    ruleRow: byTestId('row'),
    expandedContent: byTestId('expanded-content'),
    rulesFilterInput: byTestId('search-query-input'),
    moreErrorsButton: byRole('button', { name: /more errors/ }),
    editCloudGroupIcon: byTestId('edit-group'),
    editGroupModal: {
        namespaceInput: byLabelText('Namespace'),
        ruleGroupInput: byLabelText('Rule group'),
        intervalInput: byLabelText('Rule group evaluation interval'),
        saveButton: byRole('button', { name: /Save changes/ }),
    },
};
describe('RuleList', function () {
    afterEach(function () {
        jest.resetAllMocks();
        setDataSourceSrv(undefined);
    });
    it('load & show rule groups from multiple cloud data sources', function () { return __awaiter(void 0, void 0, void 0, function () {
        var groups, errors;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mocks.getAllDataSourcesMock.mockReturnValue(Object.values(dataSources));
                    setDataSourceSrv(new MockDataSourceSrv(dataSources));
                    mocks.api.fetchRules.mockImplementation(function (dataSourceName) {
                        if (dataSourceName === dataSources.prom.name) {
                            return Promise.resolve([
                                mockPromRuleNamespace({
                                    name: 'default',
                                    dataSourceName: dataSources.prom.name,
                                    groups: [
                                        mockPromRuleGroup({
                                            name: 'group-2',
                                        }),
                                        mockPromRuleGroup({
                                            name: 'group-1',
                                        }),
                                    ],
                                }),
                            ]);
                        }
                        else if (dataSourceName === dataSources.loki.name) {
                            return Promise.resolve([
                                mockPromRuleNamespace({
                                    name: 'default',
                                    dataSourceName: dataSources.loki.name,
                                    groups: [
                                        mockPromRuleGroup({
                                            name: 'group-1',
                                        }),
                                    ],
                                }),
                                mockPromRuleNamespace({
                                    name: 'lokins',
                                    dataSourceName: dataSources.loki.name,
                                    groups: [
                                        mockPromRuleGroup({
                                            name: 'group-1',
                                        }),
                                    ],
                                }),
                            ]);
                        }
                        else if (dataSourceName === dataSources.promBroken.name) {
                            return Promise.reject({ message: 'this datasource is broken' });
                        }
                        else if (dataSourceName === GRAFANA_RULES_SOURCE_NAME) {
                            return Promise.resolve([
                                mockPromRuleNamespace({
                                    name: 'foofolder',
                                    dataSourceName: GRAFANA_RULES_SOURCE_NAME,
                                    groups: [
                                        mockPromRuleGroup({
                                            name: 'grafana-group',
                                            rules: [
                                                mockPromAlertingRule({
                                                    query: '[]',
                                                }),
                                            ],
                                        }),
                                    ],
                                }),
                            ]);
                        }
                        return Promise.reject(new Error("unexpected datasourceName: " + dataSourceName));
                    });
                    return [4 /*yield*/, renderRuleList()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, waitFor(function () { return expect(mocks.api.fetchRules).toHaveBeenCalledTimes(4); })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, ui.ruleGroup.findAll()];
                case 3:
                    groups = _a.sent();
                    expect(groups).toHaveLength(5);
                    expect(groups[0]).toHaveTextContent('foofolder');
                    expect(groups[1]).toHaveTextContent('default > group-1');
                    expect(groups[2]).toHaveTextContent('default > group-1');
                    expect(groups[3]).toHaveTextContent('default > group-2');
                    expect(groups[4]).toHaveTextContent('lokins > group-1');
                    return [4 /*yield*/, ui.cloudRulesSourceErrors.find()];
                case 4:
                    errors = _a.sent();
                    expect(errors).not.toHaveTextContent('Failed to load rules state from Prometheus-broken: this datasource is broken');
                    userEvent.click(ui.moreErrorsButton.get());
                    expect(errors).toHaveTextContent('Failed to load rules state from Prometheus-broken: this datasource is broken');
                    return [2 /*return*/];
            }
        });
    }); });
    it('expand rule group, rule and alert details', function () { return __awaiter(void 0, void 0, void 0, function () {
        var groups, table, ruleRows, ruleDetails, instancesTable, instanceRows, alertDetails;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mocks.getAllDataSourcesMock.mockReturnValue([dataSources.prom]);
                    setDataSourceSrv(new MockDataSourceSrv({ prom: dataSources.prom }));
                    mocks.api.fetchRules.mockImplementation(function (dataSourceName) {
                        if (dataSourceName === GRAFANA_RULES_SOURCE_NAME) {
                            return Promise.resolve([]);
                        }
                        else {
                            return Promise.resolve([
                                mockPromRuleNamespace({
                                    groups: [
                                        mockPromRuleGroup({
                                            name: 'group-1',
                                        }),
                                        mockPromRuleGroup({
                                            name: 'group-2',
                                            rules: [
                                                mockPromRecordingRule({
                                                    name: 'recordingrule',
                                                }),
                                                mockPromAlertingRule({
                                                    name: 'alertingrule',
                                                    labels: {
                                                        severity: 'warning',
                                                        foo: 'bar',
                                                    },
                                                    query: 'topk(5, foo)[5m]',
                                                    annotations: {
                                                        message: 'great alert',
                                                    },
                                                    alerts: [
                                                        mockPromAlert({
                                                            labels: {
                                                                foo: 'bar',
                                                                severity: 'warning',
                                                            },
                                                            value: '2e+10',
                                                            annotations: {
                                                                message: 'first alert message',
                                                            },
                                                        }),
                                                        mockPromAlert({
                                                            labels: {
                                                                foo: 'baz',
                                                                severity: 'error',
                                                            },
                                                            value: '3e+11',
                                                            annotations: {
                                                                message: 'first alert message',
                                                            },
                                                        }),
                                                    ],
                                                }),
                                                mockPromAlertingRule({
                                                    name: 'p-rule',
                                                    alerts: [],
                                                    state: PromAlertingRuleState.Pending,
                                                }),
                                                mockPromAlertingRule({
                                                    name: 'i-rule',
                                                    alerts: [],
                                                    state: PromAlertingRuleState.Inactive,
                                                }),
                                            ],
                                        }),
                                    ],
                                }),
                            ]);
                        }
                    });
                    return [4 /*yield*/, renderRuleList()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, ui.ruleGroup.findAll()];
                case 2:
                    groups = _a.sent();
                    expect(groups).toHaveLength(2);
                    expect(groups[0]).toHaveTextContent('1 rule');
                    expect(groups[1]).toHaveTextContent('4 rules: 1 firing, 1 pending');
                    // expand second group to see rules table
                    expect(ui.rulesTable.query()).not.toBeInTheDocument();
                    userEvent.click(ui.groupCollapseToggle.get(groups[1]));
                    return [4 /*yield*/, ui.rulesTable.find(groups[1])];
                case 3:
                    table = _a.sent();
                    ruleRows = ui.ruleRow.getAll(table);
                    expect(ruleRows).toHaveLength(4);
                    expect(ruleRows[0]).toHaveTextContent('Recording rule');
                    expect(ruleRows[0]).toHaveTextContent('recordingrule');
                    expect(ruleRows[1]).toHaveTextContent('Firing');
                    expect(ruleRows[1]).toHaveTextContent('alertingrule');
                    expect(ruleRows[2]).toHaveTextContent('Pending');
                    expect(ruleRows[2]).toHaveTextContent('p-rule');
                    expect(ruleRows[3]).toHaveTextContent('Normal');
                    expect(ruleRows[3]).toHaveTextContent('i-rule');
                    expect(byText('Labels').query()).not.toBeInTheDocument();
                    // expand alert details
                    userEvent.click(ui.ruleCollapseToggle.get(ruleRows[1]));
                    ruleDetails = ui.expandedContent.get(ruleRows[1]);
                    expect(ruleDetails).toHaveTextContent('Labelsseverity=warningfoo=bar');
                    expect(ruleDetails).toHaveTextContent('Expressiontopk ( 5 , foo ) [ 5m ]');
                    expect(ruleDetails).toHaveTextContent('messagegreat alert');
                    expect(ruleDetails).toHaveTextContent('Matching instances');
                    instancesTable = byTestId('dynamic-table').get(ruleDetails);
                    expect(instancesTable).toBeInTheDocument();
                    instanceRows = byTestId('row').getAll(instancesTable);
                    expect(instanceRows).toHaveLength(2);
                    expect(instanceRows[0]).toHaveTextContent('Firingfoo=barseverity=warning2021-03-18 13:47:05');
                    expect(instanceRows[1]).toHaveTextContent('Firingfoo=bazseverity=error2021-03-18 13:47:05');
                    // expand details of an instance
                    userEvent.click(ui.ruleCollapseToggle.get(instanceRows[0]));
                    alertDetails = byTestId('expanded-content').get(instanceRows[0]);
                    expect(alertDetails).toHaveTextContent('Value2e+10');
                    expect(alertDetails).toHaveTextContent('messagefirst alert message');
                    // collapse everything again
                    userEvent.click(ui.ruleCollapseToggle.get(instanceRows[0]));
                    expect(byTestId('expanded-content').query(instanceRows[0])).not.toBeInTheDocument();
                    userEvent.click(ui.ruleCollapseToggle.getAll(ruleRows[1])[0]);
                    userEvent.click(ui.groupCollapseToggle.get(groups[1]));
                    expect(ui.rulesTable.query()).not.toBeInTheDocument();
                    return [2 /*return*/];
            }
        });
    }); });
    it('filters rules and alerts by labels', function () { return __awaiter(void 0, void 0, void 0, function () {
        var groups, filterInput, ruleRows, ruleDetails;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mocks.getAllDataSourcesMock.mockReturnValue([dataSources.prom]);
                    setDataSourceSrv(new MockDataSourceSrv({ prom: dataSources.prom }));
                    mocks.api.fetchRulerRules.mockResolvedValue({});
                    mocks.api.fetchRules.mockImplementation(function (dataSourceName) {
                        if (dataSourceName === GRAFANA_RULES_SOURCE_NAME) {
                            return Promise.resolve([]);
                        }
                        else {
                            return Promise.resolve([
                                mockPromRuleNamespace({
                                    groups: [
                                        mockPromRuleGroup({
                                            name: 'group-1',
                                            rules: [
                                                mockPromAlertingRule({
                                                    name: 'alertingrule',
                                                    labels: {
                                                        severity: 'warning',
                                                        foo: 'bar',
                                                    },
                                                    query: 'topk(5, foo)[5m]',
                                                    annotations: {
                                                        message: 'great alert',
                                                    },
                                                    alerts: [
                                                        mockPromAlert({
                                                            labels: {
                                                                foo: 'bar',
                                                                severity: 'warning',
                                                            },
                                                            value: '2e+10',
                                                            annotations: {
                                                                message: 'first alert message',
                                                            },
                                                        }),
                                                        mockPromAlert({
                                                            labels: {
                                                                foo: 'baz',
                                                                severity: 'error',
                                                            },
                                                            value: '3e+11',
                                                            annotations: {
                                                                message: 'first alert message',
                                                            },
                                                        }),
                                                    ],
                                                }),
                                            ],
                                        }),
                                        mockPromRuleGroup({
                                            name: 'group-2',
                                            rules: [
                                                mockPromAlertingRule({
                                                    name: 'alertingrule2',
                                                    labels: {
                                                        severity: 'error',
                                                        foo: 'buzz',
                                                    },
                                                    query: 'topk(5, foo)[5m]',
                                                    annotations: {
                                                        message: 'great alert',
                                                    },
                                                    alerts: [
                                                        mockPromAlert({
                                                            labels: {
                                                                foo: 'buzz',
                                                                severity: 'error',
                                                                region: 'EU',
                                                            },
                                                            value: '2e+10',
                                                            annotations: {
                                                                message: 'alert message',
                                                            },
                                                        }),
                                                        mockPromAlert({
                                                            labels: {
                                                                foo: 'buzz',
                                                                severity: 'error',
                                                                region: 'US',
                                                            },
                                                            value: '3e+11',
                                                            annotations: {
                                                                message: 'alert message',
                                                            },
                                                        }),
                                                    ],
                                                }),
                                            ],
                                        }),
                                    ],
                                }),
                            ]);
                        }
                    });
                    return [4 /*yield*/, renderRuleList()];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, ui.ruleGroup.findAll()];
                case 2:
                    groups = _a.sent();
                    expect(groups).toHaveLength(2);
                    filterInput = ui.rulesFilterInput.get();
                    userEvent.type(filterInput, '{{foo="bar"}');
                    // Input is debounced so wait for it to be visible
                    return [4 /*yield*/, waitFor(function () { return expect(filterInput).toHaveValue('{foo="bar"}'); })];
                case 3:
                    // Input is debounced so wait for it to be visible
                    _a.sent();
                    // Group doesn't contain matching labels
                    return [4 /*yield*/, waitFor(function () { return expect(ui.ruleGroup.queryAll()).toHaveLength(1); })];
                case 4:
                    // Group doesn't contain matching labels
                    _a.sent();
                    userEvent.click(ui.groupCollapseToggle.get(groups[0]));
                    ruleRows = ui.ruleRow.getAll(groups[0]);
                    expect(ruleRows).toHaveLength(1);
                    userEvent.click(ui.ruleCollapseToggle.get(ruleRows[0]));
                    ruleDetails = ui.expandedContent.get(ruleRows[0]);
                    expect(ruleDetails).toHaveTextContent('Labelsseverity=warningfoo=bar');
                    // Check for different label matchers
                    userEvent.type(filterInput, '{selectall}{del}{{foo!="bar",foo!="baz"}');
                    // Group doesn't contain matching labels
                    return [4 /*yield*/, waitFor(function () { return expect(ui.ruleGroup.queryAll()).toHaveLength(1); })];
                case 5:
                    // Group doesn't contain matching labels
                    _a.sent();
                    return [4 /*yield*/, waitFor(function () { return expect(ui.ruleGroup.get()).toHaveTextContent('group-2'); })];
                case 6:
                    _a.sent();
                    userEvent.type(filterInput, '{selectall}{del}{{foo=~"b.+"}');
                    return [4 /*yield*/, waitFor(function () { return expect(ui.ruleGroup.queryAll()).toHaveLength(2); })];
                case 7:
                    _a.sent();
                    userEvent.type(filterInput, '{selectall}{del}{{region="US"}');
                    return [4 /*yield*/, waitFor(function () { return expect(ui.ruleGroup.queryAll()).toHaveLength(1); })];
                case 8:
                    _a.sent();
                    return [4 /*yield*/, waitFor(function () { return expect(ui.ruleGroup.get()).toHaveTextContent('group-2'); })];
                case 9:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    describe('edit lotex groups, namespaces', function () {
        var testDatasources = {
            prom: dataSources.prom,
        };
        function testCase(name, fn) {
            var _this = this;
            it(name, function () { return __awaiter(_this, void 0, void 0, function () {
                var _a, groups;
                return __generator(this, function (_b) {
                    switch (_b.label) {
                        case 0:
                            mocks.getAllDataSourcesMock.mockReturnValue(Object.values(testDatasources));
                            setDataSourceSrv(new MockDataSourceSrv(testDatasources));
                            mocks.api.fetchRules.mockImplementation(function (sourceName) {
                                return Promise.resolve(sourceName === testDatasources.prom.name ? somePromRules() : []);
                            });
                            mocks.api.fetchRulerRules.mockImplementation(function (sourceName) {
                                return Promise.resolve(sourceName === testDatasources.prom.name ? someRulerRules : {});
                            });
                            mocks.api.setRulerRuleGroup.mockResolvedValue();
                            mocks.api.deleteNamespace.mockResolvedValue();
                            return [4 /*yield*/, renderRuleList()];
                        case 1:
                            _b.sent();
                            _a = expect;
                            return [4 /*yield*/, ui.rulesFilterInput.find()];
                        case 2:
                            _a.apply(void 0, [_b.sent()]).toHaveValue('');
                            return [4 /*yield*/, ui.ruleGroup.findAll()];
                        case 3:
                            groups = _b.sent();
                            expect(groups).toHaveLength(3);
                            // open edit dialog
                            userEvent.click(ui.editCloudGroupIcon.get(groups[0]));
                            expect(ui.editGroupModal.namespaceInput.get()).toHaveValue('namespace1');
                            expect(ui.editGroupModal.ruleGroupInput.get()).toHaveValue('group1');
                            return [4 /*yield*/, fn()];
                        case 4:
                            _b.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
        }
        testCase('rename both lotex namespace and group', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // make changes to form
                        userEvent.clear(ui.editGroupModal.namespaceInput.get());
                        userEvent.type(ui.editGroupModal.namespaceInput.get(), 'super namespace');
                        userEvent.clear(ui.editGroupModal.ruleGroupInput.get());
                        userEvent.type(ui.editGroupModal.ruleGroupInput.get(), 'super group');
                        userEvent.type(ui.editGroupModal.intervalInput.get(), '5m');
                        // submit, check that appropriate calls were made
                        userEvent.click(ui.editGroupModal.saveButton.get());
                        return [4 /*yield*/, waitFor(function () { return expect(ui.editGroupModal.namespaceInput.query()).not.toBeInTheDocument(); })];
                    case 1:
                        _a.sent();
                        expect(mocks.api.setRulerRuleGroup).toHaveBeenCalledTimes(2);
                        expect(mocks.api.deleteNamespace).toHaveBeenCalledTimes(1);
                        expect(mocks.api.deleteGroup).not.toHaveBeenCalled();
                        expect(mocks.api.fetchRulerRules).toHaveBeenCalledTimes(4);
                        expect(mocks.api.setRulerRuleGroup).toHaveBeenNthCalledWith(1, testDatasources.prom.name, 'super namespace', __assign(__assign({}, someRulerRules['namespace1'][0]), { name: 'super group', interval: '5m' }));
                        expect(mocks.api.setRulerRuleGroup).toHaveBeenNthCalledWith(2, testDatasources.prom.name, 'super namespace', someRulerRules['namespace1'][1]);
                        expect(mocks.api.deleteNamespace).toHaveBeenLastCalledWith('Prometheus', 'namespace1');
                        return [2 /*return*/];
                }
            });
        }); });
        testCase('rename just the lotex group', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // make changes to form
                        userEvent.clear(ui.editGroupModal.ruleGroupInput.get());
                        userEvent.type(ui.editGroupModal.ruleGroupInput.get(), 'super group');
                        userEvent.type(ui.editGroupModal.intervalInput.get(), '5m');
                        // submit, check that appropriate calls were made
                        userEvent.click(ui.editGroupModal.saveButton.get());
                        return [4 /*yield*/, waitFor(function () { return expect(ui.editGroupModal.namespaceInput.query()).not.toBeInTheDocument(); })];
                    case 1:
                        _a.sent();
                        expect(mocks.api.setRulerRuleGroup).toHaveBeenCalledTimes(1);
                        expect(mocks.api.deleteGroup).toHaveBeenCalledTimes(1);
                        expect(mocks.api.deleteNamespace).not.toHaveBeenCalled();
                        expect(mocks.api.fetchRulerRules).toHaveBeenCalledTimes(4);
                        expect(mocks.api.setRulerRuleGroup).toHaveBeenNthCalledWith(1, testDatasources.prom.name, 'namespace1', __assign(__assign({}, someRulerRules['namespace1'][0]), { name: 'super group', interval: '5m' }));
                        expect(mocks.api.deleteGroup).toHaveBeenLastCalledWith('Prometheus', 'namespace1', 'group1');
                        return [2 /*return*/];
                }
            });
        }); });
        testCase('edit lotex group eval interval, no renaming', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // make changes to form
                        userEvent.type(ui.editGroupModal.intervalInput.get(), '5m');
                        // submit, check that appropriate calls were made
                        userEvent.click(ui.editGroupModal.saveButton.get());
                        return [4 /*yield*/, waitFor(function () { return expect(ui.editGroupModal.namespaceInput.query()).not.toBeInTheDocument(); })];
                    case 1:
                        _a.sent();
                        expect(mocks.api.setRulerRuleGroup).toHaveBeenCalledTimes(1);
                        expect(mocks.api.deleteGroup).not.toHaveBeenCalled();
                        expect(mocks.api.deleteNamespace).not.toHaveBeenCalled();
                        expect(mocks.api.fetchRulerRules).toHaveBeenCalledTimes(4);
                        expect(mocks.api.setRulerRuleGroup).toHaveBeenNthCalledWith(1, testDatasources.prom.name, 'namespace1', __assign(__assign({}, someRulerRules['namespace1'][0]), { interval: '5m' }));
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=RuleList.test.js.map