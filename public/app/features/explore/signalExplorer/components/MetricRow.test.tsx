import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';

import { MetricRow } from './MetricRow';

function renderRow(props: Partial<ComponentProps<typeof MetricRow>> = {}) {
  const onSelect = jest.fn();
  const onToggleExpand = jest.fn();

  render(
    <MetricRow
      metric={{ name: 'up', type: 'gauge' }}
      refBadges={[]}
      selected={false}
      expanded={false}
      onSelect={onSelect}
      onToggleExpand={onToggleExpand}
      {...props}
    />
  );

  return { onSelect, onToggleExpand };
}

describe('MetricRow', () => {
  it('shows the metric name and its type', () => {
    renderRow();

    expect(screen.getByRole('button', { name: 'up' })).toBeInTheDocument();
    expect(screen.getByTestId('signal-explorer-metric-type')).toHaveTextContent('Gauge');
  });

  it('labels a native histogram distinctly from a classic one', () => {
    renderRow({ metric: { name: 'request_duration_seconds', type: 'native histogram' } });

    expect(screen.getByTestId('signal-explorer-metric-type')).toHaveTextContent('Native histogram');
  });

  it('renders one badge per referencing refId', () => {
    renderRow({ refBadges: ['A', 'C'] });

    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('reports the metric name back to both handlers', async () => {
    const { onSelect, onToggleExpand } = renderRow();

    await userEvent.click(screen.getByRole('button', { name: 'up' }));
    await userEvent.click(screen.getByRole('button', { name: /expand up/i }));

    expect(onSelect).toHaveBeenCalledWith('up');
    expect(onToggleExpand).toHaveBeenCalledWith('up');
  });
});
