import { DataSourceApi, DataSourceInstanceSettings, DataSourcePluginMeta, ScopedVars } from '@grafana/data';
import { PromAlertingRuleState, PromRuleType } from 'app/types/unified-alerting-dto';
import { AlertingRule, Alert, RecordingRule, RuleGroup, RuleNamespace } from 'app/types/unified-alerting';
import DatasourceSrv from 'app/features/plugins/datasource_srv';
import { DataSourceSrv, GetDataSourceListFilters } from '@grafana/runtime';
import {
  AlertManagerCortexConfig,
  AlertmanagerStatus,
  GrafanaManagedReceiverConfig,
} from 'app/plugins/datasource/alertmanager/types';

let nextDataSourceId = 1;

export const mockDataSource = (partial: Partial<DataSourceInstanceSettings> = {}): DataSourceInstanceSettings => {
  const id = partial.id ?? nextDataSourceId++;

  return {
    id,
    uid: `mock-ds-${nextDataSourceId}`,
    type: 'prometheus',
    name: `Prometheus-${id}`,
    jsonData: {},
    meta: ({
      info: {
        logos: {
          small: 'https://prometheus.io/assets/prometheus_logo_grey.svg',
          large: 'https://prometheus.io/assets/prometheus_logo_grey.svg',
        },
      },
    } as any) as DataSourcePluginMeta,
    ...partial,
  };
};

export const mockPromAlert = (partial: Partial<Alert> = {}): Alert => ({
  activeAt: '2021-03-18T13:47:05.04938691Z',
  annotations: {
    message: 'alert with severity "warning"',
  },
  labels: {
    alertname: 'myalert',
    severity: 'warning',
  },
  state: PromAlertingRuleState.Firing,
  value: '1e+00',
  ...partial,
});

export const mockPromAlertingRule = (partial: Partial<AlertingRule> = {}): AlertingRule => {
  return {
    type: PromRuleType.Alerting,
    alerts: [mockPromAlert()],
    name: 'myalert',
    query: 'foo > 1',
    lastEvaluation: '2021-03-23T08:19:05.049595312Z',
    evaluationTime: 0.000395601,
    annotations: {
      message: 'alert with severity "{{.warning}}}"',
    },
    labels: {
      severity: 'warning',
    },
    state: PromAlertingRuleState.Firing,
    health: 'OK',
    ...partial,
  };
};

export const mockPromRecordingRule = (partial: Partial<RecordingRule> = {}): RecordingRule => {
  return {
    type: PromRuleType.Recording,
    query: 'bar < 3',
    labels: {
      cluster: 'eu-central',
    },
    health: 'OK',
    name: 'myrecordingrule',
    lastEvaluation: '2021-03-23T08:19:05.049595312Z',
    evaluationTime: 0.000395601,
    ...partial,
  };
};

export const mockPromRuleGroup = (partial: Partial<RuleGroup> = {}): RuleGroup => {
  return {
    name: 'mygroup',
    interval: 60,
    rules: [mockPromAlertingRule()],
    ...partial,
  };
};

export const mockPromRuleNamespace = (partial: Partial<RuleNamespace> = {}): RuleNamespace => {
  return {
    dataSourceName: 'Prometheus-1',
    name: 'default',
    groups: [mockPromRuleGroup()],
    ...partial,
  };
};

export class MockDataSourceSrv implements DataSourceSrv {
  // @ts-ignore
  private settingsMapByName: Record<string, DataSourceInstanceSettings> = {};
  private settingsMapByUid: Record<string, DataSourceInstanceSettings> = {};
  private settingsMapById: Record<string, DataSourceInstanceSettings> = {};
  // @ts-ignore
  private templateSrv = {
    getVariables: () => [],
    replace: (name: any) => name,
  };

  constructor(datasources: Record<string, DataSourceInstanceSettings>) {
    this.settingsMapByName = Object.values(datasources).reduce<Record<string, DataSourceInstanceSettings>>(
      (acc, ds) => {
        acc[ds.name] = ds;
        return acc;
      },
      {}
    );
    for (const dsSettings of Object.values(this.settingsMapByName)) {
      this.settingsMapByUid[dsSettings.uid] = dsSettings;
      this.settingsMapById[dsSettings.id] = dsSettings;
    }
  }

  get(name?: string | null, scopedVars?: ScopedVars): Promise<DataSourceApi> {
    return Promise.reject(new Error('not implemented'));
  }

  /**
   * Get a list of data sources
   */
  getList(filters?: GetDataSourceListFilters): DataSourceInstanceSettings[] {
    return DatasourceSrv.prototype.getList.call(this, filters);
  }

  /**
   * Get settings and plugin metadata by name or uid
   */
  getInstanceSettings(nameOrUid: string | null | undefined): DataSourceInstanceSettings | undefined {
    return (
      DatasourceSrv.prototype.getInstanceSettings.call(this, nameOrUid) ||
      (({ meta: { info: { logos: {} } } } as unknown) as DataSourceInstanceSettings)
    );
  }
}

export const mockGrafanaReceiver = (
  type: string,
  overrides: Partial<GrafanaManagedReceiverConfig> = {}
): GrafanaManagedReceiverConfig => ({
  type: type,
  name: type,
  disableResolveMessage: false,
  settings: {},
  ...overrides,
});

export const someGrafanaAlertManagerConfig: AlertManagerCortexConfig = {
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

export const someCloudAlertManagerStatus: AlertmanagerStatus = {
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

export const someCloudAlertManagerConfig: AlertManagerCortexConfig = {
  template_files: {
    'foo template': 'foo content',
  },
  alertmanager_config: {
    route: {
      receiver: 'cloud-receiver',
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
