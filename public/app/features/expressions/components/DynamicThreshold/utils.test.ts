import { ExpressionDatasourceRef } from '@grafana/runtime/internal';

import { EvalFunction } from '../../../alerting/state/alertDef';
import { type DynamicThresholdPolicyV1, ExpressionQueryType, type SqlExpressionQuery } from '../../types';

import { buildDynamicThreshold } from './buildDynamicThreshold';
import { hasDynamicThresholdSqlMismatch, withoutDynamicThreshold } from './utils';

const policy: DynamicThresholdPolicyV1 = {
  inputRefId: 'A',
  valueField: 'value',
  matchLabel: 'region',
  labelColumns: ['region'],
  evaluator: EvalFunction.IsAbove,
  mappings: [{ labelValue: 'us-east', thresholds: [5] }],
  defaultThreshold: [10],
};

function makeQuery(expression: string, overrides: Partial<DynamicThresholdPolicyV1> = {}): SqlExpressionQuery {
  return {
    refId: 'B',
    datasource: ExpressionDatasourceRef,
    type: ExpressionQueryType.sql,
    format: 'alerting',
    expression,
    dynamicThreshold: { version: 1, policy: { ...policy, ...overrides } },
  };
}

describe('hasDynamicThresholdSqlMismatch', () => {
  const built = buildDynamicThreshold(policy);
  if (!built.ok) {
    throw new Error('expected the test policy to compile');
  }
  const sql = built.expressionSql;

  it('is false when the saved SQL equals the recompiled policy', () => {
    expect(hasDynamicThresholdSqlMismatch(makeQuery(sql))).toBe(false);
  });

  it('is true when the saved SQL differs in any way', () => {
    expect(hasDynamicThresholdSqlMismatch(makeQuery(`${sql} `))).toBe(true);
  });

  it('is true when the policy no longer compiles but SQL exists', () => {
    expect(hasDynamicThresholdSqlMismatch(makeQuery(sql, { defaultThreshold: [] }))).toBe(true);
  });

  it('is false for a new expression with empty SQL and an incomplete policy', () => {
    expect(
      hasDynamicThresholdSqlMismatch(makeQuery('', { inputRefId: '', valueField: '', defaultThreshold: [] }))
    ).toBe(false);
  });

  it('is false for ordinary SQL without metadata', () => {
    const { dynamicThreshold: _removed, ...ordinary } = makeQuery('SELECT 1');

    expect(hasDynamicThresholdSqlMismatch(ordinary)).toBe(false);
  });
});

describe('withoutDynamicThreshold', () => {
  it('removes the metadata and keeps everything else', () => {
    const query = makeQuery('SELECT 1');

    const converted = withoutDynamicThreshold(query);

    expect(converted).not.toHaveProperty('dynamicThreshold');
    expect(converted).toEqual({ ...query, dynamicThreshold: undefined });
  });
});
