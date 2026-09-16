import { render, screen } from 'test/test-utils';

import { ReducerID } from '@grafana/data';
import { EvalFunction } from 'app/features/alerting/state/alertDef';
import { type ExpressionQuery, parseExpressionQuery } from 'app/features/expressions/schemas/expressionQuery';
import { type AlertQuery } from 'app/types/unified-alerting-dto';

import { type SimpleCondition } from '../../../types/rule-form';

import { SimpleConditionEditor } from './SimpleCondition';

const defaultSimpleCondition: SimpleCondition = {
  whenField: ReducerID.last,
  evaluator: { params: [0], type: EvalFunction.IsAbove },
};

/**
 * Builds a query the way the editor receives one: a raw model off the API, read through the same
 * parse the rest of the app uses. The odd shapes below are all things real saved rules contain.
 */
function savedExpression(refId: string, model: unknown): AlertQuery<ExpressionQuery> {
  const parsed = parseExpressionQuery(model);

  if (!parsed) {
    throw new Error('fixture did not parse');
  }

  return { refId, queryType: 'expression', datasourceUid: '__expr__', model: parsed };
}

const threshold = savedExpression('C', {
  type: 'threshold',
  refId: 'C',
  expression: 'B',
  conditions: [{ evaluator: { type: 'gt', params: [0] } }],
});

function renderEditor(expressionQueries: Array<AlertQuery<ExpressionQuery>>, dispatch = jest.fn()) {
  return render(
    <SimpleConditionEditor
      simpleCondition={defaultSimpleCondition}
      onChange={jest.fn()}
      expressionQueriesList={expressionQueries}
      dispatch={dispatch}
    />
  );
}

describe('SimpleConditionEditor', () => {
  it('renders a reduce and threshold pair', () => {
    const reduce = savedExpression('B', { type: 'reduce', refId: 'B', expression: 'A', reducer: 'last' });

    renderEditor([reduce, threshold]);

    expect(screen.getByText('Alert condition')).toBeInTheDocument();
  });

  it('renders when the saved reduce carries the leftover conditions array older versions wrote', () => {
    const reduce = savedExpression('B', {
      type: 'reduce',
      refId: 'B',
      expression: 'A',
      reducer: 'last',
      // Never read by anything, but plenty of saved rules have it - including ones where the
      // condition has no reducer of its own.
      conditions: [{ type: 'query', evaluator: { params: [0], type: 'gt' }, query: { params: ['A'] } }],
    });

    expect(() => renderEditor([reduce, threshold])).not.toThrow();
  });

  it('renders when the saved reduce has an empty conditions array', () => {
    const reduce = savedExpression('B', {
      type: 'reduce',
      refId: 'B',
      expression: 'A',
      reducer: 'last',
      conditions: [],
    });

    expect(() => renderEditor([reduce, threshold])).not.toThrow();
  });

  it('renders when the saved reduce has no reducer at all', () => {
    const reduce = savedExpression('B', { type: 'reduce', refId: 'B', expression: 'A' });

    expect(() => renderEditor([reduce, threshold])).not.toThrow();
  });

  it('renders when the saved threshold has no conditions', () => {
    const emptyThreshold = savedExpression('C', {
      type: 'threshold',
      refId: 'C',
      expression: 'B',
      conditions: [],
    });
    const reduce = savedExpression('B', { type: 'reduce', refId: 'B', expression: 'A', reducer: 'last' });

    expect(() => renderEditor([reduce, emptyThreshold])).not.toThrow();
  });

  it('dispatches an update when the reducer is changed', async () => {
    const dispatch = jest.fn();
    const reduce = savedExpression('B', { type: 'reduce', refId: 'B', expression: 'A', reducer: 'last' });

    const { user } = renderEditor([reduce, threshold], dispatch);

    // The WHEN select renders a react-select input — there is only one combobox in this component
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('Mean'));

    expect(dispatch).toHaveBeenCalled();
  });
});
