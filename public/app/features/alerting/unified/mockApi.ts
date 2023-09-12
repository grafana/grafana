import { uniqueId } from 'lodash';
import { rest } from 'msw';
import { setupServer, SetupServer } from 'msw/node';
import 'whatwg-fetch';

import { DataSourceInstanceSettings, PluginMeta } from '@grafana/data';
import { setBackendSrv } from '@grafana/runtime';
import {
  PromBuildInfoResponse,
  PromRulesResponse,
  RulerRuleGroupDTO,
  RulerRulesConfigDTO,
} from 'app/types/unified-alerting-dto';

import { backendSrv } from '../../../core/services/backend_srv';
import {
  AlertmanagerConfig,
  AlertManagerCortexConfig,
  AlertmanagerReceiver,
  EmailConfig,
  GrafanaManagedReceiverConfig,
  MatcherOperator,
  Route,
} from '../../../plugins/datasource/alertmanager/types';
import { FolderDTO, NotifierDTO } from '../../../types';

import { CreateIntegrationDTO, NewOnCallIntegrationDTO, OnCallIntegrationDTO } from './api/onCallApi';
import { AlertingQueryResponse } from './state/AlertingQueryRunner';

type Configurator<T> = (builder: T) => T;

export class AlertmanagerConfigBuilder {
  private alertmanagerConfig: AlertmanagerConfig = { receivers: [] };

  addReceivers(configure: (builder: AlertmanagerReceiverBuilder) => void): AlertmanagerConfigBuilder {
    const receiverBuilder = new AlertmanagerReceiverBuilder();
    configure(receiverBuilder);
    this.alertmanagerConfig.receivers?.push(receiverBuilder.build());
    return this;
  }

  withRoute(configure: (routeBuilder: AlertmanagerRouteBuilder) => void): AlertmanagerConfigBuilder {
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
  private route: Route = { routes: [], object_matchers: [] };

  withReceiver(receiver: string): AlertmanagerRouteBuilder {
    this.route.receiver = receiver;
    return this;
  }

  withoutReceiver(): AlertmanagerRouteBuilder {
    return this;
  }

  withEmptyReceiver(): AlertmanagerRouteBuilder {
    this.route.receiver = '';
    return this;
  }

  addRoute(configure: (builder: AlertmanagerRouteBuilder) => void): AlertmanagerRouteBuilder {
    const routeBuilder = new AlertmanagerRouteBuilder();
    configure(routeBuilder);
    this.route.routes?.push(routeBuilder.build());
    return this;
  }

  addMatcher(key: string, operator: MatcherOperator, value: string): AlertmanagerRouteBuilder {
    this.route.object_matchers?.push([key, operator, value]);
    return this;
  }

  build() {
    return this.route;
  }
}

class EmailConfigBuilder {
  private emailConfig: EmailConfig = { to: '' };

  withTo(to: string): EmailConfigBuilder {
    this.emailConfig.to = to;
    return this;
  }

  build() {
    return this.emailConfig;
  }
}

class GrafanaReceiverConfigBuilder {
  private grafanaReceiverConfig: GrafanaManagedReceiverConfig = {
    name: '',
    type: '',
    settings: {},
    disableResolveMessage: false,
  };

  withType(type: string): GrafanaReceiverConfigBuilder {
    this.grafanaReceiverConfig.type = type;
    return this;
  }

  withName(name: string): GrafanaReceiverConfigBuilder {
    this.grafanaReceiverConfig.name = name;
    return this;
  }

  addSetting(key: string, value: string): GrafanaReceiverConfigBuilder {
    this.grafanaReceiverConfig.settings[key] = value;
    return this;
  }

  build() {
    return this.grafanaReceiverConfig;
  }
}

class AlertmanagerReceiverBuilder {
  private receiver: AlertmanagerReceiver = { name: '', email_configs: [], grafana_managed_receiver_configs: [] };

  withName(name: string): AlertmanagerReceiverBuilder {
    this.receiver.name = name;
    return this;
  }

  addGrafanaReceiverConfig(configure: Configurator<GrafanaReceiverConfigBuilder>): AlertmanagerReceiverBuilder {
    this.receiver.grafana_managed_receiver_configs?.push(configure(new GrafanaReceiverConfigBuilder()).build());
    return this;
  }

  addEmailConfig(configure: (builder: EmailConfigBuilder) => void): AlertmanagerReceiverBuilder {
    const builder = new EmailConfigBuilder();
    configure(builder);
    this.receiver.email_configs?.push(builder.build());
    return this;
  }

  build() {
    return this.receiver;
  }
}

export class OnCallIntegrationBuilder {
  private onCallIntegration: NewOnCallIntegrationDTO = {
    id: uniqueId('oncall-integration-mock-'),
    integration: '',
    integration_url: '',
    verbal_name: '',
    connected_escalations_chains_count: 0,
  };

  withIntegration(integration: string): OnCallIntegrationBuilder {
    this.onCallIntegration.integration = integration;
    return this;
  }

  withIntegrationUrl(integrationUrl: string): OnCallIntegrationBuilder {
    this.onCallIntegration.integration_url = integrationUrl;
    return this;
  }

  withVerbalName(verbalName: string): OnCallIntegrationBuilder {
    this.onCallIntegration.verbal_name = verbalName;
    return this;
  }

