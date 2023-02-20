import produce from 'immer';

import {
  DataSourceApi,
  DataSourceInstanceSettings,
  DataSourceJsonData,
  DataSourcePluginMeta,
  DataSourceRef,
  ScopedVars,
} from '@grafana/data';
import { config, DataSourceSrv, GetDataSourceListFilters } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { DatasourceSrv } from 'app/features/plugins/datasource_srv';
import {
  AlertmanagerAlert,
  AlertManagerCortexConfig,
  AlertmanagerGroup,
  AlertmanagerStatus,
  AlertState,
  GrafanaManagedReceiverConfig,
  Silence,
  SilenceState,
} from 'app/plugins/datasource/alertmanager/types';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction, FolderDTO, StoreState } from 'app/types';
import {
  Alert,
  AlertingRule,
  CombinedRule,
  CombinedRuleGroup,
  CombinedRuleNamespace,
  RecordingRule,
  RuleGroup,
  RuleNamespace,
} from 'app/types/unified-alerting';
import {
  AlertQuery,
  GrafanaAlertStateDecision,
  GrafanaRuleDefinition,
  PromAlertingRuleState,
  PromRuleType,
  RulerAlertingRuleDTO,
  RulerGrafanaRuleDTO,
  RulerRecordingRuleDTO,
  RulerRuleGroupDTO,
  RulerRulesConfigDTO,
} from 'app/types/unified-alerting-dto';

let nextDataSourceId = 1;

export function mockDataSource<T extends DataSourceJsonData = DataSourceJsonData>(
  partial: Partial<DataSourceInstanceSettings<T>> = {},
  meta: Partial<DataSourcePluginMeta> = {}
): DataSourceInstanceSettings<T> {
  const id = partial.id ?? nextDataSourceId++;

  return {
    id,
    uid: `mock-ds-${nextDataSourceId}`,
    type: 'prometheus',
    name: `Prometheus-${id}`,
    access: 'proxy',
    jsonData: {} as T,
    meta: {
      info: {
        logos: {
          small: 'https://prometheus.io/assets/prometheus_logo_grey.svg',
          large: 'https://prometheus.io/assets/prometheus_logo_grey.svg',
        },
      },
      ...meta,
    } as unknown as DataSourcePluginMeta,
    readOnly: false,
    ...partial,
  };
}

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

export const mockRulerGrafanaRule = (
  partial: Partial<RulerGrafanaRuleDTO> = {},
  partialDef: Partial<GrafanaRuleDefinition> = {}
): RulerGrafanaRuleDTO => {
  return {
    for: '1m',
    grafana_alert: {
      uid: '123',
      title: 'myalert',
      namespace_uid: '123',
      namespace_id: 1,
      condition: 'A',
      no_data_state: GrafanaAlertStateDecision.Alerting,
      exec_err_state: GrafanaAlertStateDecision.Alerting,
      data: [
        {
          datasourceUid: '123',
          refId: 'A',
          queryType: 'huh',
          model: {} as any,
        },
      ],
      ...partialDef,
    },
    annotations: {
      message: 'alert with severity "{{.warning}}}"',
    },
    labels: {
      severity: 'warning',
    },
    ...partial,
  };
};

export const mockRulerAlertingRule = (partial: Partial<RulerAlertingRuleDTO> = {}): RulerAlertingRuleDTO => ({
  alert: 'alert1',
  expr: 'up = 1',
  labels: {
    severity: 'warning',
  },
  annotations: {
    summary: 'test alert',
  },
  ...partial,
});

export const mockRulerRecordingRule = (partial: Partial<RulerRecordingRuleDTO> = {}): RulerAlertingRuleDTO => ({
  alert: 'alert1',
  expr: 'up = 1',
  labels: {
    severity: 'warning',
  },
  annotations: {
    summary: 'test alert',
  },
  ...partial,
});

