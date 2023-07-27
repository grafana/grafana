import { uniqueId } from 'lodash';
import { rest } from 'msw';
import { setupServer, SetupServer } from 'msw/node';
import 'whatwg-fetch';

import { PluginMeta } from '@grafana/data';
import { setBackendSrv } from '@grafana/runtime';

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
import { NotifierDTO } from '../../../types';

import { CreateIntegrationDTO, NewOnCallIntegrationDTO } from './api/onCallApi';

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
      getOnCallIntegrations: (builders: Array<(builder: OnCallIntegrationBuilder) => void>) => {
        const integrations = builders.map((builder) => {
          const integrationBuilder = new OnCallIntegrationBuilder();
          builder(integrationBuilder);
          return integrationBuilder.build();
        });

        server.use(
          rest.get(`api/plugin-proxy/grafana-oncall-app/api/internal/v1/alert_receive_channels`, (_, res, ctx) =>
            res(ctx.status(200), ctx.json<NewOnCallIntegrationDTO[]>(integrations))
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
