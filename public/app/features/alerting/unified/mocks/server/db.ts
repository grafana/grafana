import { Factory } from 'fishery';

import { DataSourceInstanceSettings, PluginType } from '@grafana/data';
import { config, setDataSourceSrv } from '@grafana/runtime';
import {
  PromAlertingRuleDTO,
  PromAlertingRuleState,
  PromRuleGroupDTO,
  PromRuleType,
} from 'app/types/unified-alerting-dto';

import { MockDataSourceSrv } from '../../mocks';
import { DataSourceType } from '../../utils/datasource';

const ruleFactory = Factory.define<PromAlertingRuleDTO>(({ sequence }) => ({
  name: `test-rule-${sequence}`,
  query: 'test-query',
  state: PromAlertingRuleState.Inactive,
  type: PromRuleType.Alerting,
  health: 'ok',
  labels: { team: 'infra' },
}));

const groupFactory = Factory.define<PromRuleGroupDTO>(({ sequence }) => {
  const group = {
    name: `test-group-${sequence}`,
    file: `test-namespace`,
    interval: 10,
    rules: ruleFactory.buildList(10),
  };

  ruleFactory.rewindSequence();

  return group;
});

const dataSourceFactory = Factory.define<DataSourceInstanceSettings>(({ sequence, params, afterBuild }) => {
  afterBuild((dataSource) => {
    config.datasources[dataSource.name] = dataSource;
    setDataSourceSrv(new MockDataSourceSrv(config.datasources));
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

export const alertingFactory = {
  group: groupFactory,
  rule: ruleFactory,
  dataSource: dataSourceFactory,
};
