import { render, screen } from 'test/test-utils';

import { stubSolution } from '../solutions/test-utils';

import { Solutions } from './Solutions';

const metrics = stubSolution('metrics', { title: 'Metrics & infrastructure' });

describe('Solutions', () => {
  it('renders one skeleton per pending solution', () => {
    render(<Solutions emptyMessage="" cards={[]} pendingCount={5} />);

    expect(screen.getAllByTestId('solution-card-skeleton')).toHaveLength(5);
  });

  it('renders placed cards above the skeletons of the solutions still resolving', async () => {
    render(
      <Solutions
        emptyMessage=""
        cards={[{ solution: metrics, kind: 'live', needsAttention: false }]}
        pendingCount={2}
      />
    );

    expect(await screen.findByRole('heading', { name: metrics.title })).toBeInTheDocument();
    expect(screen.getAllByTestId('solution-card-skeleton')).toHaveLength(2);
  });

  it('shows the empty message only once nothing is pending', () => {
    render(<Solutions emptyMessage="Nothing here" cards={[]} pendingCount={0} />);

    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.queryByTestId('solution-card-skeleton')).not.toBeInTheDocument();
  });
});
