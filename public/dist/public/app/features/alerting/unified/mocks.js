import { __awaiter } from "tslib";
import { produce } from 'immer';
import { DataSourceApi, PluginType, } from '@grafana/data';
import { config } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { DatasourceSrv } from 'app/features/plugins/datasource_srv';
import { AlertState, MatcherOperator, SilenceState, } from 'app/plugins/datasource/alertmanager/types';
import { configureStore } from 'app/store/configureStore';
import { GrafanaAlertStateDecision, PromAlertingRuleState, PromRuleType, } from 'app/types/unified-alerting-dto';
let nextDataSourceId = 1;
export function mockDataSource(partial = {}, meta = {}) {
    var _a, _b;
    const id = (_a = partial.id) !== null && _a !== void 0 ? _a : nextDataSourceId++;
    const uid = (_b = partial.uid) !== null && _b !== void 0 ? _b : `mock-ds-${nextDataSourceId}`;
    return Object.assign({ id,
        uid, type: 'prometheus', name: `Prometheus-${id}`, access: 'proxy', url: `/api/datasources/proxy/uid/${uid}`, jsonData: {}, meta: Object.assign({ info: {
                logos: {
                    small: 'https://prometheus.io/assets/prometheus_logo_grey.svg',
                    large: 'https://prometheus.io/assets/prometheus_logo_grey.svg',
                },
            } }, meta), readOnly: false }, partial);
}
export const mockPromAlert = (partial = {}) => (Object.assign({ activeAt: '2021-03-18T13:47:05.04938691Z', annotations: {
        message: 'alert with severity "warning"',
    }, labels: {
        alertname: 'myalert',
        severity: 'warning',
    }, state: PromAlertingRuleState.Firing, value: '1e+00' }, partial));
export const mockRulerGrafanaRule = (partial = {}, partialDef = {}) => {
    return Object.assign({ for: '1m', grafana_alert: Object.assign({ uid: '123', title: 'myalert', namespace_uid: '123', namespace_id: 1, condition: 'A', no_data_state: GrafanaAlertStateDecision.Alerting, exec_err_state: GrafanaAlertStateDecision.Alerting, data: [
                {
                    datasourceUid: '123',
                    refId: 'A',
                    queryType: 'huh',
                    model: {},
                },
            ] }, partialDef), annotations: {
            message: 'alert with severity "{{.warning}}}"',
        }, labels: {
            severity: 'warning',
        } }, partial);
};
export const mockRulerAlertingRule = (partial = {}) => (Object.assign({ alert: 'alert1', expr: 'up = 1', labels: {
        severity: 'warning',
    }, annotations: {
        summary: 'test alert',
    } }, partial));
export const mockRulerRecordingRule = (partial = {}) => (Object.assign({ alert: 'alert1', expr: 'up = 1', labels: {
        severity: 'warning',
    }, annotations: {
        summary: 'test alert',
    } }, partial));
