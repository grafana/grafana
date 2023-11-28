import { __awaiter } from "tslib";
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { byTestId } from 'testing-library-selector';
import { setDataSourceSrv } from '@grafana/runtime';
import * as ruleActionButtons from 'app/features/alerting/unified/components/rules/RuleActionsButtons';
import { PanelModel } from 'app/features/dashboard/state';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { toggleOption } from 'app/features/variables/pickers/OptionsPicker/reducer';
import { toKeyedAction } from 'app/features/variables/state/keyedVariablesReducer';
import { PrometheusDatasource } from 'app/plugins/datasource/prometheus/datasource';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types';
import { PanelAlertTabContent } from './PanelAlertTabContent';
import { fetchRules } from './api/prometheus';
import { fetchRulerRules } from './api/ruler';
import { grantUserPermissions, mockDataSource, MockDataSourceSrv, mockPromAlertingRule, mockPromRuleGroup, mockPromRuleNamespace, mockRulerGrafanaRule, } from './mocks';
import * as config from './utils/config';
import { Annotation } from './utils/constants';
import { DataSourceType, GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';
import * as ruleFormUtils from './utils/rule-form';
jest.mock('./api/prometheus');
jest.mock('./api/ruler');
jest.mock('../../../core/hooks/useMediaQueryChange');
jest.spyOn(config, 'getAllDataSources');
jest.spyOn(ruleActionButtons, 'matchesWidth').mockReturnValue(false);
const dataSources = {
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
const mocks = {
    getAllDataSources: jest.mocked(config.getAllDataSources),
    api: {
        fetchRules: jest.mocked(fetchRules),
        fetchRulerRules: jest.mocked(fetchRulerRules),
    },
};
const renderAlertTabContent = (dashboard, panel, initialStore) => {
    render(React.createElement(TestProvider, { store: initialStore },
        React.createElement(PanelAlertTabContent, { dashboard: dashboard, panel: panel })));
};
const rules = [
    mockPromRuleNamespace({
        name: 'default',
        groups: [
            mockPromRuleGroup({
                name: 'mygroup',
                rules: [
                    mockPromAlertingRule({
                        name: 'dashboardrule1',
                        annotations: {
                            [Annotation.dashboardUID]: '12',
                            [Annotation.panelID]: '34',
                        },
                    }),
                ],
            }),
            mockPromRuleGroup({
                name: 'othergroup',
                rules: [
                    mockPromAlertingRule({
                        name: 'dashboardrule2',
                        annotations: {
                            [Annotation.dashboardUID]: '121',
                            [Annotation.panelID]: '341',
                        },
                    }),
                ],
            }),
        ],
    }),
];
const rulerRules = {
    default: [
        {
            name: 'mygroup',
            rules: [
                mockRulerGrafanaRule({
                    annotations: {
                        [Annotation.dashboardUID]: '12',
                        [Annotation.panelID]: '34',
                    },
                }, {
                    title: 'dashboardrule1',
                }),
            ],
        },
        {
            name: 'othergroup',
            rules: [
                mockRulerGrafanaRule({
                    annotations: {
                        [Annotation.dashboardUID]: '121',
                        [Annotation.panelID]: '341',
                    },
                }, {
                    title: 'dashboardrule2',
                }),
            ],
        },
    ],
};
const dashboard = {
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
const panel = new PanelModel({
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
});
const ui = {
    row: byTestId('row'),
    createButton: byTestId('create-alert-rule-button'),
};
describe('PanelAlertTabContent', () => {
    beforeEach(() => {
        jest.resetAllMocks();
        grantUserPermissions([
            AccessControlAction.AlertingRuleRead,
            AccessControlAction.AlertingRuleUpdate,
            AccessControlAction.AlertingRuleDelete,
            AccessControlAction.AlertingRuleCreate,
            AccessControlAction.AlertingRuleExternalRead,
            AccessControlAction.AlertingRuleExternalWrite,
        ]);
        mocks.getAllDataSources.mockReturnValue(Object.values(dataSources));
        const dsService = new MockDataSourceSrv(dataSources);
        dsService.datasources[dataSources.prometheus.uid] = new PrometheusDatasource(dataSources.prometheus);
        dsService.datasources[dataSources.default.uid] = new PrometheusDatasource(dataSources.default);
        setDataSourceSrv(dsService);
    });
    it('Will take into account panel maxDataPoints', () => __awaiter(void 0, void 0, void 0, function* () {
        renderAlertTabContent(dashboard, new PanelModel(Object.assign(Object.assign({}, panel), { maxDataPoints: 100, interval: '10s' })));
        const button = yield ui.createButton.find();
        const href = button.href;
        const match = href.match(/alerting\/new\?defaults=(.*)&returnTo=/);
        expect(match).toHaveLength(2);
        const defaults = JSON.parse(decodeURIComponent(match[1]));
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
    }));
    it('Will work with default datasource', () => __awaiter(void 0, void 0, void 0, function* () {
        renderAlertTabContent(dashboard, new PanelModel(Object.assign(Object.assign({}, panel), { datasource: undefined, maxDataPoints: 100, interval: '10s' })));
        const button = yield ui.createButton.find();
        const href = button.href;
        const match = href.match(/alerting\/new\?defaults=(.*)&returnTo=/);
        expect(match).toHaveLength(2);
        const defaults = JSON.parse(decodeURIComponent(match[1]));
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
    }));
    it('Will take into account datasource minInterval', () => __awaiter(void 0, void 0, void 0, function* () {
        getDatasourceSrv().datasources[dataSources.prometheus.uid].interval = '7m';
        renderAlertTabContent(dashboard, new PanelModel(Object.assign(Object.assign({}, panel), { maxDataPoints: 100 })));
        const button = yield ui.createButton.find();
        const href = button.href;
        const match = href.match(/alerting\/new\?defaults=(.*)&returnTo=/);
        expect(match).toHaveLength(2);
        const defaults = JSON.parse(decodeURIComponent(match[1]));
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
    }));
    it('Will render alerts belonging to panel and a button to create alert from panel queries', () => __awaiter(void 0, void 0, void 0, function* () {
        mocks.api.fetchRules.mockResolvedValue(rules);
        mocks.api.fetchRulerRules.mockResolvedValue(rulerRules);
        renderAlertTabContent(dashboard, panel);
        const rows = yield ui.row.findAll();
        expect(rows).toHaveLength(1);
        expect(rows[0]).toHaveTextContent(/dashboardrule1/);
        expect(rows[0]).not.toHaveTextContent(/dashboardrule2/);
        const button = yield ui.createButton.find();
        const href = button.href;
        const match = href.match(/alerting\/new\?defaults=(.*)&returnTo=/);
        expect(match).toHaveLength(2);
        const defaults = JSON.parse(decodeURIComponent(match[1]));
        const defaultsWithDeterministicTime = Object.assign(Object.assign({}, defaults), { queries: defaults.queries.map((q) => {
                return Object.assign(Object.assign({}, q), (q.relativeTimeRange ? { relativeTimeRange: { from: 21600, to: 0 } } : {}));
            }) });
        expect(defaultsWithDeterministicTime).toMatchSnapshot();
        expect(mocks.api.fetchRulerRules).toHaveBeenCalledWith({ dataSourceName: GRAFANA_RULES_SOURCE_NAME, apiVersion: 'legacy' }, {
            dashboardUID: dashboard.uid,
            panelId: panel.id,
        });
        expect(mocks.api.fetchRules).toHaveBeenCalledWith(GRAFANA_RULES_SOURCE_NAME, {
            dashboardUID: dashboard.uid,
            panelId: panel.id,
        }, undefined, undefined, undefined, undefined);
    }));
    it('Update NewRuleFromPanel button url when template changes', () => __awaiter(void 0, void 0, void 0, function* () {
        const panelToRuleValuesSpy = jest.spyOn(ruleFormUtils, 'panelToRuleFormValues');
        const store = configureStore();
        renderAlertTabContent(dashboard, panel, store);
        store.dispatch(toKeyedAction('optionKey', toggleOption({
            option: { value: 'optionValue', selected: true, text: 'Option' },
            clearOthers: false,
            forceSelect: false,
        })));
        yield waitFor(() => expect(panelToRuleValuesSpy).toHaveBeenCalledTimes(2));
    }));
});
//# sourceMappingURL=PanelAlertTabContent.test.js.map