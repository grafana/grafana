import { HttpResponse, http } from 'msw';
import { type SetupServer } from 'msw/node';

import { type DashboardHit } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { setBackendSrv } from '@grafana/runtime';
import { getCustomSearchHandler } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import allHandlers from 'app/features/alerting/unified/mocks/server/all-handlers';
import {
  setupAlertmanagerConfigMapDefaultState,
  setupAlertmanagerStatusMapDefaultState,
} from 'app/features/alerting/unified/mocks/server/entities/alertmanagers';
import { resetRoutingTreeMap } from 'app/features/alerting/unified/mocks/server/entities/k8s/routingtrees';
import { resetHistorianState } from 'app/features/alerting/unified/mocks/server/handlers/historian';
import { resetUserStorage } from 'app/features/alerting/unified/mocks/server/handlers/userStorage';
import { type DashboardDTO } from 'app/types/dashboard';
import { type FolderDTO } from 'app/types/folders';
import {
  type PromRulesResponse,
  type RulerGrafanaRuleDTO,
  type RulerRuleGroupDTO,
  type RulerRulesConfigDTO,
} from 'app/types/unified-alerting-dto';

import { backendSrv } from '../../../core/services/backend_srv';
import {
  type AlertManagerCortexConfig,
  type AlertmanagerConfig,
  type AlertmanagerReceiver,
  type EmailConfig,
  type GrafanaManagedReceiverConfig,
  type MatcherOperator,
  type Route,
} from '../../../plugins/datasource/alertmanager/types';
import { type DashboardSearchItem, DashboardSearchItemType } from '../../search/types';

import { type RulerGroupUpdatedResponse } from './api/alertRuleModel';

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

export const getMockConfig = (configure: (builder: AlertmanagerConfigBuilder) => void): AlertManagerCortexConfig => {
  const builder = new AlertmanagerConfigBuilder();
  configure(builder);
  return { alertmanager_config: builder.build(), template_files: {} };
};

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
    updateRule: (dsName: string, response: RulerGroupUpdatedResponse) => {
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
    getAlertRuleVersionHistory: (uid: string, response: RulerGrafanaRuleDTO[]) => {
      server.use(http.get(`/api/ruler/grafana/api/v1/rule/${uid}/versions`, () => HttpResponse.json(response)));
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

export function mockDashboardApi(server: SetupServer) {
  return {
    search: (results: DashboardSearchItem[]) => {
      const dashboards: DashboardHit[] = results
        .filter((item) => item.type !== DashboardSearchItemType.DashFolder)
        .map((item) => ({
          resource: 'dashboards',
          name: item.uid || item.title,
          title: item.title,
          folder: item.folderUid,
          field: {},
        }));

      const explicitFolders: DashboardHit[] = results
        .filter((item) => item.type === DashboardSearchItemType.DashFolder)
        .map((item) => ({
          resource: 'folders',
          name: item.uid || item.title,
          title: item.title,
          field: {},
        }));

      // We have to make sure we have the parent folders for the dashboards that have folderUid.
      const derivedFolders = new Map<string, DashboardHit>();
      for (const item of results) {
        if (!item.folderUid || !item.folderTitle) {
          continue;
        }

        derivedFolders.set(item.folderUid, {
          resource: 'folders',
          name: item.folderUid,
          title: item.folderTitle,
          field: {},
        });
      }

      const folderHits = [...explicitFolders, ...derivedFolders.values()].filter(
        (hit, index, hits) => hits.findIndex((candidate) => candidate.name === hit.name) === index
      );

      server.use(
        http.get(`/api/search`, () => HttpResponse.json(results)),
        getCustomSearchHandler([...folderHits, ...dashboards])
      );
    },
    dashboard: (response: DashboardDTO) => {
      server.use(http.get(`/api/dashboards/uid/${response.dashboard.uid}`, () => HttpResponse.json(response)));
    },
  };
}

export function setupBackendSrv() {
  setBackendSrv(backendSrv);
}

/**
 * Sets up MSW server with additional handlers for Alerting tests
 */
export function setupMswServer() {
  setupMockServer(allHandlers);

  beforeAll(() => {
    setupBackendSrv();
  });

  afterEach(() => {
    // Reset any other necessary mock entities/state
    setupAlertmanagerConfigMapDefaultState();
    setupAlertmanagerStatusMapDefaultState();
    resetRoutingTreeMap();
    resetUserStorage();
    resetHistorianState();
  });

  return server;
}
