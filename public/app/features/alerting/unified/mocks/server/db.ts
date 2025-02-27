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
  RulerRecordingRuleDTO,
  RulerRuleGroupDTO,
} from 'app/types/unified-alerting-dto';

import { setupDataSources } from '../../testSetup/datasources';
import { DataSourceType } from '../../utils/datasource';

const prometheusRuleFactory = Factory.define<PromAlertingRuleDTO>(({ sequence }) => ({
  name: `test-rule-${sequence}`,
  query: 'test-query',
  state: PromAlertingRuleState.Inactive,
  type: PromRuleType.Alerting,
  health: 'ok',
  labels: { team: 'infra' },
}));

const rulerAlertingRuleFactory = Factory.define<RulerAlertingRuleDTO>(({ sequence }) => ({
  alert: `ruler-alerting-rule-${sequence}`,
  expr: 'vector(0)',
  annotations: { 'annotation-key-1': 'annotation-value-1' },
  labels: { 'label-key-1': 'label-value-1' },
  for: '5m',
}));

const rulerRecordingRuleFactory = Factory.define<RulerRecordingRuleDTO>(({ sequence }) => ({
  record: `ruler-recording-rule-${sequence}`,
  expr: 'vector(0)',
  labels: { 'label-key-1': 'label-value-1' },
}));

const rulerRuleGroupFactory = Factory.define<RulerRuleGroupDTO>(({ sequence }) => ({
  name: `ruler-rule-group-${sequence}`,
  rules: [],
  interval: '1m',
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

const dataSourceFactory = Factory.define<DataSourceInstanceSettings>(({ sequence, params, afterBuild }) => {
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
    access: 'proxy',
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
};
