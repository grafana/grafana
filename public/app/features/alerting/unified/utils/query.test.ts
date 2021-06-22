import { CombinedRule } from 'app/types/unified-alerting';
import { GrafanaAlertStateDecision } from 'app/types/unified-alerting-dto';
import { alertRuleToQueries } from './query';
import { GRAFANA_RULES_SOURCE_NAME } from './datasource';

describe('alertRuleToQueries', () => {
  it('it should convert grafana alert', () => {
    const grafanaAlert = {
      condition: 'B',
      exec_err_state: GrafanaAlertStateDecision.Alerting,
      namespace_uid: 'v6Jq2DrGz',
      no_data_state: GrafanaAlertStateDecision.NoData,
      title: 'Prom up alert',
      uid: 'cbGHWBqMz',
      data: [],
    };
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
        for: '5m',
        annotations: {},
        labels: {},
        grafana_alert: grafanaAlert,
      },
    };

    const result = alertRuleToQueries(combinedRule);
    expect(result).toEqual(grafanaAlert);
  });

  it('shoulds convert cloud alert', () => {});
});
