import { render, screen } from 'test/test-utils';

import { type DataSourceInstanceListItem } from '@grafana/data';

import { type Solution } from '../solutions/types';

import { Solutions } from './Solutions';

const datasource: DataSourceInstanceListItem = {
  uid: 'datasource',
  name: 'Datasource',
  type: 'prometheus',
  meta: { id: 'prometheus' } as DataSourceInstanceListItem['meta'],
  readOnly: false,
  isDefault: true,
};

const metrics: Solution = {
  id: 'metrics',
  title: 'Metrics & infrastructure',
  icon: 'chart-line',
  signal: async () => 'active',
  datasource: async () => datasource,
  needsAttention: async () => false,
  stats: async () => null,
  refinedStats: async () => null,
  sparkline: async () => null,
  cta: async () => null,
  alert: async () => null,
  offer: async () => null,
};

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
