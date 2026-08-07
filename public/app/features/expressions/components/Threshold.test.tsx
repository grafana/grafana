import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { EvalFunction } from 'app/features/alerting/state/alertDef';

import { ExpressionQueryType, type ThresholdExpressionQuery } from '../types';

import { Threshold } from './Threshold';

const refIds = [{ value: 'A', label: 'A' }];

function renderThreshold(query: ThresholdExpressionQuery, onError = jest.fn()) {
  const onChange = jest.fn();
  const user = userEvent.setup();

  render(
    <Threshold
      labelWidth="auto"
      refIds={refIds}
      query={query}
      onChange={onChange}
      onError={onError}
      useHysteresis={true}
    />
  );

  return { onChange, onError, user };
}

describe('Threshold', () => {
  it('normalizes legacy equal recovery evaluators when emitting the initial query', async () => {
    const { onChange } = renderThreshold({
      type: ExpressionQueryType.threshold,
      refId: 'B',
      expression: 'A',
      conditions: [
        {
          type: 'query',
          evaluator: { type: EvalFunction.IsEqual, params: [20] },
          unloadEvaluator: { type: EvalFunction.IsNotEqual, params: [1] },
          query: { params: ['A'] },
          reducer: { type: 'last', params: [] },
        },
      ],
    });

    await waitFor(() => expect(onChange).toHaveBeenCalled());

    expect(onChange.mock.lastCall?.[0].conditions?.[0].unloadEvaluator).toEqual({
      type: EvalFunction.IsEqual,
      params: [1],
    });
  });

  it('clears recovery validation after the main equal threshold changes', async () => {
    const { onError, user } = renderThreshold({
      type: ExpressionQueryType.threshold,
      refId: 'B',
      expression: 'A',
      conditions: [
        {
          type: 'query',
          evaluator: { type: EvalFunction.IsEqual, params: [20] },
          query: { params: ['A'] },
          reducer: { type: 'last', params: [] },
        },
      ],
    });

    await user.click(screen.getByLabelText('Custom recovery threshold'));

    expect(onError).toHaveBeenLastCalledWith('Enter a different number than 20');

    onError.mockClear();
    const mainThresholdInput = screen.getAllByRole('spinbutton')[0];
    await user.clear(mainThresholdInput);
    await user.type(mainThresholdInput, '21');

    expect(onError).toHaveBeenLastCalledWith(undefined);
  });
});
