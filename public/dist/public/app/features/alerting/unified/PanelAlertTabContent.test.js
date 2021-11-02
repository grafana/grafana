var _a, _b, _c, _d;
import { __assign, __awaiter, __generator } from "tslib";
import React from 'react';
import { locationService, setDataSourceSrv } from '@grafana/runtime';
import { configureStore } from 'app/store/configureStore';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { render } from '@testing-library/react';
import { PanelAlertTabContent } from './PanelAlertTabContent';
import { mockDataSource, MockDataSourceSrv, mockPromAlertingRule, mockPromRuleGroup, mockPromRuleNamespace, mockRulerGrafanaRule, } from './mocks';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';
import { typeAsJestMock } from 'test/helpers/typeAsJestMock';
import { getAllDataSources } from './utils/config';
import { fetchRules } from './api/prometheus';
import { fetchRulerRules } from './api/ruler';
import { Annotation } from './utils/constants';
import { byTestId } from 'testing-library-selector';
import { PrometheusDatasource } from 'app/plugins/datasource/prometheus/datasource';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
jest.mock('./api/prometheus');
jest.mock('./api/ruler');
jest.mock('./utils/config');
var dataSources = {
    prometheus: mockDataSource({
        name: 'Prometheus',
        type: DataSourceType.Prometheus,
        isDefault: false,
    }),
    default: mockDataSource({
        name: 'Default',
        type: DataSourceType.Prometheus,
        isDefault: true,
    }),
};
dataSources.prometheus.meta.alerting = true;
dataSources.default.meta.alerting = true;
var mocks = {
    getAllDataSources: typeAsJestMock(getAllDataSources),
    api: {
        fetchRules: typeAsJestMock(fetchRules),
        fetchRulerRules: typeAsJestMock(fetchRulerRules),
    },
};
var renderAlertTabContent = function (dashboard, panel) {
    var store = configureStore();
    return render(React.createElement(Provider, { store: store },
        React.createElement(Router, { history: locationService.getHistory() },
            React.createElement(PanelAlertTabContent, { dashboard: dashboard, panel: panel }))));
};
var rules = [
    mockPromRuleNamespace({
        name: 'default',
        groups: [
            mockPromRuleGroup({
                name: 'mygroup',
                rules: [
                    mockPromAlertingRule({
                        name: 'dashboardrule1',
                        annotations: (_a = {},
                            _a[Annotation.dashboardUID] = '12',
                            _a[Annotation.panelID] = '34',
                            _a),
                    }),
                ],
            }),
            mockPromRuleGroup({
                name: 'othergroup',
                rules: [
                    mockPromAlertingRule({
                        name: 'dashboardrule2',
                        annotations: (_b = {},
                            _b[Annotation.dashboardUID] = '121',
                            _b[Annotation.panelID] = '341',
                            _b),
                    }),
                ],
            }),
        ],
    }),
];
var rulerRules = {
    default: [
        {
            name: 'mygroup',
            rules: [
                mockRulerGrafanaRule({
                    annotations: (_c = {},
                        _c[Annotation.dashboardUID] = '12',
                        _c[Annotation.panelID] = '34',
                        _c),
                }, {
                    title: 'dashboardrule1',
                }),
            ],
        },
        {
            name: 'othergroup',
            rules: [
                mockRulerGrafanaRule({
                    annotations: (_d = {},
                        _d[Annotation.dashboardUID] = '121',
                        _d[Annotation.panelID] = '341',
                        _d),
                }, {
                    title: 'dashboardrule2',
                }),
            ],
        },
    ],
};
var dashboard = {
    uid: '12',
    time: {
        from: 'now-6h',
        to: 'now',
    },
    meta: {
        canSave: true,
        folderId: 1,
        folderTitle: 'super folder',
    },
};
var panel = {
    datasource: {
        type: 'prometheus',
        uid: dataSources.prometheus.uid,
    },
    title: 'mypanel',
    id: 34,
    targets: [
        {
            expr: 'sum(some_metric [$__interval])) by (app)',
            refId: 'A',
        },
    ],
};
var ui = {
    row: byTestId('row'),
    createButton: byTestId('create-alert-rule-button'),
};
describe('PanelAlertTabContent', function () {
    beforeEach(function () {
        jest.resetAllMocks();
        mocks.getAllDataSources.mockReturnValue(Object.values(dataSources));
        var dsService = new MockDataSourceSrv(dataSources);
        dsService.datasources[dataSources.prometheus.uid] = new PrometheusDatasource(dataSources.prometheus);
        dsService.datasources[dataSources.default.uid] = new PrometheusDatasource(dataSources.default);
        setDataSourceSrv(dsService);
    });
    it('Will take into account panel maxDataPoints', function () { return __awaiter(void 0, void 0, void 0, function () {
        var button, href, match, defaults;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, renderAlertTabContent(dashboard, __assign(__assign({}, panel), { maxDataPoints: 100, interval: '10s' }))];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, ui.createButton.find()];
                case 2:
                    button = _a.sent();
                    href = button.href;
                    match = href.match(/alerting\/new\?defaults=(.*)&returnTo=/);
                    expect(match).toHaveLength(2);
                    defaults = JSON.parse(decodeURIComponent(match[1]));
                    expect(defaults.queries[0].model).toEqual({
                        expr: 'sum(some_metric [5m])) by (app)',
                        refId: 'A',
                        datasource: {
                            type: 'prometheus',
                            uid: 'mock-ds-2',
                        },
                        interval: '',
                        intervalMs: 300000,
                        maxDataPoints: 100,
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    it('Will work with default datasource', function () { return __awaiter(void 0, void 0, void 0, function () {
        var button, href, match, defaults;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, renderAlertTabContent(dashboard, __assign(__assign({}, panel), { datasource: undefined, maxDataPoints: 100, interval: '10s' }))];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, ui.createButton.find()];
                case 2:
                    button = _a.sent();
                    href = button.href;
                    match = href.match(/alerting\/new\?defaults=(.*)&returnTo=/);
                    expect(match).toHaveLength(2);
                    defaults = JSON.parse(decodeURIComponent(match[1]));
                    expect(defaults.queries[0].model).toEqual({
                        expr: 'sum(some_metric [5m])) by (app)',
                        refId: 'A',
                        datasource: {
                            type: 'prometheus',
                            uid: 'mock-ds-3',
                        },
                        interval: '',
                        intervalMs: 300000,
                        maxDataPoints: 100,
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    it('Will take into account datasource minInterval', function () { return __awaiter(void 0, void 0, void 0, function () {
        var button, href, match, defaults;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    getDatasourceSrv().datasources[dataSources.prometheus.uid].interval = '7m';
                    return [4 /*yield*/, renderAlertTabContent(dashboard, __assign(__assign({}, panel), { maxDataPoints: 100 }))];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, ui.createButton.find()];
                case 2:
                    button = _a.sent();
                    href = button.href;
                    match = href.match(/alerting\/new\?defaults=(.*)&returnTo=/);
                    expect(match).toHaveLength(2);
                    defaults = JSON.parse(decodeURIComponent(match[1]));
                    expect(defaults.queries[0].model).toEqual({
                        expr: 'sum(some_metric [7m])) by (app)',
                        refId: 'A',
                        datasource: {
                            type: 'prometheus',
                            uid: 'mock-ds-2',
                        },
                        interval: '',
                        intervalMs: 420000,
                        maxDataPoints: 100,
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    it('Will render alerts belonging to panel and a button to create alert from panel queries', function () { return __awaiter(void 0, void 0, void 0, function () {
        var rows, button, href, match, defaults;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    mocks.api.fetchRules.mockResolvedValue(rules);
                    mocks.api.fetchRulerRules.mockResolvedValue(rulerRules);
                    return [4 /*yield*/, renderAlertTabContent(dashboard, panel)];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, ui.row.findAll()];
                case 2:
                    rows = _a.sent();
                    expect(rows).toHaveLength(1);
                    expect(rows[0]).toHaveTextContent(/dashboardrule1/);
                    expect(rows[0]).not.toHaveTextContent(/dashboardrule2/);
                    return [4 /*yield*/, ui.createButton.find()];
                case 3:
                    button = _a.sent();
                    href = button.href;
                    match = href.match(/alerting\/new\?defaults=(.*)&returnTo=/);
                    expect(match).toHaveLength(2);
                    defaults = JSON.parse(decodeURIComponent(match[1]));
                    expect(defaults).toEqual({
                        type: 'grafana',
                        folder: { id: 1, title: 'super folder' },
                        queries: [
                            {
                                refId: 'A',
                                queryType: '',
                                relativeTimeRange: { from: 21600, to: 0 },
                                datasourceUid: 'mock-ds-2',
                                model: {
                                    expr: 'sum(some_metric [15s])) by (app)',
                                    refId: 'A',
                                    datasource: {
                                        type: 'prometheus',
                                        uid: 'mock-ds-2',
                                    },
                                    interval: '',
                                    intervalMs: 15000,
                                },
                            },
                            {
                                refId: 'B',
                                datasourceUid: '-100',
                                queryType: '',
                                model: {
                                    refId: 'B',
                                    hide: false,
                                    type: 'classic_conditions',
                                    datasource: {
                                        type: 'grafana-expression',
                                        uid: '-100',
                                    },
                                    conditions: [
                                        {
                                            type: 'query',
                                            evaluator: { params: [3], type: 'gt' },
                                            operator: { type: 'and' },
                                            query: { params: ['A'] },
                                            reducer: { params: [], type: 'last' },
                                        },
                                    ],
                                },
                            },
                        ],
                        name: 'mypanel',
                        condition: 'B',
                        annotations: [
                            { key: '__dashboardUid__', value: '12' },
                            { key: '__panelId__', value: '34' },
                        ],
                    });
                    expect(mocks.api.fetchRulerRules).toHaveBeenCalledWith(GRAFANA_RULES_SOURCE_NAME, {
                        dashboardUID: dashboard.uid,
                        panelId: panel.id,
                    });
                    expect(mocks.api.fetchRules).toHaveBeenCalledWith(GRAFANA_RULES_SOURCE_NAME, {
                        dashboardUID: dashboard.uid,
                        panelId: panel.id,
                    });
                    return [2 /*return*/];
            }
        });
    }); });
});
//# sourceMappingURL=PanelAlertTabContent.test.js.map