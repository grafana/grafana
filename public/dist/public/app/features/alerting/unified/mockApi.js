import { __awaiter } from "tslib";
import { uniqueId } from 'lodash';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import 'whatwg-fetch';
import { setBackendSrv } from '@grafana/runtime';
import { backendSrv } from '../../../core/services/backend_srv';
export class AlertmanagerConfigBuilder {
    constructor() {
        this.alertmanagerConfig = { receivers: [] };
    }
    addReceivers(configure) {
        var _a;
        const receiverBuilder = new AlertmanagerReceiverBuilder();
        configure(receiverBuilder);
        (_a = this.alertmanagerConfig.receivers) === null || _a === void 0 ? void 0 : _a.push(receiverBuilder.build());
        return this;
    }
    withRoute(configure) {
        const routeBuilder = new AlertmanagerRouteBuilder();
        configure(routeBuilder);
        this.alertmanagerConfig.route = routeBuilder.build();
        return this;
    }
    build() {
        return this.alertmanagerConfig;
    }
}
class AlertmanagerRouteBuilder {
    constructor() {
        this.route = { routes: [], object_matchers: [] };
    }
    withReceiver(receiver) {
        this.route.receiver = receiver;
        return this;
    }
    withoutReceiver() {
        return this;
    }
    withEmptyReceiver() {
        this.route.receiver = '';
        return this;
    }
    addRoute(configure) {
        var _a;
        const routeBuilder = new AlertmanagerRouteBuilder();
        configure(routeBuilder);
        (_a = this.route.routes) === null || _a === void 0 ? void 0 : _a.push(routeBuilder.build());
        return this;
    }
    addMatcher(key, operator, value) {
        var _a;
        (_a = this.route.object_matchers) === null || _a === void 0 ? void 0 : _a.push([key, operator, value]);
        return this;
    }
    build() {
        return this.route;
    }
}
class EmailConfigBuilder {
    constructor() {
        this.emailConfig = { to: '' };
    }
    withTo(to) {
        this.emailConfig.to = to;
        return this;
    }
    build() {
        return this.emailConfig;
    }
}
class GrafanaReceiverConfigBuilder {
    constructor() {
        this.grafanaReceiverConfig = {
            name: '',
            type: '',
            settings: {},
            disableResolveMessage: false,
        };
    }
    withType(type) {
        this.grafanaReceiverConfig.type = type;
        return this;
    }
    withName(name) {
        this.grafanaReceiverConfig.name = name;
        return this;
    }
    addSetting(key, value) {
        this.grafanaReceiverConfig.settings[key] = value;
        return this;
    }
    build() {
        return this.grafanaReceiverConfig;
    }
}
class AlertmanagerReceiverBuilder {
    constructor() {
        this.receiver = { name: '', email_configs: [], grafana_managed_receiver_configs: [] };
    }
    withName(name) {
        this.receiver.name = name;
        return this;
    }
    addGrafanaReceiverConfig(configure) {
        var _a;
        (_a = this.receiver.grafana_managed_receiver_configs) === null || _a === void 0 ? void 0 : _a.push(configure(new GrafanaReceiverConfigBuilder()).build());
        return this;
    }
    addEmailConfig(configure) {
        var _a;
        const builder = new EmailConfigBuilder();
        configure(builder);
        (_a = this.receiver.email_configs) === null || _a === void 0 ? void 0 : _a.push(builder.build());
        return this;
    }
    build() {
        return this.receiver;
    }
}
export class OnCallIntegrationBuilder {
    constructor() {
        this.onCallIntegration = {
            id: uniqueId('oncall-integration-mock-'),
            integration: '',
            integration_url: '',
            verbal_name: '',
            connected_escalations_chains_count: 0,
        };
    }
    withIntegration(integration) {
        this.onCallIntegration.integration = integration;
        return this;
    }
    withIntegrationUrl(integrationUrl) {
        this.onCallIntegration.integration_url = integrationUrl;
        return this;
    }
    withVerbalName(verbalName) {
        this.onCallIntegration.verbal_name = verbalName;
        return this;
    }
    build() {
        return this.onCallIntegration;
    }
}
export function mockApi(server) {
    return {
        getAlertmanagerConfig: (amName, configure) => {
            const builder = new AlertmanagerConfigBuilder();
            configure(builder);
            server.use(rest.get(`api/alertmanager/${amName}/config/api/v1/alerts`, (req, res, ctx) => res(ctx.status(200), ctx.json({
                alertmanager_config: builder.build(),
                template_files: {},
            }))));
        },
        eval: (response) => {
            server.use(rest.post('/api/v1/eval', (_, res, ctx) => {
                return res(ctx.status(200), ctx.json(response));
            }));
        },
        grafanaNotifiers: (response) => {
            server.use(rest.get(`api/alert-notifiers`, (req, res, ctx) => res(ctx.status(200), ctx.json(response))));
        },
        plugins: {
            getPluginSettings: (response) => {
                server.use(rest.get(`api/plugins/${response.id}/settings`, (req, res, ctx) => res(ctx.status(200), ctx.json(response))));
            },
        },
        oncall: {
            getOnCallIntegrations: (response) => {
                server.use(rest.get(`api/plugin-proxy/grafana-oncall-app/api/internal/v1/alert_receive_channels`, (_, res, ctx) => res(ctx.status(200), ctx.json(response))));
            },
            features: (response) => {
                server.use(rest.get(`api/plugin-proxy/grafana-oncall-app/api/internal/v1/features`, (_, res, ctx) => res(ctx.status(200), ctx.json(response))));
            },
            validateIntegrationName: (invalidNames) => {
                server.use(rest.get(`api/plugin-proxy/grafana-oncall-app/api/internal/v1/alert_receive_channels/validate_name`, (req, res, ctx) => {
                    var _a;
                    const isValid = !invalidNames.includes((_a = req.url.searchParams.get('verbal_name')) !== null && _a !== void 0 ? _a : '');
                    return res(ctx.status(isValid ? 200 : 409), ctx.json(isValid));
                }));
            },
            createIntegraion: () => {
                server.use(rest.post(`api/plugin-proxy/grafana-oncall-app/api/internal/v1/alert_receive_channels`, (req, res, ctx) => __awaiter(this, void 0, void 0, function* () {
                    const body = yield req.json();
                    const integrationId = uniqueId('oncall-integration-');
                    return res(ctx.status(200), ctx.json({
                        id: integrationId,
                        integration: body.integration,
                        integration_url: `https://oncall-endpoint.example.com/${integrationId}`,
                        verbal_name: body.verbal_name,
                        connected_escalations_chains_count: 0,
                    }));
                })));
            },
        },
    };
}
export function mockAlertRuleApi(server) {
    return {
        prometheusRuleNamespaces: (dsName, response) => {
            server.use(rest.get(`api/prometheus/${dsName}/api/v1/rules`, (req, res, ctx) => res(ctx.status(200), ctx.json(response))));
        },
        rulerRules: (dsName, response) => {
            server.use(rest.get(`/api/ruler/${dsName}/api/v1/rules`, (req, res, ctx) => res(ctx.status(200), ctx.json(response))));
        },
        rulerRuleGroup: (dsName, namespace, group, response) => {
            server.use(rest.get(`/api/ruler/${dsName}/api/v1/rules/${namespace}/${group}`, (req, res, ctx) => res(ctx.status(200), ctx.json(response))));
        },
    };
}
/**
 * Used to mock the response from the /api/v1/status/buildinfo endpoint
 */