export const mockRulerRuleGroup = (partial: Partial<RulerRuleGroupDTO> = {}): RulerRuleGroupDTO => ({
  name: 'group1',
  rules: [mockRulerAlertingRule()],
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

export const mockGrafanaRulerRule = (partial: Partial<RulerGrafanaRuleDTO> = {}): RulerGrafanaRuleDTO => {
  return {
    for: '',
    annotations: {},
    labels: {},
    grafana_alert: {
      ...partial,
      uid: '',
      title: 'my rule',
      namespace_uid: '',
      namespace_id: 0,
      condition: '',
      no_data_state: GrafanaAlertStateDecision.NoData,
      exec_err_state: GrafanaAlertStateDecision.Error,
      data: [],
    },
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

export const mockAlertmanagerAlert = (partial: Partial<AlertmanagerAlert> = {}): AlertmanagerAlert => {
  return {
    annotations: {
      summary: 'US-Central region is on fire',
    },
    endsAt: '2021-06-22T21:49:28.562Z',
    fingerprint: '88e013643c3df34ac3',
    receivers: [{ name: 'pagerduty' }],
    startsAt: '2021-06-21T17:25:28.562Z',
    status: { inhibitedBy: [], silencedBy: [], state: AlertState.Active },
    updatedAt: '2021-06-22T21:45:28.564Z',
    generatorURL: 'https://play.grafana.com/explore',
    labels: { severity: 'warning', region: 'US-Central' },
    ...partial,
  };
};

export const mockAlertGroup = (partial: Partial<AlertmanagerGroup> = {}): AlertmanagerGroup => {
  return {
    labels: {
      severity: 'warning',
      region: 'US-Central',
    },
    receiver: {
      name: 'pagerduty',
    },
    alerts: [
      mockAlertmanagerAlert(),
      mockAlertmanagerAlert({
        status: { state: AlertState.Suppressed, silencedBy: ['123456abcdef'], inhibitedBy: [] },
        labels: { severity: 'warning', region: 'US-Central', foo: 'bar', ...partial.labels },
      }),
    ],
    ...partial,
  };
};

export const mockSilence = (partial: Partial<Silence> = {}): Silence => {
  return {
    id: '1a2b3c4d5e6f',
    matchers: [{ name: 'foo', value: 'bar', isEqual: true, isRegex: false }],
    startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: config.bootData.user.name || 'admin',
    comment: 'Silence noisy alerts',
    status: {
      state: SilenceState.Active,
    },
    ...partial,
  };
};

export class MockDataSourceSrv implements DataSourceSrv {
  datasources: Record<string, DataSourceApi> = {};
  // @ts-ignore
  private settingsMapByName: Record<string, DataSourceInstanceSettings> = {};
  private settingsMapByUid: Record<string, DataSourceInstanceSettings> = {};
  private settingsMapById: Record<string, DataSourceInstanceSettings> = {};
  // @ts-ignore
  private templateSrv = {
    getVariables: () => [],
    replace: (name: any) => name,
  };

  defaultName = '';

  constructor(datasources: Record<string, DataSourceInstanceSettings>) {
    this.datasources = {};
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
      if (dsSettings.isDefault) {
        this.defaultName = dsSettings.name;
      }
    }
  }

  get(name?: string | null | DataSourceRef, scopedVars?: ScopedVars): Promise<DataSourceApi> {
    return DatasourceSrv.prototype.get.call(this, name, scopedVars);
    //return Promise.reject(new Error('not implemented'));
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
      ({ meta: { info: { logos: {} } } } as unknown as DataSourceInstanceSettings)
    );
  }

  async loadDatasource(name: string): Promise<DataSourceApi<any, any>> {
    return DatasourceSrv.prototype.loadDatasource.call(this, name);
  }

  reload() {}
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

export const somePromRules = (dataSourceName = 'Prometheus'): RuleNamespace[] => [
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
export const someRulerRules: RulerRulesConfigDTO = {
  namespace1: [
    mockRulerRuleGroup({ name: 'group1', rules: [mockRulerAlertingRule({ alert: 'alert1' })] }),
    mockRulerRuleGroup({ name: 'group2', rules: [mockRulerAlertingRule({ alert: 'alert2' })] }),
  ],
  namespace2: [mockRulerRuleGroup({ name: 'group3', rules: [mockRulerAlertingRule({ alert: 'alert3' })] })],
};

export const mockCombinedRule = (partial?: Partial<CombinedRule>): CombinedRule => ({
  name: 'mockRule',
  query: 'expr',
  group: {
    name: 'mockCombinedRuleGroup',
    rules: [],
  },
  namespace: {
    name: 'mockCombinedNamespace',
    groups: [{ name: 'mockCombinedRuleGroup', rules: [] }],
    rulesSource: 'grafana',
  },
  labels: {},
  annotations: {},
  promRule: mockPromAlertingRule(),
  rulerRule: mockRulerAlertingRule(),
  ...partial,
});

export const mockFolder = (partial?: Partial<FolderDTO>): FolderDTO => {
  return {
    id: 1,
    uid: 'gdev-1',
    title: 'Gdev',
    version: 1,
    url: '',
    canAdmin: true,
    canDelete: true,
    canEdit: true,
    canSave: true,
    ...partial,
  };
};

export const enableRBAC = () => {
  jest.spyOn(contextSrv, 'accessControlEnabled').mockReturnValue(true);
};

export const disableRBAC = () => {
  jest.spyOn(contextSrv, 'accessControlEnabled').mockReturnValue(false);
};

export const grantUserPermissions = (permissions: AccessControlAction[]) => {
  jest
    .spyOn(contextSrv, 'hasPermission')
    .mockImplementation((action) => permissions.includes(action as AccessControlAction));
};

export function mockDataSourcesStore(partial?: Partial<StoreState['dataSources']>) {
  const defaultState = configureStore().getState();
  const store = configureStore({
    ...defaultState,
    dataSources: {
      ...defaultState.dataSources,
      ...partial,
    },
  });

  return store;
}

export function mockUnifiedAlertingStore(unifiedAlerting?: Partial<StoreState['unifiedAlerting']>) {
  const defaultState = configureStore().getState();

  return configureStore({
    ...defaultState,
    unifiedAlerting: {
      ...defaultState.unifiedAlerting,
      ...unifiedAlerting,
    },
  });
}

export function mockStore(recipe: (state: StoreState) => void) {
  const defaultState = configureStore().getState();

  return configureStore(produce(defaultState, recipe));
}

export function mockAlertQuery(query: Partial<AlertQuery>): AlertQuery {
  return {
    datasourceUid: '--uid--',
    refId: 'A',
    queryType: '',
    model: { refId: 'A' },
    ...query,
  };
}

export function mockCombinedRuleGroup(name: string, rules: CombinedRule[]): CombinedRuleGroup {
  return { name, rules };
}

export function mockCombinedRuleNamespace(namespace: Partial<CombinedRuleNamespace>): CombinedRuleNamespace {
  return {
    name: 'Grafana',
    groups: [],
    rulesSource: 'grafana',
    ...namespace,
  };
}

export function getGrafanaRule(override?: Partial<CombinedRule>) {
  return mockCombinedRule({
    namespace: {
      groups: [],
      name: 'Grafana',
      rulesSource: 'grafana',
    },
    rulerRule: mockGrafanaRulerRule(),
    ...override,
  });
}
export function getCloudRule(override?: Partial<CombinedRule>) {
  return mockCombinedRule({
    namespace: {
      groups: [],
      name: 'Cortex',
      rulesSource: mockDataSource(),
    },
    promRule: mockPromAlertingRule(),
    rulerRule: mockRulerAlertingRule(),
    ...override,
  });
}
