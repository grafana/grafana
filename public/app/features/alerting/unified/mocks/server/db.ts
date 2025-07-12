import { Factory } from 'fishery';
import { uniqueId } from 'lodash';

import { DataSourceInstanceSettings, PluginType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { GrafanaManagedContactPoint, GrafanaManagedReceiverConfig } from 'app/plugins/datasource/alertmanager/types';
import { FolderDTO } from 'app/types/folders';
import {
  GrafanaAlertStateDecision,
  GrafanaAlertingRuleDefinition,
  GrafanaRecordingRuleDefinition,
  PromAlertingRuleDTO,
  PromAlertingRuleState,
  PromRuleGroupDTO,
  PromRuleType,
  RulerAlertingRuleDTO,
  RulerCloudRuleDTO,
  RulerGrafanaRuleDTO,
  RulerGrafanaRuleGroupDTO,
  RulerRecordingRuleDTO,
  RulerRuleGroupDTO,
} from 'app/types/unified-alerting-dto';

import { setupDataSources } from '../../testSetup/datasources';
import { Annotation } from '../../utils/constants';
import { DataSourceType } from '../../utils/datasource';
import { namespaces } from '../mimirRulerApi';

import { MIMIR_DATASOURCE_UID, PROMETHEUS_DATASOURCE_UID } from './constants';

interface PromRuleFactoryTransientParams {
  namePrefix?: string;
}

class PromRuleFactory extends Factory<PromAlertingRuleDTO, PromRuleFactoryTransientParams> {
  fromRuler(rulerRule: RulerAlertingRuleDTO) {
    return this.params({
      name: rulerRule.alert,
      query: rulerRule.expr,
      type: PromRuleType.Alerting,
      labels: rulerRule.labels,
      annotations: rulerRule.annotations,
    });
  }
}

const prometheusRuleFactory = PromRuleFactory.define(({ sequence, transientParams: { namePrefix } }) => ({
  name: `${namePrefix ? `${namePrefix}-` : ''}test-rule-${sequence}`,
  query: 'test-query',
  state: PromAlertingRuleState.Inactive,
  type: PromRuleType.Alerting as const,
  health: 'ok',
  labels: {},
  annotations: {},
}));

const prometheusRuleGroupFactory = Factory.define<PromRuleGroupDTO>(({ sequence }) => {
  const group = {
    name: `test-group-${sequence}`,
    file: `test-namespace`,
    interval: 10,
    rules: prometheusRuleFactory.buildList(10),
  };

  prometheusRuleFactory.rewindSequence();

  return group;
});

const rulerAlertingRuleFactory = Factory.define<RulerAlertingRuleDTO>(({ sequence }) => ({
  alert: `test-rule-${sequence}`,
  expr: 'up = 1',
  labels: { severity: 'warning' },
  annotations: { summary: 'test alert' },
}));

const rulerRecordingRuleFactory = Factory.define<RulerRecordingRuleDTO>(({ sequence }) => ({
  record: `ruler-recording-rule-${sequence}`,
  expr: 'vector(0)',
  labels: {},
}));

const rulerGroupFactory = Factory.define<RulerRuleGroupDTO<RulerCloudRuleDTO>, { addToNamespace: string }>(
  ({ sequence, transientParams, afterBuild }) => {
    afterBuild((group) => {
      if (transientParams.addToNamespace) {
        if (!namespaces[transientParams.addToNamespace]) {
          namespaces[transientParams.addToNamespace] = [];
        }
        namespaces[transientParams.addToNamespace].push(group);
      }
    });

    return {
      name: `test-group-${sequence}`,
      interval: '1m',
      rules: rulerAlertingRuleFactory.buildList(3),
    };
  }
);

const rulerGrafanaGroupFactory = Factory.define<RulerGrafanaRuleGroupDTO>(({ sequence }) => ({
  name: `test-group-${sequence}`,
  interval: '1m',
  rules: grafanaAlertingRuleFactory.buildList(3),
}));

class DataSourceFactory extends Factory<DataSourceInstanceSettings> {
  vanillaPrometheus() {
    return this.params({ uid: PROMETHEUS_DATASOURCE_UID, name: 'Prometheus' });
  }

  mimir() {
    return this.params({ uid: MIMIR_DATASOURCE_UID, name: 'Mimir' });
  }
}

const dataSourceFactory = DataSourceFactory.define(({ sequence, params, afterBuild }) => {
  afterBuild((dataSource) => {
    config.datasources[dataSource.name] = dataSource;
    setupDataSources(...Object.values(config.datasources));
  });

  const uid = params.uid ?? `mock-ds-${sequence}`;
  return {
    id: params.id ?? sequence,
    uid,
    type: DataSourceType.Prometheus,
    name: `Prometheus-${uid}`,
    access: 'proxy' as const,
    url: `/api/datasources/proxy/uid/${uid}`,
    jsonData: {},
    meta: {
      info: {
        author: { name: 'Grafana Labs' },
        description: 'Open source time series database & alerting',
        updated: '',
        version: '',
        logos: {
          small: 'https://prometheus.io/assets/prometheus_logo_grey.svg',
          large: 'https://prometheus.io/assets/prometheus_logo_grey.svg',
        },
        links: [],
        screenshots: [],
      },
      name: 'Prometheus',
      type: PluginType.datasource,
      id: 'prometheus',
      baseUrl: '"public/app/plugins/datasource/prometheus"',
      module: 'core:plugin/prometheus',
    },
    readOnly: false,
  };
});

const grafanaFolderFactory = Factory.define<FolderDTO>(({ sequence }) => ({
  id: sequence,
  uid: uniqueId(),
  title: `Mock Folder ${sequence}`,
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
}));

const grafanaRecordingRule = Factory.define<RulerGrafanaRuleDTO<GrafanaRecordingRuleDefinition>>(({ sequence }) => ({
  grafana_alert: {
    id: String(sequence),
    uid: uniqueId(),
    title: `Recording rule ${sequence}`,
    namespace_uid: 'test-namespace',
    rule_group: 'test-group',
    condition: 'A',
    data: [],
    record: {
      from: 'vector(1)',
      metric: `recording_rule_${sequence}`,
    },
  },
  for: '5m',
  labels: { 'label-key-1': 'label-value-1' },
  annotations: {}, // @TODO recording rules don't have annotations, we need to fix this type definition
}));

const grafanaAlertingRuleFactory = Factory.define<RulerGrafanaRuleDTO<GrafanaAlertingRuleDefinition>>(
  ({ sequence }) => ({
    grafana_alert: {
      id: String(sequence),
      uid: uniqueId(),
      title: `Alerting rule ${sequence}`,
      namespace_uid: 'test-namespace',
      rule_group: 'test-group',
      condition: 'A',
      data: [],
      is_paused: false,
      no_data_state: GrafanaAlertStateDecision.NoData,
      exec_err_state: GrafanaAlertStateDecision.Error,
    } satisfies GrafanaAlertingRuleDefinition,
    for: '5m',
    labels: { 'label-key-1': 'label-value-1' },
    annotations: { [Annotation.summary]: 'test alert' },
  })
);

class GrafanaContactPointFactory extends Factory<GrafanaManagedContactPoint> {
  withIntegrations(builder: (factory: GrafanaReceiverConfigFactory) => GrafanaManagedReceiverConfig[]) {
    return this.params({
      grafana_managed_receiver_configs: builder(grafanaReceiverConfigFactory),
    });
  }
}

const grafanaContactPointFactory = GrafanaContactPointFactory.define(({ sequence }) => ({
  id: `contact-point-${sequence}`,
  name: `contact-point-${sequence}`,
  metadata: {
    name: `contact-point-${sequence}`,
    namespace: 'default',
    uid: `uid-${sequence}`,
    resourceVersion: 'a5e9fd75262d5488',
    creationTimestamp: undefined,
    annotations: {
      'grafana.com/access/canAdmin': 'true',
      'grafana.com/access/canDelete': 'true',
      'grafana.com/access/canReadSecrets': 'true',
      'grafana.com/access/canWrite': 'true',
      'grafana.com/inUse/routes': '0',
      'grafana.com/inUse/rules': '1',
      'grafana.com/provenance': 'none',
    },
  },
  provisioned: false,
  grafana_managed_receiver_configs: [],
}));

interface SlackReceiverOptions {
  recipient?: string;
  token?: string;
  url?: string;
}

interface SNSReceiverOptions {
  api_url: string;
  sigv4?: {
    region: string;
    access_key?: string;
    secret_key?: string;
  };
  topic_arn?: string;
}

class GrafanaReceiverConfigFactory extends Factory<GrafanaManagedReceiverConfig> {
  email() {
    return this.params({ type: 'email', name: `email-${this.sequence()}` });
  }

  oncall() {
    return this.params({ type: 'oncall', name: `oncall-${this.sequence()}` });
  }

  slack({ recipient, token, url }: SlackReceiverOptions = {}) {
    return this.params({
      type: 'slack',
      name: `slack-${this.sequence()}`,
      settings: { recipient },
      secureFields: { token: Boolean(token), url: Boolean(url) },
    });
  }

  webhook() {
    return this.params({ type: 'webhook', name: `webhook-${this.sequence()}` });
  }

  sns({ api_url, sigv4, topic_arn }: SNSReceiverOptions) {
    const { access_key, secret_key, ...sigv4WithoutSecrets } = sigv4 ?? {};
    return this.params({
      type: 'sns',
      name: `sns-${this.sequence()}`,
      settings: { api_url, sigv4: sigv4WithoutSecrets, topic_arn },
      secureFields: { 'sigv4.access_key': Boolean(access_key), 'sigv4.secret_key': Boolean(secret_key) },
    });
  }

  mqtt() {
    return this.params({ type: 'mqtt', name: `mqtt-${this.sequence()}` });
  }
}

const grafanaReceiverConfigFactory = GrafanaReceiverConfigFactory.define(({ sequence }) => ({
  name: `receiver-config-${sequence}`,
  type: 'email',
  settings: {},
  secureFields: {},
  disableResolveMessage: false,
}));

export const alertingFactory = {
  folder: grafanaFolderFactory,
  prometheus: {
    group: prometheusRuleGroupFactory,
    rule: prometheusRuleFactory,
  },
  ruler: {
    group: rulerGroupFactory,
    alertingRule: rulerAlertingRuleFactory,
    recordingRule: rulerRecordingRuleFactory,
    grafana: {
      group: rulerGrafanaGroupFactory,
      recordingRule: grafanaRecordingRule,
      alertingRule: grafanaAlertingRuleFactory,
    },
  },
  dataSource: dataSourceFactory,
  alertmanager: {
    grafana: {
      contactPoint: grafanaContactPointFactory,
      receiver: grafanaReceiverConfigFactory,
    },
  },
};
