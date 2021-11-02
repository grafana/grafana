import { __assign, __awaiter, __generator, __values } from "tslib";
import { GrafanaAlertStateDecision, PromAlertingRuleState, PromRuleType, } from 'app/types/unified-alerting-dto';
import DatasourceSrv from 'app/features/plugins/datasource_srv';
import { config } from '@grafana/runtime';
import { AlertState, SilenceState, } from 'app/plugins/datasource/alertmanager/types';
var nextDataSourceId = 1;
export function mockDataSource(partial, meta) {
    var _a;
    if (partial === void 0) { partial = {}; }
    if (meta === void 0) { meta = {}; }
    var id = (_a = partial.id) !== null && _a !== void 0 ? _a : nextDataSourceId++;
    return __assign({ id: id, uid: "mock-ds-" + nextDataSourceId, type: 'prometheus', name: "Prometheus-" + id, access: 'proxy', jsonData: {}, meta: __assign({ info: {
                logos: {
                    small: 'https://prometheus.io/assets/prometheus_logo_grey.svg',
                    large: 'https://prometheus.io/assets/prometheus_logo_grey.svg',
                },
            } }, meta) }, partial);
}
export var mockPromAlert = function (partial) {
    if (partial === void 0) { partial = {}; }
    return (__assign({ activeAt: '2021-03-18T13:47:05.04938691Z', annotations: {
            message: 'alert with severity "warning"',
        }, labels: {
            alertname: 'myalert',
            severity: 'warning',
        }, state: PromAlertingRuleState.Firing, value: '1e+00' }, partial));
};
export var mockRulerGrafanaRule = function (partial, partialDef) {
    if (partial === void 0) { partial = {}; }
    if (partialDef === void 0) { partialDef = {}; }
    return __assign({ for: '1m', grafana_alert: __assign({ uid: '123', title: 'myalert', namespace_uid: '123', namespace_id: 1, condition: 'A', no_data_state: GrafanaAlertStateDecision.Alerting, exec_err_state: GrafanaAlertStateDecision.Alerting, data: [
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
export var mockRulerAlertingRule = function (partial) {
    if (partial === void 0) { partial = {}; }
    return ({
        alert: 'alert1',
        expr: 'up = 1',
        labels: {
            severity: 'warning',
        },
        annotations: {
            summary: 'test alert',
        },
    });
};
export var mockRulerRuleGroup = function (partial) {
    if (partial === void 0) { partial = {}; }
    return (__assign({ name: 'group1', rules: [mockRulerAlertingRule()] }, partial));
};
export var mockPromAlertingRule = function (partial) {
    if (partial === void 0) { partial = {}; }
    return __assign({ type: PromRuleType.Alerting, alerts: [mockPromAlert()], name: 'myalert', query: 'foo > 1', lastEvaluation: '2021-03-23T08:19:05.049595312Z', evaluationTime: 0.000395601, annotations: {
            message: 'alert with severity "{{.warning}}}"',
        }, labels: {
            severity: 'warning',
        }, state: PromAlertingRuleState.Firing, health: 'OK' }, partial);
};
export var mockPromRecordingRule = function (partial) {
    if (partial === void 0) { partial = {}; }
    return __assign({ type: PromRuleType.Recording, query: 'bar < 3', labels: {
            cluster: 'eu-central',
        }, health: 'OK', name: 'myrecordingrule', lastEvaluation: '2021-03-23T08:19:05.049595312Z', evaluationTime: 0.000395601 }, partial);
};
export var mockPromRuleGroup = function (partial) {
    if (partial === void 0) { partial = {}; }
    return __assign({ name: 'mygroup', interval: 60, rules: [mockPromAlertingRule()] }, partial);
};
export var mockPromRuleNamespace = function (partial) {
    if (partial === void 0) { partial = {}; }
    return __assign({ dataSourceName: 'Prometheus-1', name: 'default', groups: [mockPromRuleGroup()] }, partial);
};
export var mockAlertmanagerAlert = function (partial) {
    if (partial === void 0) { partial = {}; }
    return __assign({ annotations: {
            summary: 'US-Central region is on fire',
        }, endsAt: '2021-06-22T21:49:28.562Z', fingerprint: '88e013643c3df34ac3', receivers: [{ name: 'pagerduty' }], startsAt: '2021-06-21T17:25:28.562Z', status: { inhibitedBy: [], silencedBy: [], state: AlertState.Active }, updatedAt: '2021-06-22T21:45:28.564Z', generatorURL: 'https://play.grafana.com/explore', labels: { severity: 'warning', region: 'US-Central' } }, partial);
};
export var mockAlertGroup = function (partial) {
    if (partial === void 0) { partial = {}; }
    return __assign({ labels: {
            severity: 'warning',
            region: 'US-Central',
        }, receiver: {
            name: 'pagerduty',
        }, alerts: [
            mockAlertmanagerAlert(),
            mockAlertmanagerAlert({
                status: { state: AlertState.Suppressed, silencedBy: ['123456abcdef'], inhibitedBy: [] },
                labels: __assign({ severity: 'warning', region: 'US-Central', foo: 'bar' }, partial.labels),
            }),
        ] }, partial);
};
export var mockSilence = function (partial) {
    if (partial === void 0) { partial = {}; }
    return __assign({ id: '1a2b3c4d5e6f', matchers: [{ name: 'foo', value: 'bar', isEqual: true, isRegex: false }], startsAt: new Date().toISOString(), endsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), updatedAt: new Date().toISOString(), createdBy: config.bootData.user.name || 'admin', comment: 'Silence noisy alerts', status: {
            state: SilenceState.Active,
        } }, partial);
};
var MockDataSourceSrv = /** @class */ (function () {
    function MockDataSourceSrv(datasources) {
        var e_1, _a;
        this.datasources = {};
        // @ts-ignore
        this.settingsMapByName = {};
        this.settingsMapByUid = {};
        this.settingsMapById = {};
        // @ts-ignore
        this.templateSrv = {
            getVariables: function () { return []; },
            replace: function (name) { return name; },
        };
        this.defaultName = '';
        this.datasources = {};
        this.settingsMapByName = Object.values(datasources).reduce(function (acc, ds) {
            acc[ds.name] = ds;
            return acc;
        }, {});
        try {
            for (var _b = __values(Object.values(this.settingsMapByName)), _c = _b.next(); !_c.done; _c = _b.next()) {
                var dsSettings = _c.value;
                this.settingsMapByUid[dsSettings.uid] = dsSettings;
                this.settingsMapById[dsSettings.id] = dsSettings;
                if (dsSettings.isDefault) {
                    this.defaultName = dsSettings.name;
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
    }
    MockDataSourceSrv.prototype.get = function (name, scopedVars) {
        return DatasourceSrv.prototype.get.call(this, name, scopedVars);
        //return Promise.reject(new Error('not implemented'));
    };
    /**
     * Get a list of data sources
     */
    MockDataSourceSrv.prototype.getList = function (filters) {
        return DatasourceSrv.prototype.getList.call(this, filters);
    };
    /**
     * Get settings and plugin metadata by name or uid
     */
    MockDataSourceSrv.prototype.getInstanceSettings = function (nameOrUid) {
        return (DatasourceSrv.prototype.getInstanceSettings.call(this, nameOrUid) ||
            { meta: { info: { logos: {} } } });
    };
    MockDataSourceSrv.prototype.loadDatasource = function (name) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, DatasourceSrv.prototype.loadDatasource.call(this, name)];
            });
        });
    };
    return MockDataSourceSrv;
}());
export { MockDataSourceSrv };
export var mockGrafanaReceiver = function (type, overrides) {
    if (overrides === void 0) { overrides = {}; }
    return (__assign({ type: type, name: type, disableResolveMessage: false, settings: {} }, overrides));
};
export var someGrafanaAlertManagerConfig = {
    template_files: {
        'first template': 'first template content',
        'second template': 'second template content',
        'third template': 'third template',
    },
    alertmanager_config: {
        route: {
            receiver: 'default',
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
export var someCloudAlertManagerStatus = {
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
export var someCloudAlertManagerConfig = {
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
export var somePromRules = function (dataSourceName) {
    if (dataSourceName === void 0) { dataSourceName = 'Prometheus'; }
    return [
        {
            dataSourceName: dataSourceName,
            name: 'namespace1',
            groups: [
                mockPromRuleGroup({ name: 'group1', rules: [mockPromAlertingRule({ name: 'alert1' })] }),
                mockPromRuleGroup({ name: 'group2', rules: [mockPromAlertingRule({ name: 'alert2' })] }),
            ],
        },
        {
            dataSourceName: dataSourceName,
            name: 'namespace2',
            groups: [mockPromRuleGroup({ name: 'group3', rules: [mockPromAlertingRule({ name: 'alert3' })] })],
        },
    ];
};
export var someRulerRules = {
    namespace1: [
        mockRulerRuleGroup({ name: 'group1', rules: [mockRulerAlertingRule({ alert: 'alert1' })] }),
        mockRulerRuleGroup({ name: 'group2', rules: [mockRulerAlertingRule({ alert: 'alert2' })] }),
    ],
    namespace2: [mockRulerRuleGroup({ name: 'group3', rules: [mockRulerAlertingRule({ alert: 'alert3' })] })],
};
//# sourceMappingURL=mocks.js.map