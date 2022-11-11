import { DataSourceJsonData, PluginMeta } from '@grafana/data';
import { ExpressionDatasourceUID } from 'app/features/expressions/ExpressionDatasource';
import { CombinedRule } from 'app/types/unified-alerting';
import { GrafanaAlertStateDecision } from 'app/types/unified-alerting-dto';

import { GRAFANA_RULES_SOURCE_NAME } from './datasource';
import { alertRuleToQueries } from './query';

describe('alertRuleToQueries', () => {
  it('it should convert grafana alert', () => {
    const combinedRule: CombinedRule = {
      name: 'Test alert',
      query: 'up',
      labels: {},
      annotations: {},
      group: {
        name: 'Prom up alert',
        rules: [],
      },
      namespace: {
        rulesSource: GRAFANA_RULES_SOURCE_NAME,
        name: 'Alerts',
        groups: [],
      },
      rulerRule: {
        for: '',
        annotations: {},
        labels: {},
        grafana_alert: grafanaAlert,
      },
    };

    const result = alertRuleToQueries(combinedRule);
    expect(result).toEqual(grafanaAlert.data);
  });

  it('shoulds convert cloud alert', () => {
    const combinedRule: CombinedRule = {
      name: 'cloud test',
      labels: {},
      query: 'up == 0',
      annotations: {},
      group: {
        name: 'test',
        rules: [],
      },
      namespace: {
        name: 'prom test alerts',
        groups: [],
        rulesSource: {
          name: 'prom test',
          type: 'prometheus',
          uid: 'asdf23',
          id: 1,
          access: 'proxy',
          meta: {} as PluginMeta,
          jsonData: {} as DataSourceJsonData,
          readOnly: false,
        },
      },
    };

    const result = alertRuleToQueries(combinedRule);
    expect(result).toEqual([
      {
        refId: 'A',
        datasourceUid: 'asdf23',
        queryType: '',
        model: {
          refId: 'A',
          expr: 'up == 0',
        },
        relativeTimeRange: {
          from: 360,
          to: 0,
        },
      },
    ]);
  });
});

const grafanaAlert = {
  condition: 'B',
  exec_err_state: GrafanaAlertStateDecision.Alerting,
  namespace_id: 11,
  namespace_uid: 'namespaceuid123',
  no_data_state: GrafanaAlertStateDecision.NoData,
  title: 'Test alert',
  uid: 'asdf23',
  data: [
    {
      refId: 'A',
      queryType: '',
      relativeTimeRange: { from: 600, to: 0 },
      datasourceUid: 'asdf51',
      model: {
        expr: 'up',
        refId: 'A',
      },
    },
    {
      refId: 'B',
      queryType: '',
      relativeTimeRange: { from: 0, to: 0 },
      datasourceUid: '-100',
      model: {
        conditions: [
          {
            evaluator: { params: [1], type: 'lt' },
            operator: { type: 'and' },
            query: { params: ['A'] },
            reducer: { params: [], type: 'last' },
            type: 'query',
          },
        ],
        datasource: {
          uid: ExpressionDatasourceUID,
        },
        hide: false,
        refId: 'B',
        type: 'classic_conditions',
      },
    },
  ],
};
