import { expectTypeOf } from 'expect-type';

import { AlertingRule, RecordingRule, Rule } from './api';

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
    } satisfies Rule;

    expectTypeOf(rule).toExtend<RecordingRule>();
    expectTypeOf(rule).toMatchObjectType<{ type: 'recording' }>();
    expectTypeOf(rule).not.toHaveProperty('alerts');
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
    } satisfies Rule;

    expectTypeOf(rule).toExtend<AlertingRule>();
    expectTypeOf(rule).toHaveProperty('alerts').toBeArray();

    // these are for Grafana rules only
    expectTypeOf(rule).not.toHaveProperty('uid');
    expectTypeOf(rule).not.toHaveProperty('folderUid');
  });
});
