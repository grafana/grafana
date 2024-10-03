import { http, HttpResponse } from 'msw';
import { setupServer, SetupServer } from 'msw/node';

import { DataSourceInstanceSettings } from '@grafana/data';
import { setBackendSrv } from '@grafana/runtime';
import { AlertGroupUpdated } from 'app/features/alerting/unified/api/alertRuleApi';
import allHandlers from 'app/features/alerting/unified/mocks/server/all-handlers';
import { DashboardDTO, FolderDTO, OrgUser } from 'app/types';
import {
  PromBuildInfoResponse,
  PromRulesResponse,
  RulerGrafanaRuleDTO,
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
import { DashboardSearchItem } from '../../search/types';

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

export class AlertmanagerReceiverBuilder {
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
    updateRule: (dsName: string, response: AlertGroupUpdated) => {
      server.use(http.post(`/api/ruler/${dsName}/api/v1/rules/:namespaceUid`, () => HttpResponse.json(response)));
    },
    rulerRuleGroup: (dsName: string, namespace: string, group: string, response: RulerRuleGroupDTO) => {
      server.use(
        http.get(`/api/ruler/${dsName}/api/v1/rules/${namespace}/${group}`, () => HttpResponse.json(response))
      );
    },
    getAlertRule: (uid: string, response: RulerGrafanaRuleDTO) => {
      server.use(http.get(`/api/ruler/grafana/api/v1/rule/${uid}`, () => HttpResponse.json(response)));
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

export function mockExportApi(server: SetupServer) {
  // exportRule, exportRulesGroup, exportRulesFolder use the same API endpoint but with different parameters
  return {
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

export function mockUserApi(server: SetupServer) {
  return {
    user: (user: OrgUser) => {
      server.use(http.get(`/api/user`, () => HttpResponse.json(user)));
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

const server = setupServer(...allHandlers);

/**
 * Sets up beforeAll, afterAll and beforeEach handlers for mock server
 */
export function setupMswServer() {
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

export default server;
