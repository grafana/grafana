import { EvalFunction } from '../../alerting/state/alertDef';
import { ExpressionQueryType } from '../types';

import type { ThresholdEvalFunction } from './common';
import { getExpressionIssues } from './expressionQuery';
import { makeThresholdExpression } from './factories';
import { EXPRESSION_ISSUE_IDS, type ExpressionIssueId, type FieldPath, issueAt } from './issues';

jest.mock('@grafana/runtime', () => ({ logWarning: jest.fn() }));

const FIRST = ['conditions', 0, 'unloadEvaluator', 'params', 0];
const SECOND = ['conditions', 0, 'unloadEvaluator', 'params', 1];

/** A threshold with a recovery threshold, which is the case all the comparisons are about. */
function withRecovery(type: ThresholdEvalFunction, value: number[], recovery: number[]) {
  const query = makeThresholdExpression({ refId: 'C' }, { expression: 'B' });
  query.conditions[0].evaluator = { type, params: value };
  query.conditions[0].unloadEvaluator = { type, params: recovery };
  return query;
}

describe('the recovery threshold has to be on the right side of the threshold', () => {
  const cases: Array<[ThresholdEvalFunction, number[], number[], ExpressionIssueId, FieldPath]> = [
    [EvalFunction.IsAbove, [10], [15], 'threshold.recovery.at-most', FIRST],
    [EvalFunction.IsBelow, [10], [5], 'threshold.recovery.at-least', FIRST],
    [EvalFunction.IsEqual, [10], [10], 'threshold.recovery.different', FIRST],
    [EvalFunction.IsGreaterThanEqual, [10], [10], 'threshold.recovery.less-than', FIRST],
    [EvalFunction.IsLessThanEqual, [10], [10], 'threshold.recovery.more-than', FIRST],
    [EvalFunction.IsWithinRange, [10, 20], [15, 25], 'threshold.recovery.at-most', FIRST],
    [EvalFunction.IsWithinRange, [10, 20], [5, 15], 'threshold.recovery.at-least', SECOND],
    [EvalFunction.IsOutsideRange, [10, 20], [5, 15], 'threshold.recovery.at-least', FIRST],
    [EvalFunction.IsOutsideRange, [10, 20], [15, 25], 'threshold.recovery.at-most', SECOND],
    [EvalFunction.IsOutsideRangeIncluded, [10, 20], [10, 15], 'threshold.recovery.more-than', FIRST],
    [EvalFunction.IsOutsideRangeIncluded, [10, 20], [15, 20], 'threshold.recovery.less-than', SECOND],
    [EvalFunction.IsWithinRangeIncluded, [10, 20], [10, 25], 'threshold.recovery.less-than', FIRST],
    [EvalFunction.IsWithinRangeIncluded, [10, 20], [5, 20], 'threshold.recovery.more-than', SECOND],
  ];

  it.each(cases)('%s with threshold %p and recovery %p reports %s', (type, value, recovery, expectedId, where) => {
    const issues = getExpressionIssues(withRecovery(type, value, recovery));
    const issue = issueAt(issues, where);

    expect(issue?.id).toBe(expectedId);
    expect(issue?.limit).toBeDefined();
  });

  const validCases: Array<[ThresholdEvalFunction, number[], number[]]> = [
    [EvalFunction.IsAbove, [10], [5]],
    [EvalFunction.IsBelow, [10], [15]],
    [EvalFunction.IsEqual, [10], [11]],
    [EvalFunction.IsGreaterThanEqual, [10], [9]],
    [EvalFunction.IsLessThanEqual, [10], [11]],
    [EvalFunction.IsWithinRange, [10, 20], [5, 25]],
    [EvalFunction.IsOutsideRange, [10, 20], [15, 15]],
  ];

  it.each(validCases)('%s with threshold %p and recovery %p is fine', (type, value, recovery) => {
    expect(getExpressionIssues(withRecovery(type, value, recovery))).toEqual([]);
  });

  // Behaviour kept from the original `isInvalid`: this one wants the recovery value to *match* the
  // threshold, the opposite of every other comparison. If this test fails someone has "fixed" it.
  it('is not equal to: asks for the recovery value to match the threshold', () => {
    const differs = getExpressionIssues(withRecovery(EvalFunction.IsNotEqual, [10], [11]));
    expect(issueAt(differs, FIRST)?.id).toBe('threshold.recovery.same');

    const matches = getExpressionIssues(withRecovery(EvalFunction.IsNotEqual, [10], [10]));
    expect(matches).toEqual([]);
  });

  it('reports an empty recovery box rather than comparing nothing', () => {
    const query = withRecovery(EvalFunction.IsAbove, [10], []);
    expect(issueAt(getExpressionIssues(query), FIRST)?.id).toBe('threshold.recovery.required');
  });

  it('says nothing about recovery when there is no recovery threshold', () => {
    const query = makeThresholdExpression({ refId: 'C' }, { expression: 'B' });
    query.conditions[0].evaluator = { type: EvalFunction.IsAbove, params: [10] };
    expect(getExpressionIssues(query)).toEqual([]);
  });
});

describe('issues point at the field they are about', () => {
  it('blames the expression when no query is selected', () => {
    const query = makeThresholdExpression({ refId: 'C' }, { expression: '' });
    expect(issueAt(getExpressionIssues(query), ['expression'])?.id).toBe('threshold.expression.required');
  });

  it('blames the expression for a leading $', () => {
    const query = makeThresholdExpression({ refId: 'C' }, { expression: '$B' });
    expect(issueAt(getExpressionIssues(query), ['expression'])?.id).toBe('threshold.expression.bare-name');
  });

  it('blames the threshold value when it is empty', () => {
    const query = makeThresholdExpression({ refId: 'C' }, { expression: 'B' });
    query.conditions[0].evaluator = { type: EvalFunction.IsAbove, params: [] };
    expect(issueAt(getExpressionIssues(query), ['conditions', 0, 'evaluator', 'params'])?.id).toBe(
      'threshold.value.required'
    );
  });
});

describe('every id is reachable and spelled consistently', () => {
  it('has no duplicate ids', () => {
    expect(new Set(EXPRESSION_ISSUE_IDS).size).toBe(EXPRESSION_ISSUE_IDS.length);
  });

  it('reports ids we recognise, never raw sentences', () => {
    const query = makeThresholdExpression({ refId: 'C' }, { expression: '' });
    for (const issue of getExpressionIssues(query)) {
      expect(EXPRESSION_ISSUE_IDS).toContain(issue.id);
    }
  });

  it.each(Object.values(ExpressionQueryType))('reports only known ids for a broken %s', (type) => {
    const query = { refId: 'X', type, expression: '', conditions: [], reducer: 'mean', window: '' };
    // @ts-expect-error deliberately shaped wrong, to see what comes back
    for (const issue of getExpressionIssues(query)) {
      expect(EXPRESSION_ISSUE_IDS).toContain(issue.id);
    }
  });
});