export const mockRulerRuleGroup = (partial = {}) => (Object.assign({ name: 'group1', rules: [mockRulerAlertingRule()] }, partial));
export const promRuleFromRulerRule = (rulerRule, override) => {
    return mockPromAlertingRule(Object.assign({ name: rulerRule.alert, query: rulerRule.expr, labels: rulerRule.labels, annotations: rulerRule.annotations, type: PromRuleType.Alerting }, override));
};
export const mockPromAlertingRule = (partial = {}) => {
    return Object.assign({ type: PromRuleType.Alerting, alerts: [mockPromAlert()], name: 'myalert', query: 'foo > 1', lastEvaluation: '2021-03-23T08:19:05.049595312Z', evaluationTime: 0.000395601, annotations: {
            message: 'alert with severity "{{.warning}}}"',
        }, labels: {
            severity: 'warning',
        }, state: PromAlertingRuleState.Firing, health: 'OK', totalsFiltered: { alerting: 1 } }, partial);
};
export const mockGrafanaRulerRule = (partial = {}) => {
    return {
        for: '',
        annotations: {},
        labels: {},
        grafana_alert: Object.assign({ uid: '', title: 'my rule', namespace_uid: '', namespace_id: 0, condition: '', no_data_state: GrafanaAlertStateDecision.NoData, exec_err_state: GrafanaAlertStateDecision.Error, data: [] }, partial),
    };
};
export const mockPromRecordingRule = (partial = {}) => {
    return Object.assign({ type: PromRuleType.Recording, query: 'bar < 3', labels: {
            cluster: 'eu-central',
        }, health: 'OK', name: 'myrecordingrule', lastEvaluation: '2021-03-23T08:19:05.049595312Z', evaluationTime: 0.000395601 }, partial);
};
export const mockPromRuleGroup = (partial = {}) => {
    return Object.assign({ name: 'mygroup', interval: 60, rules: [mockPromAlertingRule()] }, partial);
};
export const mockPromRuleNamespace = (partial = {}) => {
    return Object.assign({ dataSourceName: 'Prometheus-1', name: 'default', groups: [mockPromRuleGroup()] }, partial);
};
export const mockAlertmanagerAlert = (partial = {}) => {
    return Object.assign({ annotations: {
            summary: 'US-Central region is on fire',
        }, endsAt: '2021-06-22T21:49:28.562Z', fingerprint: '88e013643c3df34ac3', receivers: [{ name: 'pagerduty' }], startsAt: '2021-06-21T17:25:28.562Z', status: { inhibitedBy: [], silencedBy: [], state: AlertState.Active }, updatedAt: '2021-06-22T21:45:28.564Z', generatorURL: 'https://play.grafana.com/explore', labels: { severity: 'warning', region: 'US-Central' } }, partial);
};
export const mockAlertGroup = (partial = {}) => {
    return Object.assign({ labels: {
            severity: 'warning',
            region: 'US-Central',
        }, receiver: {
            name: 'pagerduty',
        }, alerts: [
            mockAlertmanagerAlert(),
            mockAlertmanagerAlert({
                status: { state: AlertState.Suppressed, silencedBy: ['123456abcdef'], inhibitedBy: [] },
                labels: Object.assign({ severity: 'warning', region: 'US-Central', foo: 'bar' }, partial.labels),
            }),
        ] }, partial);
};
export const mockSilence = (partial = {}) => {
    return Object.assign({ id: '1a2b3c4d5e6f', matchers: [{ name: 'foo', value: 'bar', isEqual: true, isRegex: false }], startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), updatedAt: new Date().toISOString(), createdBy: config.bootData.user.name || 'admin', comment: 'Silence noisy alerts', status: {
            state: SilenceState.Active,
        } }, partial);
};
export const mockNotifiersState = (partial = {}) => {
    return Object.assign({ email: [
            {
                name: 'email',
                lastNotifyAttempt: new Date().toISOString(),
                lastNotifyAttemptError: 'this is the error message',
                lastNotifyAttemptDuration: '10s',
            },
        ] }, partial);
};
export const mockReceiversState = (partial = {}) => {
    return Object.assign({ 'broken-receiver': {
            active: false,
            errorCount: 1,
            notifiers: mockNotifiersState(),
        } }, partial);
};
class MockDataSourceApi extends DataSourceApi {
    constructor(instanceSettings) {
        super(instanceSettings);
    }
    query(request) {
        throw new Error('Method not implemented.');
    }
    testDatasource() {
        throw new Error('Method not implemented.');
    }
}
// TODO This should be eventually moved to public/app/features/alerting/unified/testSetup/datasources.ts
export class MockDataSourceSrv {
    constructor(datasources) {
        this.datasources = {};
        // @ts-ignore
        this.settingsMapByName = {};
        this.settingsMapByUid = {};
        this.settingsMapById = {};
        // @ts-ignore
        this.templateSrv = {
            getVariables: () => [],
            replace: (name) => name,
        };
        this.defaultName = '';
        this.datasources = {};
        this.settingsMapByName = Object.values(datasources).reduce((acc, ds) => {
            acc[ds.name] = ds;
            return acc;
        }, {});
        for (const dsSettings of Object.values(this.settingsMapByName)) {
            this.settingsMapByUid[dsSettings.uid] = dsSettings;
            this.settingsMapById[dsSettings.id] = dsSettings;
            if (dsSettings.isDefault) {
                this.defaultName = dsSettings.name;
            }
            this.datasources[dsSettings.uid] = new MockDataSourceApi(dsSettings);
        }
    }
    get(name, scopedVars) {
        return DatasourceSrv.prototype.get.call(this, name, scopedVars);
        //return Promise.reject(new Error('not implemented'));
    }
    /**
     * Get a list of data sources
     */
    getList(filters) {
        return DatasourceSrv.prototype.getList.call(this, filters);
    }
    /**
     * Get settings and plugin metadata by name or uid
     */
    getInstanceSettings(nameOrUid) {
        return (DatasourceSrv.prototype.getInstanceSettings.call(this, nameOrUid) ||
            { meta: { info: { logos: {} } } });
    }
    loadDatasource(name) {
        return __awaiter(this, void 0, void 0, function* () {
            return DatasourceSrv.prototype.loadDatasource.call(this, name);
        });
    }
    reload() { }
}
export const mockGrafanaReceiver = (type, overrides = {}) => (Object.assign({ type: type, name: type, disableResolveMessage: false, settings: {} }, overrides));
export const someGrafanaAlertManagerConfig = {
    template_files: {
        'first template': 'first template content',
        'second template': 'second template content',
        'third template': 'third template',
    },
    alertmanager_config: {
        route: {
            receiver: 'default',
            routes: [
                {
                    receiver: 'critical',
                    object_matchers: [['severity', MatcherOperator.equal, 'critical']],
                },
            ],
        },
        receivers: [
            {
                name: 'default',
                grafana_managed_receiver_configs: [mockGrafanaReceiver('email')],
            },
            {
                name: 'critical',
                grafana_managed_receiver_configs: [mockGrafanaReceiver('slack'), mockGrafanaReceiver('pagerduty')],
            },
        ],
    },
};
export const someCloudAlertManagerStatus = {
    cluster: {
        peers: [],
        status: 'ok',
    },
    uptime: '10 hours',
    versionInfo: {
        branch: '',
        version: '',
        goVersion: '',
        buildDate: '',
        buildUser: '',
        revision: '',
    },
    config: {
        route: {
            receiver: 'default-email',
        },
        receivers: [
            {
                name: 'default-email',
                email_configs: [
                    {
                        to: 'example@example.com',
                    },
                ],
            },
        ],
    },
};
export const someCloudAlertManagerConfig = {
    template_files: {
        'foo template': 'foo content',
    },
    alertmanager_config: {
        route: {
            receiver: 'cloud-receiver',
            routes: [
                {
                    receiver: 'foo-receiver',
                },
                {
                    receiver: 'bar-receiver',
                },
            ],
        },
        receivers: [
            {
                name: 'cloud-receiver',
                email_configs: [
                    {
                        to: 'domas.lapinskas@grafana.com',
                    },
                ],
                slack_configs: [
                    {
                        api_url: 'http://slack1',
                        channel: '#mychannel',
                        actions: [
                            {
                                text: 'action1text',
                                type: 'action1type',
                                url: 'http://action1',
                            },
                        ],
                        fields: [
                            {
                                title: 'field1',
                                value: 'text1',
                            },
                            {
                                title: 'field2',
                                value: 'text2',
                            },
                        ],
                    },
                ],
            },
        ],
    },
};
export const somePromRules = (dataSourceName = 'Prometheus') => [
    {
        dataSourceName,
        name: 'namespace1',
        groups: [
            mockPromRuleGroup({ name: 'group1', rules: [mockPromAlertingRule({ name: 'alert1' })] }),
            mockPromRuleGroup({ name: 'group2', rules: [mockPromAlertingRule({ name: 'alert2' })] }),
        ],
    },
    {
        dataSourceName,
        name: 'namespace2',
        groups: [mockPromRuleGroup({ name: 'group3', rules: [mockPromAlertingRule({ name: 'alert3' })] })],
    },
];
export const someRulerRules = {
    namespace1: [
        mockRulerRuleGroup({ name: 'group1', rules: [mockRulerAlertingRule({ alert: 'alert1' })] }),
        mockRulerRuleGroup({ name: 'group2', rules: [mockRulerAlertingRule({ alert: 'alert2' })] }),
    ],
    namespace2: [mockRulerRuleGroup({ name: 'group3', rules: [mockRulerAlertingRule({ alert: 'alert3' })] })],
};
export const mockCombinedRule = (partial) => (Object.assign({ name: 'mockRule', query: 'expr', group: {
        name: 'mockCombinedRuleGroup',
        rules: [],
        totals: {},
    }, namespace: {
        name: 'mockCombinedNamespace',
        groups: [{ name: 'mockCombinedRuleGroup', rules: [], totals: {} }],
        rulesSource: 'grafana',
    }, labels: {}, annotations: {}, promRule: mockPromAlertingRule(), rulerRule: mockRulerAlertingRule(), instanceTotals: {}, filteredInstanceTotals: {} }, partial));
