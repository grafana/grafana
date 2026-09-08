import { render, screen } from 'test/test-utils';

import { SOLUTION_IDS } from '../solutions/constants';

import { Solutions } from './Solutions';

jest.mock('./SolutionCard', () => ({
  ...jest.requireActual('./SolutionCard'),
  SolutionCardSkeleton: () => <div data-testid="solution-card-skeleton" />,
}));

describe('Solutions', () => {
  it('renders one skeleton for each supported solution', () => {
    render(<Solutions emptyMessage="" loading cards={[]} />);

    expect(screen.getAllByTestId('solution-card-skeleton')).toHaveLength(SOLUTION_IDS.length);
  });
});
