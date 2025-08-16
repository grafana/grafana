import { produce } from 'immer';
import { isEmpty, pick } from 'lodash';

import {
  DataSourceInstanceSettings,
  DataSourceJsonData,
  DataSourcePluginMeta,
  PluginExtensionLink,
  PluginExtensionTypes,
  ReducerID,
} from '@grafana/data';
import { DataQuery, defaultDashboard } from '@grafana/schema';
import { contextSrv } from 'app/core/services/context_srv';
import { MOCK_GRAFANA_ALERT_RULE_TITLE } from 'app/features/alerting/unified/mocks/server/handlers/grafanaRuler';
import { ExpressionQuery, ExpressionQueryType, ReducerMode } from 'app/features/expressions/types';
import {
  AlertManagerCortexConfig,
  AlertState,
  AlertmanagerAlert,
  AlertmanagerGroup,
  AlertmanagerStatus,
  GrafanaManagedReceiverConfig,
  MatcherOperator,
  Silence,
  SilenceState,
} from 'app/plugins/datasource/alertmanager/types';
import { configureStore } from 'app/store/configureStore';
import { AccessControlAction } from 'app/types/accessControl';
import { NotifiersState, ReceiversState } from 'app/types/alerting';
import { DashboardDTO } from 'app/types/dashboard';
import { FolderDTO } from 'app/types/folders';
import { StoreState } from 'app/types/store';
import {
  Alert,
  AlertingRule,
  CombinedRule,
  CombinedRuleGroup,
  CombinedRuleNamespace,
  RecordingRule,
  RuleGroup,
  RuleNamespace,
  RuleWithLocation,
} from 'app/types/unified-alerting';
import {
  AlertDataQuery,
  AlertQuery,
  GrafanaAlertState,
  GrafanaAlertStateDecision,
  GrafanaPromAlertingRuleDTO,
  GrafanaRuleDefinition,
  PromAlertingRuleState,
  PromRuleType,
  RulerAlertingRuleDTO,
  RulerGrafanaRuleDTO,
  RulerRecordingRuleDTO,
  RulerRuleDTO,
  RulerRuleGroupDTO,
  RulerRulesConfigDTO,
} from 'app/types/unified-alerting-dto';

import { DashboardSearchItem, DashboardSearchItemType } from '../../search/types';

import { GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';
import { parsePromQLStyleMatcherLooseSafe } from './utils/matchers';

let nextDataSourceId = 1;

export function mockDataSource<T extends DataSourceJsonData = DataSourceJsonData>(
  partial: Partial<DataSourceInstanceSettings<T>> = {},
  meta: Partial<DataSourcePluginMeta> = {}
): DataSourceInstanceSettings<T> {
  const id = partial.id ?? nextDataSourceId++;

  const uid = partial.uid ?? `mock-ds-${nextDataSourceId}`;

  return {
    id,
    uid,
    type: 'prometheus',
    name: `Prometheus-${id}`,
    access: 'proxy',
    url: `/api/datasources/proxy/uid/${uid}`,
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
      rule_group: 'my-group',
      condition: 'A',
      no_data_state: GrafanaAlertStateDecision.Alerting,
      exec_err_state: GrafanaAlertStateDecision.Alerting,
      data: [
        {
          datasourceUid: '123',
          refId: 'A',
          queryType: 'huh',
          model: {} as unknown as DataQuery,
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
export const mockRulerGrafanaRecordingRule = (
  partial: Partial<RulerGrafanaRuleDTO> = {},
  partialDef: Partial<GrafanaRuleDefinition> = {}
): RulerGrafanaRuleDTO => {
  return {
    grafana_alert: {
      uid: '123',
      title: 'myalert',
      namespace_uid: '123',
      rule_group: 'my-group',
      condition: 'A',
      record: {
        metric: 'myalert',
        from: 'A',
      },
      data: [
        {
          datasourceUid: '123',
          refId: 'A',
          queryType: 'huh',
          model: {
            refId: '',
          },
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

export const mockRulerRecordingRule = (partial: Partial<RulerRecordingRuleDTO> = {}): RulerRecordingRuleDTO => ({
  record: 'alert1',
  expr: 'up = 1',
  labels: {
    severity: 'warning',
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
    totalsFiltered: { alerting: 1 },
    ...partial,
  };
};

export const mockGrafanaPromAlertingRule = (
  partial: Partial<GrafanaPromAlertingRuleDTO> = {}
): GrafanaPromAlertingRuleDTO => {
  return {
    ...mockPromAlertingRule(),
    uid: 'mock-rule-uid-123',
    folderUid: 'NAMESPACE_UID',
    isPaused: false,
    totals: { alerting: 1 },
    totalsFiltered: { alerting: 1 },
    ...partial,
  };
};

export const mockGrafanaRulerRule = (partial: Partial<GrafanaRuleDefinition> = {}): RulerGrafanaRuleDTO => {
  return {
    for: '',
    annotations: {},
    labels: {},
    grafana_alert: {
      uid: 'mock-rule-uid-123',
      title: 'my rule',
      namespace_uid: 'NAMESPACE_UID',
      rule_group: 'my-group',
      condition: '',
      no_data_state: GrafanaAlertStateDecision.NoData,
      exec_err_state: GrafanaAlertStateDecision.Error,
      data: [],
      ...partial,
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
    createdBy: contextSrv.user.name || 'admin',
    comment: 'Silence noisy alerts',
    status: {
      state: SilenceState.Active,
    },
    accessControl: {
      create: true,
      read: true,
      write: true,
    },
    ...partial,
  };
};

export const MOCK_SILENCE_ID_EXISTING = 'f209e273-0e4e-434f-9f66-e72f092025a2';
export const MOCK_SILENCE_ID_EXISTING_ALERT_RULE_UID = '5f7d08cd-ac62-432e-8449-8c20c95c19b6';
export const MOCK_SILENCE_ID_EXPIRED = '145884a8-ee20-4864-9f84-661305fb7d82';
export const MOCK_SILENCE_ID_LACKING_PERMISSIONS = '31063317-f0d2-4d98-baf3-ec9febc1fa83';

export const mockSilences = [
  mockSilence({ id: MOCK_SILENCE_ID_EXISTING, comment: 'Happy path silence' }),
  mockSilence({
    id: 'ce031625-61c7-47cd-9beb-8760bccf0ed7',
    matchers: parsePromQLStyleMatcherLooseSafe('foo!=bar'),
    comment: 'Silence with negated matcher',
  }),
  mockSilence({
    id: MOCK_SILENCE_ID_EXISTING_ALERT_RULE_UID,
    matchers: parsePromQLStyleMatcherLooseSafe(`__alert_rule_uid__=${MOCK_SILENCE_ID_EXISTING_ALERT_RULE_UID}`),
    comment: 'Silence with alert rule UID matcher',
    metadata: {
      rule_title: MOCK_GRAFANA_ALERT_RULE_TITLE,
    },
  }),
  mockSilence({
    id: MOCK_SILENCE_ID_LACKING_PERMISSIONS,
    matchers: parsePromQLStyleMatcherLooseSafe('something=else'),
    comment: 'Silence without permissions to edit',
    accessControl: {},
  }),
  mockSilence({
    id: MOCK_SILENCE_ID_EXPIRED,
    status: { state: SilenceState.Expired },
    comment: 'Silence which is expired',
  }),
];

export const mockNotifiersState = (partial: Partial<NotifiersState> = {}): NotifiersState => {
  return {
    email: [
      {
        name: 'email',
        lastNotifyAttempt: new Date().toISOString(),
        lastNotifyAttemptError: 'this is the error message',
        lastNotifyAttemptDuration: '10s',
      },
    ],
    ...partial,
  };
};

export const mockReceiversState = (partial: Partial<ReceiversState> = {}): ReceiversState => {
  return {
    'broken-receiver': {
      active: false,
      errorCount: 1,
      notifiers: mockNotifiersState(),
    },
    ...partial,
  };
};

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

/** @deprecated Move into alertmanager status entities */
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

/** @deprecated Move into alertmanager config entities */
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
    mockRulerRuleGroup({
      name: 'group1',
      rules: [mockRulerAlertingRule({ alert: 'alert1' }), mockRulerAlertingRule({ alert: 'alert1a' })],
    }),
    mockRulerRuleGroup({ name: 'group2', rules: [mockRulerAlertingRule({ alert: 'alert2' })] }),
  ],
  namespace2: [mockRulerRuleGroup({ name: 'group3', rules: [mockRulerAlertingRule({ alert: 'alert3' })] })],
};

export const getPotentiallyPausedRulerRules: (isPaused: boolean) => RulerRulesConfigDTO = (isPaused) => ({
  namespacePaused: [
    mockRulerRuleGroup({
      name: 'groupPaused',
      rules: [mockGrafanaRulerRule({ title: 'paused alert', is_paused: isPaused })],
    }),
  ],
});

export const pausedPromRules = (dataSourceName = 'Prometheus'): RuleNamespace[] => [
  {
    dataSourceName,
    name: 'namespacePaused',
    groups: [mockPromRuleGroup({ name: 'groupPaused', rules: [mockPromAlertingRule({ name: 'paused alert' })] })],
  },
];

export const mockCombinedRule = (partial?: Partial<CombinedRule>): CombinedRule => ({
  name: 'mockRule',
  query: 'expr',
  group: {
    name: 'mockCombinedRuleGroup',
    rules: [],
    totals: {},
  },
  namespace: {
    name: 'mockCombinedNamespace',
    groups: [{ name: 'mockCombinedRuleGroup', rules: [], totals: {} }],
    rulesSource: 'grafana',
  },
  labels: {},
  annotations: {},
  promRule: mockPromAlertingRule(),
  rulerRule: mockRulerAlertingRule(),
  instanceTotals: {},
  filteredInstanceTotals: {},
  ...partial,
});

export const mockRuleWithLocation = (rule: RulerRuleDTO, partial?: Partial<RuleWithLocation>): RuleWithLocation => {
  const ruleWithLocation: RuleWithLocation = {
    rule,
    ...{
      ruleSourceName: 'grafana',
      namespace: 'namespace-1',
      group: mockRulerRuleGroup({
        name: 'group-1',
        rules: [rule],
      }),
    },
    ...partial,
  };

  return ruleWithLocation;
};

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
    created: '',
    createdBy: '',
    hasAcl: false,
    updated: '',
    updatedBy: '',
    ...partial,
  };
};

export const grantUserPermissions = (permissions: AccessControlAction[]) => {
  jest
    .spyOn(contextSrv, 'hasPermission')
    .mockImplementation((action) => permissions.includes(action as AccessControlAction));
};

export const grantUserRole = (role: string) => {
  jest.spyOn(contextSrv, 'hasRole').mockReturnValue(true);
};

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

export function mockAlertQuery(query: Partial<AlertQuery> = {}): AlertQuery {
  return {
    datasourceUid: '--uid--',
    refId: 'A',
    queryType: '',
    model: { refId: 'A' },
    ...query,
  };
}

export function mockCombinedRuleGroup(name: string, rules: CombinedRule[]): CombinedRuleGroup {
  return { name, rules, totals: {} };
}

export function mockCombinedRuleNamespace(namespace: Partial<CombinedRuleNamespace>): CombinedRuleNamespace {
  return {
    name: 'Grafana',
    groups: [],
    rulesSource: 'grafana',
    ...namespace,
  };
}
export function mockCombinedCloudRuleNamespace(
  namespace: Partial<CombinedRuleNamespace>,
  dataSourceName: string
): CombinedRuleNamespace {
  return {
    name: 'Grafana',
    groups: [],
    rulesSource: mockDataSource({ name: dataSourceName, uid: 'Prometheus-1' }),
    ...namespace,
  };
}

export function getGrafanaRule(override?: Partial<CombinedRule>, rulerOverride?: Partial<GrafanaRuleDefinition>) {
  return mockCombinedRule({
    namespace: {
      groups: [],
      name: 'Grafana',
      rulesSource: GRAFANA_RULES_SOURCE_NAME,
    },
    rulerRule: mockGrafanaRulerRule(rulerOverride),
    ...override,
  });
}

export function getCloudRule(override?: Partial<CombinedRule>, nsOverride?: Partial<CombinedRuleNamespace>) {
  const promOverride = pick(override, ['name', 'labels', 'annotations']);
  const rulerOverride = pick(override, ['name', 'labels', 'annotations']);

  return mockCombinedRule({
    namespace: {
      groups: [],
      name: 'Cortex',
      rulesSource: mockDataSource(),
      ...nsOverride,
    },
    promRule: mockPromAlertingRule(isEmpty(promOverride) ? undefined : promOverride),
    rulerRule: mockRulerAlertingRule(
      isEmpty(rulerOverride) ? undefined : { ...rulerOverride, alert: rulerOverride.name }
    ),
    ...override,
  });
}

export function getVanillaPromRule(override?: Partial<Omit<CombinedRule, 'rulerRule'>>) {
  return mockCombinedRule({
    namespace: {
      groups: [],
      name: 'Prometheus',
      rulesSource: mockDataSource(),
    },
    promRule: mockPromAlertingRule(),
    rulerRule: undefined,
    ...override,
  });
}

export function mockPluginLinkExtension(extension: Partial<PluginExtensionLink>): PluginExtensionLink {
  return {
    type: PluginExtensionTypes.link,
    id: 'plugin-id',
    pluginId: 'grafana-test-app',
    title: 'Test plugin link',
    description: 'Test plugin link',
    path: '/test',
    ...extension,
  };
}

export function mockAlertWithState(state: GrafanaAlertState, labels?: {}): Alert {
  return { activeAt: '', annotations: {}, labels: labels || {}, state: state, value: '' };
}

export function mockDashboardSearchItem(searchItem: Partial<DashboardSearchItem>) {
  return {
    title: '',
    uid: '',
    type: DashboardSearchItemType.DashDB,
    url: '',
    uri: '',
    items: [],
    tags: [],
    slug: '',
    isStarred: false,
    ...searchItem,
  };
}

export function mockDashboardDto(
  dashboard: Partial<DashboardDTO['dashboard']>,
  meta?: Partial<DashboardDTO['meta']>
): DashboardDTO {
  return {
    dashboard: {
      uid: 'dashboard-test',
      title: 'Dashboard test',
      schemaVersion: defaultDashboard.schemaVersion,
      ...dashboard,
    },
    meta: { ...meta },
  };
}

export const mockDataQuery = (partial: Partial<AlertDataQuery> = {}): AlertQuery<AlertDataQuery> => ({
  refId: partial?.refId ?? 'A',
  datasourceUid: 'abc123',
  queryType: '',
  model: { refId: 'A', ...partial },
});

export const mockReduceExpression = (partial: Partial<ExpressionQuery> = {}): AlertQuery<ExpressionQuery> => ({
  refId: 'B',
  queryType: 'expression',
  datasourceUid: '__expr__',
  model: {
    type: ExpressionQueryType.reduce,
    refId: 'B',
    settings: { mode: ReducerMode.Strict },
    reducer: ReducerID.last,
    ...partial,
  },
});

export const mockThresholdExpression = (partial: Partial<ExpressionQuery> = {}): AlertQuery<ExpressionQuery> => ({
  refId: 'C',
  queryType: 'expression',
  datasourceUid: '__expr__',
  model: {
    type: ExpressionQueryType.threshold,
    refId: 'C',
    ...partial,
  },
});

class LocalStorageMock implements Storage {
  [key: string]: any;

  getItem(key: string) {
    return this[key] ?? null;
  }

  setItem(key: string, value: string) {
    this[key] = value;
  }

  clear() {
    Object.keys(this).forEach((key) => delete this[key]);
  }

  removeItem(key: string) {
    delete this[key];
  }

  key(index: number) {
    return Object.keys(this)[index] ?? null;
  }

  get length() {
    return Object.keys(this).length;
  }
}

export function mockLocalStorage(): Storage {
  return new LocalStorageMock();
}
