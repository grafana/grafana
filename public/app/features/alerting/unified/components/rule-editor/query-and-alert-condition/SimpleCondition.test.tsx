import { render, screen } from 'test/test-utils';

import { ReducerID } from '@grafana/data/transformations';
import { EvalFunction } from 'app/features/alerting/state/alertDef';
import { type ClassicCondition, type ExpressionQuery } from 'app/features/expressions/types';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

import { mockReduceExpression, mockThresholdExpression } from '../../../mocks';
import { type SimpleCondition } from '../../../types/rule-form';

import { SimpleConditionEditor } from './SimpleCondition';

const defaultSimpleCondition: SimpleCondition = {
  whenField: ReducerID.last,
  evaluator: { params: [0], type: EvalFunction.IsAbove },
};

function buildReduceExpressionWithConditions(
  conditionOverrides?: Array<Partial<ClassicCondition>>
): AlertQuery<ExpressionQuery> {
  const conditions = conditionOverrides?.map((override) => ({
    type: 'query' as const,
    evaluator: { params: [0], type: EvalFunction.IsAbove },
    query: { params: ['A'] },
    ...override,
  }));

  return mockReduceExpression({
    expression: 'A',
    conditions: conditions as ClassicCondition[],
  });
}

describe('SimpleConditionEditor', () => {
  it('should render without crashing when reduce expression conditions have no reducer object', () => {
    const expressionQueries = [buildReduceExpressionWithConditions([{}]), mockThresholdExpression({ expression: 'B' })];

    expect(() =>
      render(
        <SimpleConditionEditor
          simpleCondition={defaultSimpleCondition}
          onChange={jest.fn()}
          expressionQueriesList={expressionQueries}
          dispatch={jest.fn()}
        />
      )
    ).not.toThrow();
  });

  it('should render without crashing when reduce expression has empty conditions array', () => {
    const expressionQueries = [
      mockReduceExpression({ expression: 'A', conditions: [] }),
      mockThresholdExpression({ expression: 'B' }),
    ];

    expect(() =>
      render(
        <SimpleConditionEditor
          simpleCondition={defaultSimpleCondition}
          onChange={jest.fn()}
          expressionQueriesList={expressionQueries}
          dispatch={jest.fn()}
        />
      )
    ).not.toThrow();
  });

  it('should render without crashing when reduce expression has no conditions', () => {
    const expressionQueries = [mockReduceExpression({ expression: 'A' }), mockThresholdExpression({ expression: 'B' })];

    expect(() =>
      render(
        <SimpleConditionEditor
          simpleCondition={defaultSimpleCondition}
          onChange={jest.fn()}
          expressionQueriesList={expressionQueries}
          dispatch={jest.fn()}
        />
      )
    ).not.toThrow();
  });

  it('should dispatch updated expression when changing reducer with missing conditions[0].reducer', async () => {
    const dispatch = jest.fn();
    const expressionQueries = [buildReduceExpressionWithConditions([{}]), mockThresholdExpression({ expression: 'B' })];

    const { user } = render(
      <SimpleConditionEditor
        simpleCondition={defaultSimpleCondition}
        onChange={jest.fn()}
        expressionQueriesList={expressionQueries}
        dispatch={dispatch}
      />
    );

    // The WHEN select renders a react-select input — there is only one combobox in this component
    const whenSelect = screen.getByRole('combobox');
    await user.click(whenSelect);

    const meanOption = await screen.findByText('Mean');
    await user.click(meanOption);

    // Verify dispatch was called — no crash occurred and the expression was updated
    expect(dispatch).toHaveBeenCalled();
  });

  it('should render without crashing when threshold expression has empty conditions', () => {
    const expressionQueries = [
      mockReduceExpression({ expression: 'A' }),
      mockThresholdExpression({ expression: 'B', conditions: [] }),
    ];

    expect(() =>
      render(
        <SimpleConditionEditor
          simpleCondition={defaultSimpleCondition}
          onChange={jest.fn()}
          expressionQueriesList={expressionQueries}
          dispatch={jest.fn()}
        />
      )
    ).not.toThrow();
  });

  it('should render and function correctly with fully-populated expression data', () => {
    const expressionQueries = [
      buildReduceExpressionWithConditions([{ reducer: { params: [], type: 'last' } }]),
      mockThresholdExpression({ expression: 'B' }),
    ];

    render(
      <SimpleConditionEditor
        simpleCondition={defaultSimpleCondition}
        onChange={jest.fn()}
        expressionQueriesList={expressionQueries}
        dispatch={jest.fn()}
      />
    );

    expect(screen.getByText('Alert condition')).toBeInTheDocument();
  });
});