  build() {
    return this.onCallIntegration;
  }
}

export function mockApi(server: SetupServer) {
  return {
    getAlertmanagerConfig: (amName: string, configure: (builder: AlertmanagerConfigBuilder) => void) => {
      const builder = new AlertmanagerConfigBuilder();
      configure(builder);

      server.use(
        rest.get(`api/alertmanager/${amName}/config/api/v1/alerts`, (req, res, ctx) =>
          res(
            ctx.status(200),
            ctx.json<AlertManagerCortexConfig>({
              alertmanager_config: builder.build(),
              template_files: {},
            })
          )
        )
      );
    },

    eval: (response: AlertingQueryResponse) => {
      server.use(
        rest.post('/api/v1/eval', (_, res, ctx) => {
          return res(ctx.status(200), ctx.json(response));
        })
      );
    },
    grafanaNotifiers: (response: NotifierDTO[]) => {
      server.use(
        rest.get(`api/alert-notifiers`, (req, res, ctx) => res(ctx.status(200), ctx.json<NotifierDTO[]>(response)))
      );
    },

    plugins: {
      getPluginSettings: (response: PluginMeta) => {
        server.use(
          rest.get(`api/plugins/${response.id}/settings`, (req, res, ctx) =>
            res(ctx.status(200), ctx.json<PluginMeta>(response))
          )
        );
      },
    },

    oncall: {
      getOnCallIntegrations: (response: OnCallIntegrationDTO[]) => {
        server.use(
          rest.get(`api/plugin-proxy/grafana-oncall-app/api/internal/v1/alert_receive_channels`, (_, res, ctx) =>
            res(ctx.status(200), ctx.json<OnCallIntegrationDTO[]>(response))
          )
        );
      },
      features: (response: string[]) => {
        server.use(
          rest.get(`api/plugin-proxy/grafana-oncall-app/api/internal/v1/features`, (_, res, ctx) =>
            res(ctx.status(200), ctx.json<string[]>(response))
          )
        );
      },
      validateIntegrationName: (invalidNames: string[]) => {
        server.use(
          rest.get(
            `api/plugin-proxy/grafana-oncall-app/api/internal/v1/alert_receive_channels/validate_name`,
            (req, res, ctx) => {
              const isValid = !invalidNames.includes(req.url.searchParams.get('verbal_name') ?? '');
              return res(ctx.status(isValid ? 200 : 409), ctx.json<boolean>(isValid));
            }
          )
        );
      },
      createIntegraion: () => {
        server.use(
          rest.post<CreateIntegrationDTO>(
            `api/plugin-proxy/grafana-oncall-app/api/internal/v1/alert_receive_channels`,
            async (req, res, ctx) => {
              const body = await req.json<CreateIntegrationDTO>();
              const integrationId = uniqueId('oncall-integration-');

              return res(
                ctx.status(200),
                ctx.json<NewOnCallIntegrationDTO>({
                  id: integrationId,
                  integration: body.integration,
                  integration_url: `https://oncall-endpoint.example.com/${integrationId}`,
                  verbal_name: body.verbal_name,
                  connected_escalations_chains_count: 0,
                })
              );
            }
          )
        );
      },
    },
  };
}

export function mockAlertRuleApi(server: SetupServer) {
  return {
    prometheusRuleNamespaces: (dsName: string, response: PromRulesResponse) => {
      server.use(
        rest.get(`api/prometheus/${dsName}/api/v1/rules`, (req, res, ctx) =>
          res(ctx.status(200), ctx.json<PromRulesResponse>(response))
        )
      );
    },
    rulerRules: (dsName: string, response: RulerRulesConfigDTO) => {
      server.use(
        rest.get(`/api/ruler/${dsName}/api/v1/rules`, (req, res, ctx) => res(ctx.status(200), ctx.json(response)))
      );
    },
    rulerRuleGroup: (dsName: string, namespace: string, group: string, response: RulerRuleGroupDTO) => {
      server.use(
        rest.get(`/api/ruler/${dsName}/api/v1/rules/${namespace}/${group}`, (req, res, ctx) =>
          res(ctx.status(200), ctx.json(response))
        )
      );
    },
  };
}

/**
 * Used to mock the response from the /api/v1/status/buildinfo endpoint
 */
export function mockFeatureDiscoveryApi(server: SetupServer) {
  return {
    /**
     *
     * @param dsSettings Use `mockDataSource` to create a faks data source settings
     * @param response Use `buildInfoResponse` to get a pre-defined response for Prometheus and Mimir
     */
    discoverDsFeatures: (dsSettings: DataSourceInstanceSettings, response: PromBuildInfoResponse) => {
      server.use(
        rest.get(`${dsSettings.url}/api/v1/status/buildinfo`, (_, res, ctx) => res(ctx.status(200), ctx.json(response)))
      );
    },
  };
}

export function mockProvisioningApi(server: SetupServer) {
  return {
    exportRuleGroup: (folderUid: string, groupName: string, response: Record<string, string>) => {
      server.use(
        rest.get(`/api/v1/provisioning/folder/${folderUid}/rule-groups/${groupName}/export`, (req, res, ctx) =>
          res(ctx.status(200), ctx.text(response[req.url.searchParams.get('format') ?? 'yaml']))
        )
      );
    },
    exportReceiver: (receiverName: string, decrypt: string, response: Record<string, string>) => {
      server.use(
        rest.get(`/api/v1/provisioning/contact-points/export/`, (req, res, ctx) =>
          res(ctx.status(200), ctx.text(response[req.url.searchParams.get('format') ?? 'yaml']))
        )
      );
    },
  };
}

export function mockFolderApi(server: SetupServer) {
  return {
    folder: (folderUid: string, response: FolderDTO) => {
      server.use(rest.get(`/api/folders/${folderUid}`, (_, res, ctx) => res(ctx.status(200), ctx.json(response))));
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
