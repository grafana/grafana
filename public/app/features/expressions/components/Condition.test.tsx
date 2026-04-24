import { render, screen } from 'test/test-utils';

import { EvalFunction } from 'app/features/alerting/state/alertDef';

import { type ClassicCondition } from '../types';

import { Condition } from './Condition';

const baseCondition: ClassicCondition = {
  type: 'query',
  evaluator: { params: [0], type: EvalFunction.IsAbove },
  query: { params: ['A'] },
  reducer: { params: [], type: 'avg' },
};

const defaultProps = {
  onChange: jest.fn(),
  onRemoveCondition: jest.fn(),
  index: 0,
  refIds: [{ value: 'A', label: 'A' }],
};

describe('Condition', () => {
  it('should render without crashing when condition.reducer is undefined', () => {
    const conditionWithoutReducer: ClassicCondition = {
      ...baseCondition,
      reducer: undefined,
    };

    expect(() => render(<Condition {...defaultProps} condition={conditionWithoutReducer} />)).not.toThrow();
  });

  it('should show the WHEN label when condition.reducer is undefined', () => {
    const conditionWithoutReducer: ClassicCondition = {
      ...baseCondition,
      reducer: undefined,
    };

    render(<Condition {...defaultProps} condition={conditionWithoutReducer} />);

    // Component should render with no selected reducer value in the Select
    expect(screen.getByText('WHEN')).toBeInTheDocument();
  });

  it('should render with the correct reducer selected when condition.reducer exists', () => {
    render(<Condition {...defaultProps} condition={baseCondition} />);

    expect(screen.getByText('WHEN')).toBeInTheDocument();
  });
});
