import { __assign, __awaiter, __generator } from "tslib";
import { render, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { locationService, setBackendSrv, setDataSourceSrv } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';
import RuleEditor from './RuleEditor';
import { Route, Router } from 'react-router-dom';
import React from 'react';
import { byLabelText, byRole, byTestId, byText } from 'testing-library-selector';
import { selectOptionInTest } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { mockDataSource, MockDataSourceSrv } from './mocks';
import userEvent from '@testing-library/user-event';
import { typeAsJestMock } from 'test/helpers/typeAsJestMock';
import { getAllDataSources } from './utils/config';
import { fetchRulerRules, fetchRulerRulesGroup, fetchRulerRulesNamespace, setRulerRuleGroup } from './api/ruler';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';
import { getDefaultQueries } from './utils/rule-form';
import * as api from 'app/features/manage-dashboards/state/actions';
import { GrafanaAlertStateDecision } from 'app/types/unified-alerting-dto';
jest.mock('./components/rule-editor/ExpressionEditor', function () { return ({
    // eslint-disable-next-line react/display-name
    ExpressionEditor: function (_a) {
        var value = _a.value, onChange = _a.onChange;
        return (React.createElement("input", { value: value, "data-testid": "expr", onChange: function (e) { return onChange(e.target.value); } }));
    },
}); });
jest.mock('./api/ruler');
jest.mock('./utils/config');
// there's no angular scope in test and things go terribly wrong when trying to render the query editor row.
// lets just skip it
jest.mock('app/features/query/components/QueryEditorRow', function () { return ({
    // eslint-disable-next-line react/display-name
    QueryEditorRow: function () { return React.createElement("p", null, "hi"); },
}); });
var mocks = {
    getAllDataSources: typeAsJestMock(getAllDataSources),
    api: {
        fetchRulerRulesGroup: typeAsJestMock(fetchRulerRulesGroup),
        setRulerRuleGroup: typeAsJestMock(setRulerRuleGroup),
        fetchRulerRulesNamespace: typeAsJestMock(fetchRulerRulesNamespace),
        fetchRulerRules: typeAsJestMock(fetchRulerRules),
    },
};
function renderRuleEditor(identifier) {
    var store = configureStore();
    locationService.push(identifier ? "/alerting/" + identifier + "/edit" : "/alerting/new");
    return render(React.createElement(Provider, { store: store },
        React.createElement(Router, { history: locationService.getHistory() },
            React.createElement(Route, { path: ['/alerting/new', '/alerting/:id/edit'], component: RuleEditor }))));
}
var ui = {
    inputs: {
        name: byLabelText('Rule name'),
        alertType: byTestId('alert-type-picker'),
        dataSource: byTestId('datasource-picker'),
        folder: byTestId('folder-picker'),
        namespace: byTestId('namespace-picker'),
        group: byTestId('group-picker'),
        annotationKey: function (idx) { return byTestId("annotation-key-" + idx); },
        annotationValue: function (idx) { return byTestId("annotation-value-" + idx); },
        labelKey: function (idx) { return byTestId("label-key-" + idx); },
        labelValue: function (idx) { return byTestId("label-value-" + idx); },
        expr: byTestId('expr'),
    },
    buttons: {
        save: byRole('button', { name: 'Save' }),
        addAnnotation: byRole('button', { name: /Add info/ }),
        addLabel: byRole('button', { name: /Add label/ }),
    },
};
describe('RuleEditor', function () {
    beforeEach(function () {
        jest.resetAllMocks();
        contextSrv.isEditor = true;
    });
    it('can create a new cloud alert', function () { return __awaiter(void 0, void 0, void 0, function () {
        var dataSources, _a, _b, dataSourceSelect;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    dataSources = {
                        default: mockDataSource({
                            type: 'prometheus',
                            name: 'Prom',
                            isDefault: true,
                        }, { alerting: true }),
                    };
                    setDataSourceSrv(new MockDataSourceSrv(dataSources));
                    mocks.getAllDataSources.mockReturnValue(Object.values(dataSources));
                    mocks.api.setRulerRuleGroup.mockResolvedValue();
                    mocks.api.fetchRulerRulesNamespace.mockResolvedValue([]);
                    mocks.api.fetchRulerRulesGroup.mockResolvedValue({
                        name: 'group2',
                        rules: [],
                    });
                    mocks.api.fetchRulerRules.mockResolvedValue({
                        namespace1: [
                            {
                                name: 'group1',
                                rules: [],
                            },
                        ],
                        namespace2: [
                            {
                                name: 'group2',
                                rules: [],
                            },
                        ],
                    });
                    return [4 /*yield*/, renderRuleEditor()];
                case 1:
                    _c.sent();
                    _b = (_a = userEvent).type;
                    return [4 /*yield*/, ui.inputs.name.find()];
                case 2:
                    _b.apply(_a, [_c.sent(), 'my great new rule']);
                    return [4 /*yield*/, clickSelectOption(ui.inputs.alertType.get(), /Cortex\/Loki managed alert/)];
                case 3:
                    _c.sent();
                    dataSourceSelect = ui.inputs.dataSource.get();
                    userEvent.click(byRole('textbox').get(dataSourceSelect));
                    return [4 /*yield*/, clickSelectOption(dataSourceSelect, 'Prom (default)')];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, waitFor(function () { return expect(mocks.api.fetchRulerRules).toHaveBeenCalled(); })];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, clickSelectOption(ui.inputs.namespace.get(), 'namespace2')];
                case 6:
                    _c.sent();
                    return [4 /*yield*/, clickSelectOption(ui.inputs.group.get(), 'group2')];
                case 7:
                    _c.sent();
                    userEvent.type(ui.inputs.expr.get(), 'up == 1');
                    userEvent.type(ui.inputs.annotationValue(0).get(), 'some summary');
                    userEvent.type(ui.inputs.annotationValue(1).get(), 'some description');
                    // TODO remove skipPointerEventsCheck once https://github.com/jsdom/jsdom/issues/3232 is fixed
                    userEvent.click(ui.buttons.addLabel.get(), undefined, { skipPointerEventsCheck: true });
                    userEvent.type(ui.inputs.labelKey(0).get(), 'severity');
                    userEvent.type(ui.inputs.labelValue(0).get(), 'warn');
                    userEvent.type(ui.inputs.labelKey(1).get(), 'team');
                    userEvent.type(ui.inputs.labelValue(1).get(), 'the a-team');
                    // save and check what was sent to backend
                    userEvent.click(ui.buttons.save.get());
                    return [4 /*yield*/, waitFor(function () { return expect(mocks.api.setRulerRuleGroup).toHaveBeenCalled(); })];
                case 8:
                    _c.sent();
                    expect(mocks.api.setRulerRuleGroup).toHaveBeenCalledWith('Prom', 'namespace2', {
                        name: 'group2',
                        rules: [
                            {
                                alert: 'my great new rule',
                                annotations: { description: 'some description', summary: 'some summary' },
                                labels: { severity: 'warn', team: 'the a-team' },
                                expr: 'up == 1',
                                for: '1m',
                            },
                        ],
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    it('can create new grafana managed alert', function () { return __awaiter(void 0, void 0, void 0, function () {
        var searchFolderMock, dataSources, _a, _b, folderInput;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    searchFolderMock = jest.spyOn(api, 'searchFolders').mockResolvedValue([
                        {
                            title: 'Folder A',
                            id: 1,
                        },
                        {
                            title: 'Folder B',
                            id: 2,
                        },
                    ]);
                    dataSources = {
                        default: mockDataSource({
                            type: 'prometheus',
                            name: 'Prom',
                            isDefault: true,
                        }),
                    };
                    setDataSourceSrv(new MockDataSourceSrv(dataSources));
                    mocks.api.setRulerRuleGroup.mockResolvedValue();
                    mocks.api.fetchRulerRulesNamespace.mockResolvedValue([]);
                    // fill out the form
                    return [4 /*yield*/, renderRuleEditor()];
                case 1:
                    // fill out the form
                    _c.sent();
                    _b = (_a = userEvent).type;
                    return [4 /*yield*/, ui.inputs.name.find()];
                case 2:
                    _b.apply(_a, [_c.sent(), 'my great new rule']);
                    return [4 /*yield*/, clickSelectOption(ui.inputs.alertType.get(), /Classic Grafana alerts based on thresholds/)];
                case 3:
                    _c.sent();
                    return [4 /*yield*/, ui.inputs.folder.find()];
                case 4:
                    folderInput = _c.sent();
                    return [4 /*yield*/, waitFor(function () { return expect(searchFolderMock).toHaveBeenCalled(); })];
                case 5:
                    _c.sent();
                    return [4 /*yield*/, clickSelectOption(folderInput, 'Folder A')];
                case 6:
                    _c.sent();
                    userEvent.type(ui.inputs.annotationValue(0).get(), 'some summary');
                    userEvent.type(ui.inputs.annotationValue(1).get(), 'some description');
                    // TODO remove skipPointerEventsCheck once https://github.com/jsdom/jsdom/issues/3232 is fixed
                    userEvent.click(ui.buttons.addLabel.get(), undefined, { skipPointerEventsCheck: true });
                    userEvent.type(ui.inputs.labelKey(0).get(), 'severity');
                    userEvent.type(ui.inputs.labelValue(0).get(), 'warn');
                    userEvent.type(ui.inputs.labelKey(1).get(), 'team');
                    userEvent.type(ui.inputs.labelValue(1).get(), 'the a-team');
                    // save and check what was sent to backend
                    userEvent.click(ui.buttons.save.get());
                    return [4 /*yield*/, waitFor(function () { return expect(mocks.api.setRulerRuleGroup).toHaveBeenCalled(); })];
                case 7:
                    _c.sent();
                    expect(mocks.api.setRulerRuleGroup).toHaveBeenCalledWith(GRAFANA_RULES_SOURCE_NAME, 'Folder A', {
                        interval: '1m',
                        name: 'my great new rule',
                        rules: [
                            {
                                annotations: { description: 'some description', summary: 'some summary' },
                                labels: { severity: 'warn', team: 'the a-team' },
                                for: '5m',
                                grafana_alert: {
                                    condition: 'B',
                                    data: getDefaultQueries(),
                                    exec_err_state: 'Alerting',
                                    no_data_state: 'NoData',
                                    title: 'my great new rule',
                                },
                            },
                        ],
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    it('can create a new cloud recording rule', function () { return __awaiter(void 0, void 0, void 0, function () {
        var dataSources, _a, _b, dataSourceSelect, _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    dataSources = {
                        default: mockDataSource({
                            type: 'prometheus',
                            name: 'Prom',
                            isDefault: true,
                        }, { alerting: true }),
                    };
                    setDataSourceSrv(new MockDataSourceSrv(dataSources));
                    mocks.getAllDataSources.mockReturnValue(Object.values(dataSources));
                    mocks.api.setRulerRuleGroup.mockResolvedValue();
                    mocks.api.fetchRulerRulesNamespace.mockResolvedValue([]);
                    mocks.api.fetchRulerRulesGroup.mockResolvedValue({
                        name: 'group2',
                        rules: [],
                    });
                    mocks.api.fetchRulerRules.mockResolvedValue({
                        namespace1: [
                            {
                                name: 'group1',
                                rules: [],
                            },
                        ],
                        namespace2: [
                            {
                                name: 'group2',
                                rules: [],
                            },
                        ],
                    });
                    return [4 /*yield*/, renderRuleEditor()];
                case 1:
                    _e.sent();
                    _b = (_a = userEvent).type;
                    return [4 /*yield*/, ui.inputs.name.find()];
                case 2:
                    _b.apply(_a, [_e.sent(), 'my great new recording rule']);
                    return [4 /*yield*/, clickSelectOption(ui.inputs.alertType.get(), /Cortex\/Loki managed recording rule/)];
                case 3:
                    _e.sent();
                    dataSourceSelect = ui.inputs.dataSource.get();
                    userEvent.click(byRole('textbox').get(dataSourceSelect));
                    return [4 /*yield*/, clickSelectOption(dataSourceSelect, 'Prom (default)')];
                case 4:
                    _e.sent();
                    return [4 /*yield*/, waitFor(function () { return expect(mocks.api.fetchRulerRules).toHaveBeenCalled(); })];
                case 5:
                    _e.sent();
                    return [4 /*yield*/, clickSelectOption(ui.inputs.namespace.get(), 'namespace2')];
                case 6:
                    _e.sent();
                    return [4 /*yield*/, clickSelectOption(ui.inputs.group.get(), 'group2')];
                case 7:
                    _e.sent();
                    userEvent.type(ui.inputs.expr.get(), 'up == 1');
                    // TODO remove skipPointerEventsCheck once https://github.com/jsdom/jsdom/issues/3232 is fixed
                    userEvent.click(ui.buttons.addLabel.get(), undefined, { skipPointerEventsCheck: true });
                    userEvent.type(ui.inputs.labelKey(1).get(), 'team');
                    userEvent.type(ui.inputs.labelValue(1).get(), 'the a-team');
                    // try to save, find out that recording rule name is invalid
                    userEvent.click(ui.buttons.save.get());
                    return [4 /*yield*/, waitFor(function () {
                            return expect(byText('Recording rule name must be valid metric name. It may only contain letters, numbers, and colons. It may not contain whitespace.').get()).toBeInTheDocument();
                        })];
                case 8:
                    _e.sent();
                    expect(mocks.api.setRulerRuleGroup).not.toBeCalled();
                    // fix name and re-submit
                    _d = (_c = userEvent).type;
                    return [4 /*yield*/, ui.inputs.name.find()];
                case 9:
                    // fix name and re-submit
                    _d.apply(_c, [_e.sent(), '{selectall}{del}my:great:new:recording:rule']);
                    userEvent.click(ui.buttons.save.get());
                    // save and check what was sent to backend
                    userEvent.click(ui.buttons.save.get());
                    return [4 /*yield*/, waitFor(function () { return expect(mocks.api.setRulerRuleGroup).toHaveBeenCalled(); })];
                case 10:
                    _e.sent();
                    expect(mocks.api.setRulerRuleGroup).toHaveBeenCalledWith('Prom', 'namespace2', {
                        name: 'group2',
                        rules: [
                            {
                                record: 'my:great:new:recording:rule',
                                labels: { team: 'the a-team' },
                                expr: 'up == 1',
                            },
                        ],
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    it('can edit grafana managed rule', function () { return __awaiter(void 0, void 0, void 0, function () {
        var uid, folder, searchFolderMock, getFolderByUid, dataSources, backendSrv, nameInput;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    uid = 'FOOBAR123';
                    folder = {
                        title: 'Folder A',
                        uid: 'abcd',
                        id: 1,
                    };
                    searchFolderMock = jest.spyOn(api, 'searchFolders').mockResolvedValue([folder]);
                    getFolderByUid = jest.fn().mockResolvedValue(__assign(__assign({}, folder), { canSave: true }));
                    dataSources = {
                        default: mockDataSource({
                            type: 'prometheus',
                            name: 'Prom',
                            isDefault: true,
                        }),
                    };
                    backendSrv = {
                        getFolderByUid: getFolderByUid,
                    };
                    setBackendSrv(backendSrv);
                    setDataSourceSrv(new MockDataSourceSrv(dataSources));
                    mocks.api.setRulerRuleGroup.mockResolvedValue();
                    mocks.api.fetchRulerRulesNamespace.mockResolvedValue([]);
                    mocks.api.fetchRulerRules.mockResolvedValue((_a = {},
                        _a[folder.title] = [
                            {
                                interval: '1m',
                                name: 'my great new rule',
                                rules: [
                                    {
                                        annotations: { description: 'some description', summary: 'some summary' },
                                        labels: { severity: 'warn', team: 'the a-team' },
                                        for: '5m',
                                        grafana_alert: {
                                            uid: uid,
                                            namespace_uid: 'abcd',
                                            namespace_id: 1,
                                            condition: 'B',
                                            data: getDefaultQueries(),
                                            exec_err_state: GrafanaAlertStateDecision.Alerting,
                                            no_data_state: GrafanaAlertStateDecision.NoData,
                                            title: 'my great new rule',
                                        },
                                    },
                                ],
                            },
                        ],
                        _a));
                    return [4 /*yield*/, renderRuleEditor(uid)];
                case 1:
                    _b.sent();
                    return [4 /*yield*/, waitFor(function () { return expect(searchFolderMock).toHaveBeenCalled(); })];
                case 2:
                    _b.sent();
                    return [4 /*yield*/, ui.inputs.name.find()];
                case 3:
                    nameInput = _b.sent();
                    expect(nameInput).toHaveValue('my great new rule');
                    expect(ui.inputs.folder.get()).toHaveTextContent(new RegExp(folder.title));
                    expect(ui.inputs.annotationValue(0).get()).toHaveValue('some description');
                    expect(ui.inputs.annotationValue(1).get()).toHaveValue('some summary');
                    // add an annotation
                    return [4 /*yield*/, clickSelectOption(ui.inputs.annotationKey(2).get(), /Add new/)];
                case 4:
                    // add an annotation
                    _b.sent();
                    userEvent.type(byRole('textbox').get(ui.inputs.annotationKey(2).get()), 'custom');
                    userEvent.type(ui.inputs.annotationValue(2).get(), 'value');
                    //add a label
                    userEvent.type(ui.inputs.labelKey(2).get(), 'custom');
                    userEvent.type(ui.inputs.labelValue(2).get(), 'value');
                    // save and check what was sent to backend
                    userEvent.click(ui.buttons.save.get());
                    return [4 /*yield*/, waitFor(function () { return expect(mocks.api.setRulerRuleGroup).toHaveBeenCalled(); })];
                case 5:
                    _b.sent();
                    expect(mocks.api.setRulerRuleGroup).toHaveBeenCalledWith(GRAFANA_RULES_SOURCE_NAME, 'Folder A', {
                        interval: '1m',
                        name: 'my great new rule',
                        rules: [
                            {
                                annotations: { description: 'some description', summary: 'some summary', custom: 'value' },
                                labels: { severity: 'warn', team: 'the a-team', custom: 'value' },
                                for: '5m',
                                grafana_alert: {
                                    uid: uid,
                                    condition: 'B',
                                    data: getDefaultQueries(),
                                    exec_err_state: 'Alerting',
                                    no_data_state: 'NoData',
                                    title: 'my great new rule',
                                },
                            },
                        ],
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    it('for cloud alerts, should only allow to select editable rules sources', function () { return __awaiter(void 0, void 0, void 0, function () {
        var dataSources, dataSourceSelect, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    dataSources = {
                        // can edit rules
                        loki: mockDataSource({
                            type: DataSourceType.Loki,
                            name: 'loki with ruler',
                        }, { alerting: true }),
                        loki_disabled: mockDataSource({
                            type: DataSourceType.Loki,
                            name: 'loki disabled for alerting',
                            jsonData: {
                                manageAlerts: false,
                            },
                        }, { alerting: true }),
                        // can edit rules
                        prom: mockDataSource({
                            type: DataSourceType.Prometheus,
                            name: 'cortex with ruler',
                        }, { alerting: true }),
                        // cannot edit rules
                        loki_local_rule_store: mockDataSource({
                            type: DataSourceType.Loki,
                            name: 'loki with local rule store',
                        }, { alerting: true }),
                        // cannot edit rules
                        prom_no_ruler_api: mockDataSource({
                            type: DataSourceType.Loki,
                            name: 'cortex without ruler api',
                        }, { alerting: true }),
                        // not a supported datasource type
                        splunk: mockDataSource({
                            type: 'splunk',
                            name: 'splunk',
                        }, { alerting: true }),
                    };
                    mocks.api.fetchRulerRulesGroup.mockImplementation(function (dataSourceName) { return __awaiter(void 0, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            if (dataSourceName === 'loki with ruler' || dataSourceName === 'cortex with ruler') {
                                return [2 /*return*/, null];
                            }
                            if (dataSourceName === 'loki with local rule store') {
                                throw {
                                    status: 400,
                                    data: {
                                        message: 'GetRuleGroup unsupported in rule local store',
                                    },
                                };
                            }
                            if (dataSourceName === 'cortex without ruler api') {
                                throw new Error('404 from rules config endpoint. Perhaps ruler API is not enabled?');
                            }
                            return [2 /*return*/, null];
                        });
                    }); });
                    setDataSourceSrv(new MockDataSourceSrv(dataSources));
                    mocks.getAllDataSources.mockReturnValue(Object.values(dataSources));
                    // render rule editor, select cortex/loki managed alerts
                    return [4 /*yield*/, renderRuleEditor()];
                case 1:
                    // render rule editor, select cortex/loki managed alerts
                    _b.sent();
                    return [4 /*yield*/, ui.inputs.name.find()];
                case 2:
                    _b.sent();
                    return [4 /*yield*/, clickSelectOption(ui.inputs.alertType.get(), /Cortex\/Loki managed alert/)];
                case 3:
                    _b.sent();
                    // wait for ui theck each datasource if it supports rule editing
                    return [4 /*yield*/, waitFor(function () { return expect(mocks.api.fetchRulerRulesGroup).toHaveBeenCalledTimes(4); })];
                case 4:
                    // wait for ui theck each datasource if it supports rule editing
                    _b.sent();
                    dataSourceSelect = ui.inputs.dataSource.get();
                    userEvent.click(byRole('textbox').get(dataSourceSelect));
                    _a = expect;
                    return [4 /*yield*/, byText('loki with ruler').query()];
                case 5:
                    _a.apply(void 0, [_b.sent()]).toBeInTheDocument();
                    expect(byText('cortex with ruler').query()).toBeInTheDocument();
                    expect(byText('loki with local rule store').query()).not.toBeInTheDocument();
                    expect(byText('prom without ruler api').query()).not.toBeInTheDocument();
                    expect(byText('splunk').query()).not.toBeInTheDocument();
                    expect(byText('loki disabled for alerting').query()).not.toBeInTheDocument();
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
//# sourceMappingURL=RuleEditor.test.js.map