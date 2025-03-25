import { expectType } from 'tsd';

import { PrometheusAlertingRule, PrometheusRecordingRule, PrometheusRule } from './api';

describe('API object definitions (DTO)', () => {
  test('recording rule', () => {
    const rule = {
      name: 'rule_name',
      query: 'query',
      labels: { label: 'value' },
      health: 'ok',
      lastError: 'error',
      evaluationTime: 0,
      lastEvaluation: '2021-01-01T00:00:00Z',
      type: 'recording',
    } satisfies PrometheusRule;

    expectType<PrometheusRecordingRule>(rule);
    expect(rule).not.toHaveProperty('alerts');
    expect(rule).toHaveProperty('type', 'recording');
  });

  test('alerting rule', () => {
    const rule = {
      name: 'rule_name',
      query: 'query',
      labels: { label: 'value' },
      annotations: { annotation: 'value' },
      alerts: [],
      duration: 0,
      state: 'firing',
      health: 'ok',
      lastError: 'error',
      evaluationTime: 0,
      lastEvaluation: '2021-01-01T00:00:00Z',
      type: 'alerting',
    } satisfies PrometheusRule;

    expectType<PrometheusAlertingRule>(rule);
    expect(rule).toHaveProperty('alerts', expect.any(Array));
    expect(rule).toHaveProperty('type', 'alerting');

    // these are for Grafana rules only
    expect(rule).not.toHaveProperty('uid');
    expect(rule).not.toHaveProperty('folderUid');
  });
});
