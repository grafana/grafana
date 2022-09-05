import {
  GrafanaAlertStateDecision,
  GrafanaRuleDefinition,
  RulerAlertingRuleDTO,
  RulerGrafanaRuleDTO,
  RulerRecordingRuleDTO,
} from 'app/types/unified-alerting-dto';

import { hashRulerRule } from './rule-id';

describe('hashRulerRule', () => {
  it('should not hash unknown rule types', () => {
    const unknownRule = {};

    expect(() => {
      // @ts-ignore
      hashRulerRule(unknownRule);
    }).toThrowError();
  });
  it('should hash recording rules', () => {
    const recordingRule: RulerRecordingRuleDTO = {
      record: 'instance:node_num_cpu:sum',
      expr: 'count without (cpu) (count without (mode) (node_cpu_seconds_total{job="integrations/node_exporter"}))',
      labels: { type: 'cpu' },
    };

    expect(hashRulerRule(recordingRule)).toMatchSnapshot();
  });

  it('should hash alerting rule', () => {
    const alertingRule: RulerAlertingRuleDTO = {
      alert: 'always-alerting',
      expr: 'vector(20) > 7',
      labels: { type: 'cpu' },
      annotations: { description: 'CPU usage too high' },
    };

    expect(hashRulerRule(alertingRule)).toMatchSnapshot();
  });

  it('should hash Grafana Managed rules', () => {
    const RULE_UID = 'abcdef12345';
    const grafanaAlertDefinition: GrafanaRuleDefinition = {
      uid: RULE_UID,
      namespace_uid: 'namespace',
      namespace_id: 0,
      title: 'my rule',
      condition: '',
      data: [],
      no_data_state: GrafanaAlertStateDecision.NoData,
      exec_err_state: GrafanaAlertStateDecision.Alerting,
    };
    const grafanaRule: RulerGrafanaRuleDTO = {
      grafana_alert: grafanaAlertDefinition,
      for: '30s',
      labels: { type: 'cpu' },
      annotations: { description: 'CPU usage too high' },
    };

    expect(hashRulerRule(grafanaRule)).toBe(RULE_UID);
  });
});
