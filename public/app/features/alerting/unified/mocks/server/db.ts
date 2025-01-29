import { Factory } from 'fishery';
import { uniqueId } from 'lodash';

import { DataSourceInstanceSettings, PluginType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { FolderDTO } from 'app/types';
import {
  PromAlertingRuleDTO,
  PromAlertingRuleState,
  PromRuleGroupDTO,
  PromRuleType,
  RulerAlertingRuleDTO,
  RulerCloudRuleDTO,
  RulerRecordingRuleDTO,
  RulerRuleGroupDTO,
} from 'app/types/unified-alerting-dto';

import { setupDataSources } from '../../testSetup/datasources';
import { DataSourceType } from '../../utils/datasource';
import { namespaces } from '../mimirRulerApi';

import { MIMIR_DATASOURCE_UID, PROMETHEUS_DATASOURCE_UID } from './constants';

class PromRuleFactory extends Factory<PromAlertingRuleDTO> {
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

const prometheusRuleFactory = PromRuleFactory.define(({ sequence, params }) => ({
  name: `${params.name ?? 'test-rule'}-${sequence}`,
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

export const alertingFactory = {
  folder: grafanaFolderFactory,
  prometheus: {
    group: prometheusRuleGroupFactory,
    rule: prometheusRuleFactory,
  },
  ruler: {
    group: rulerRuleGroupFactory,
    alertingRule: rulerAlertingRuleFactory,
    recordingRule: rulerRecordingRuleFactory,
  },
  dataSource: dataSourceFactory,
  ruler: {
    group: rulerGroupFactory,
    rule: rulerAlertingRuleFactory,
  },
};