export function mockFeatureDiscoveryApi(server) {
    return {
        /**
         *
         * @param dsSettings Use `mockDataSource` to create a faks data source settings
         * @param response Use `buildInfoResponse` to get a pre-defined response for Prometheus and Mimir
         */
        discoverDsFeatures: (dsSettings, response) => {
            server.use(rest.get(`${dsSettings.url}/api/v1/status/buildinfo`, (_, res, ctx) => res(ctx.status(200), ctx.json(response))));
        },
    };
}
export function mockProvisioningApi(server) {
    return {
        exportRuleGroup: (folderUid, groupName, response) => {
            server.use(rest.get(`/api/v1/provisioning/folder/${folderUid}/rule-groups/${groupName}/export`, (req, res, ctx) => { var _a; return res(ctx.status(200), ctx.text(response[(_a = req.url.searchParams.get('format')) !== null && _a !== void 0 ? _a : 'yaml'])); }));
        },
        exportReceiver: (response) => {
            server.use(rest.get(`/api/v1/provisioning/contact-points/export/`, (req, res, ctx) => { var _a; return res(ctx.status(200), ctx.text(response[(_a = req.url.searchParams.get('format')) !== null && _a !== void 0 ? _a : 'yaml'])); }));
        },
    };
}
export function mockExportApi(server) {
    // exportRule, exportRulesGroup, exportRulesFolder use the same API endpoint but with different parameters
    return {
        // exportRule requires ruleUid parameter and doesn't allow folderUid and group parameters
        exportRule: (ruleUid, response) => {
            server.use(rest.get('/api/ruler/grafana/api/v1/export/rules', (req, res, ctx) => {
                var _a;
                if (req.url.searchParams.get('ruleUid') === ruleUid) {
                    return res(ctx.status(200), ctx.text(response[(_a = req.url.searchParams.get('format')) !== null && _a !== void 0 ? _a : 'yaml']));
                }
                return res(ctx.status(500));
            }));
        },
        // exportRulesGroup requires folderUid and group parameters and doesn't allow ruleUid parameter
        exportRulesGroup: (folderUid, group, response) => {
            server.use(rest.get('/api/ruler/grafana/api/v1/export/rules', (req, res, ctx) => {
                var _a;
                if (req.url.searchParams.get('folderUid') === folderUid && req.url.searchParams.get('group') === group) {
                    return res(ctx.status(200), ctx.text(response[(_a = req.url.searchParams.get('format')) !== null && _a !== void 0 ? _a : 'yaml']));
                }
                return res(ctx.status(500));
            }));
        },
        // exportRulesFolder requires folderUid parameter
        exportRulesFolder: (folderUid, response) => {
            server.use(rest.get('/api/ruler/grafana/api/v1/export/rules', (req, res, ctx) => {
                var _a;
                if (req.url.searchParams.get('folderUid') === folderUid) {
                    return res(ctx.status(200), ctx.text(response[(_a = req.url.searchParams.get('format')) !== null && _a !== void 0 ? _a : 'yaml']));
                }
                return res(ctx.status(500));
            }));
        },
        modifiedExport: (namespace, response) => {
            server.use(rest.post(`/api/ruler/grafana/api/v1/rules/${namespace}/export`, (req, res, ctx) => {
                var _a;
                return res(ctx.status(200), ctx.text(response[(_a = req.url.searchParams.get('format')) !== null && _a !== void 0 ? _a : 'yaml']));
            }));
        },
    };
}
export function mockFolderApi(server) {
    return {
        folder: (folderUid, response) => {
            server.use(rest.get(`/api/folders/${folderUid}`, (_, res, ctx) => res(ctx.status(200), ctx.json(response))));
        },
    };
}
export function mockSearchApi(server) {
    return {
        search: (results) => {
            server.use(rest.get(`/api/search`, (_, res, ctx) => res(ctx.status(200), ctx.json(results))));
        },
    };
}
// Creates a MSW server and sets up beforeAll, afterAll and beforeEach handlers for it
export function setupMswServer() {
    const server = setupServer();
    beforeAll(() => {
        setBackendSrv(backendSrv);
        server.listen({ onUnhandledRequest: 'error' });
    });
    afterAll(() => {
        server.close();
    });
    return server;
}
//# sourceMappingURL=mockApi.js.map