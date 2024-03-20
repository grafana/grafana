import 'whatwg-fetch';
import { uniqueId } from 'lodash';
import { http, HttpResponse } from 'msw';
import { setupServer, SetupServer } from 'msw/node';

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
import { DashboardDTO, FolderDTO, NotifierDTO } from '../../../types';
import { DashboardSearchItem } from '../../search/types';

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
    if (this.grafanaReceiverConfig.settings) {
      this.grafanaReceiverConfig.settings[key] = value;
    }
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
        http.get(`api/alertmanager/${amName}/config/api/v1/alerts`, () =>
          HttpResponse.json<AlertManagerCortexConfig>({
            alertmanager_config: builder.build(),
            template_files: {},
          })
        )
      );
    },

    eval: (response: AlertingQueryResponse) => {
      server.use(
        http.post('/api/v1/eval', () => {
          return HttpResponse.json(response);
        })
      );
    },
    grafanaNotifiers: (response: NotifierDTO[]) => {
      server.use(http.get(`api/alert-notifiers`, () => HttpResponse.json(response)));
    },

    plugins: {
      getPluginSettings: (response: PluginMeta) => {
        server.use(http.get(`api/plugins/${response.id}/settings`, () => HttpResponse.json(response)));
      },
    },

    oncall: {
      getOnCallIntegrations: (response: OnCallIntegrationDTO[]) => {
        server.use(
          http.get(`api/plugin-proxy/grafana-oncall-app/api/internal/v1/alert_receive_channels`, () =>
            HttpResponse.json<OnCallIntegrationDTO[]>(response)
          )
        );
      },
      features: (response: string[]) => {
        server.use(
          http.get(`api/plugin-proxy/grafana-oncall-app/api/internal/v1/features`, () => HttpResponse.json(response))
        );
      },
      validateIntegrationName: (invalidNames: string[]) => {
        server.use(
          http.get(
            `api/plugin-proxy/grafana-oncall-app/api/internal/v1/alert_receive_channels/validate_name`,
            ({ request }) => {
              const url = new URL(request.url);
              const isValid = !invalidNames.includes(url.searchParams.get('verbal_name') ?? '');
              return HttpResponse.json(isValid, {
                status: isValid ? 200 : 409,
              });
            }
          )
        );
      },
      createIntegraion: () => {
        server.use(
          http.post<{}, CreateIntegrationDTO>(
            `api/plugin-proxy/grafana-oncall-app/api/internal/v1/alert_receive_channels`,
            async ({ request }) => {
              const body = await request.json();
              const integrationId = uniqueId('oncall-integration-');

              return HttpResponse.json<NewOnCallIntegrationDTO>({
                id: integrationId,
                integration: body.integration,
                integration_url: `https://oncall-endpoint.example.com/${integrationId}`,
                verbal_name: body.verbal_name,
                connected_escalations_chains_count: 0,
              });
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
        http.get(`api/prometheus/${dsName}/api/v1/rules`, () => HttpResponse.json<PromRulesResponse>(response))
      );
    },
    rulerRules: (dsName: string, response: RulerRulesConfigDTO) => {
      server.use(http.get(`/api/ruler/${dsName}/api/v1/rules`, () => HttpResponse.json(response)));
    },
    rulerRuleGroup: (dsName: string, namespace: string, group: string, response: RulerRuleGroupDTO) => {
      server.use(
        http.get(`/api/ruler/${dsName}/api/v1/rules/${namespace}/${group}`, () => HttpResponse.json(response))
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
      server.use(http.get(`${dsSettings.url}/api/v1/status/buildinfo`, () => HttpResponse.json(response)));
    },
  };
}

export function mockProvisioningApi(server: SetupServer) {
  return {
    exportRuleGroup: (folderUid: string, groupName: string, response: Record<string, string>) => {
      server.use(
        http.get(`/api/v1/provisioning/folder/${folderUid}/rule-groups/${groupName}/export`, ({ request }) => {
          const url = new URL(request.url);
          const format = url.searchParams.get('format') ?? 'yaml';
          return HttpResponse.text(response[format]);
        })
      );
    },
    exportReceiver: (response: Record<string, string>) => {
      server.use(
        http.get(`/api/v1/provisioning/contact-points/export/`, ({ request }) => {
          const url = new URL(request.url);
          const format = url.searchParams.get('format') ?? 'yaml';
          return HttpResponse.text(response[format]);
        })
      );
    },
  };
}

export function mockExportApi(server: SetupServer) {
  // exportRule, exportRulesGroup, exportRulesFolder use the same API endpoint but with different parameters
  return {
    // exportRule requires ruleUid parameter and doesn't allow folderUid and group parameters
    exportRule: (ruleUid: string, response: Record<string, string>) => {
      server.use(
        http.get('/api/ruler/grafana/api/v1/export/rules', ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('ruleUid') === ruleUid) {
            const format = url.searchParams.get('format') ?? 'yaml';
            return HttpResponse.text(response[format]);
          }

          return HttpResponse.text('', { status: 500 });
        })
      );
    },
    // exportRulesGroup requires folderUid and group parameters and doesn't allow ruleUid parameter
    exportRulesGroup: (folderUid: string, group: string, response: Record<string, string>) => {
      server.use(
        http.get('/api/ruler/grafana/api/v1/export/rules', ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('folderUid') === folderUid && url.searchParams.get('group') === group) {
            const format = url.searchParams.get('format') ?? 'yaml';
            return HttpResponse.text(response[format]);
          }

          return HttpResponse.text('', { status: 500 });
        })
      );
    },
    // exportRulesFolder requires folderUid parameter
    exportRulesFolder: (folderUid: string, response: Record<string, string>) => {
      server.use(
        http.get('/api/ruler/grafana/api/v1/export/rules', ({ request }) => {
          const url = new URL(request.url);
          if (url.searchParams.get('folderUid') === folderUid) {
            const format = url.searchParams.get('format') ?? 'yaml';
            return HttpResponse.text(response[format]);
          }

          return HttpResponse.text('', { status: 500 });
        })
      );
    },
    modifiedExport: (namespaceUID: string, response: Record<string, string>) => {
      server.use(
        http.post(`/api/ruler/grafana/api/v1/rules/${namespaceUID}/export`, ({ request }) => {
          const url = new URL(request.url);
          const format = url.searchParams.get('format') ?? 'yaml';
          return HttpResponse.text(response[format]);
        })
      );
    },
  };
}

export function mockFolderApi(server: SetupServer) {
  return {
    folder: (folderUid: string, response: FolderDTO) => {
      server.use(http.get(`/api/folders/${folderUid}`, () => HttpResponse.json(response)));
    },
  };
}

export function mockSearchApi(server: SetupServer) {
  return {
    search: (results: DashboardSearchItem[]) => {
      server.use(http.get(`/api/search`, () => HttpResponse.json(results)));
    },
  };
}

export function mockDashboardApi(server: SetupServer) {
  return {
    search: (results: DashboardSearchItem[]) => {
      server.use(http.get(`/api/search`, () => HttpResponse.json(results)));
    },
    dashboard: (response: DashboardDTO) => {
      server.use(http.get(`/api/dashboards/uid/${response.dashboard.uid}`, () => HttpResponse.json(response)));
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

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  return server;
}