export const mockFolder = (partial) => {
    return Object.assign({ id: 1, uid: 'gdev-1', title: 'Gdev', version: 1, url: '', canAdmin: true, canDelete: true, canEdit: true, canSave: true, created: '', createdBy: '', hasAcl: false, updated: '', updatedBy: '' }, partial);
};
export const grantUserPermissions = (permissions) => {
    jest
        .spyOn(contextSrv, 'hasPermission')
        .mockImplementation((action) => permissions.includes(action));
};
export function mockDataSourcesStore(partial) {
    const defaultState = configureStore().getState();
    const store = configureStore(Object.assign(Object.assign({}, defaultState), { dataSources: Object.assign(Object.assign({}, defaultState.dataSources), partial) }));
    return store;
}
export function mockUnifiedAlertingStore(unifiedAlerting) {
    const defaultState = configureStore().getState();
    return configureStore(Object.assign(Object.assign({}, defaultState), { unifiedAlerting: Object.assign(Object.assign({}, defaultState.unifiedAlerting), unifiedAlerting) }));
}
export function mockStore(recipe) {
    const defaultState = configureStore().getState();
    return configureStore(produce(defaultState, recipe));
}
export function mockAlertQuery(query) {
    return Object.assign({ datasourceUid: '--uid--', refId: 'A', queryType: '', model: { refId: 'A' } }, query);
}
export function mockCombinedRuleGroup(name, rules) {
    return { name, rules, totals: {} };
}
export function mockCombinedRuleNamespace(namespace) {
    return Object.assign({ name: 'Grafana', groups: [], rulesSource: 'grafana' }, namespace);
}
export function getGrafanaRule(override, rulerOverride) {
    return mockCombinedRule(Object.assign({ namespace: {
            groups: [],
            name: 'Grafana',
            rulesSource: 'grafana',
        }, rulerRule: mockGrafanaRulerRule(rulerOverride) }, override));
}
export function getCloudRule(override) {
    return mockCombinedRule(Object.assign({ namespace: {
            groups: [],
            name: 'Cortex',
            rulesSource: mockDataSource(),
        }, promRule: mockPromAlertingRule(), rulerRule: mockRulerAlertingRule() }, override));
}
export function mockAlertWithState(state, labels) {
    return { activeAt: '', annotations: {}, labels: labels || {}, state: state, value: '' };
}
export const onCallPluginMetaMock = {
    name: 'Grafana OnCall',
    id: 'grafana-oncall-app',
    type: PluginType.app,
    module: 'plugins/grafana-oncall-app/module',
    baseUrl: 'public/plugins/grafana-oncall-app',
    info: {
        author: { name: 'Grafana Labs' },
        description: 'Grafana OnCall',
        updated: '',
        version: '',
        links: [],
        logos: {
            small: '',
            large: '',
        },
        screenshots: [],
    },
};
//# sourceMappingURL=mocks.js.map