import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { LiveMetricCard } from './LiveMetricCard';

describe('LiveMetricCard', () => {
  it('shows loading state initially', () => {
    const fetchMetric = jest.fn().mockResolvedValue(42);
    render(<LiveMetricCard title="CPU Usage" fetchMetric={fetchMetric} />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('displays the metric value after fetch resolves', async () => {
    const fetchMetric = jest.fn().mockResolvedValue(73);
    render(<LiveMetricCard title="CPU Usage" fetchMetric={fetchMetric} />);
    await waitFor(() => expect(screen.getByText('73')).toBeInTheDocument());
  });

  it('displays the metric value with a unit', async () => {
    const fetchMetric = jest.fn().mockResolvedValue(512);
    render(<LiveMetricCard title="Memory" unit="MB" fetchMetric={fetchMetric} />);
    await waitFor(() => expect(screen.getByText('512 MB')).toBeInTheDocument());
  });

  it('displays an error message when fetch fails', async () => {
    const fetchMetric = jest.fn().mockRejectedValue(new Error('timeout'));
    render(<LiveMetricCard title="CPU Usage" fetchMetric={fetchMetric} />);
    await waitFor(() => expect(screen.getByText('Error: timeout')).toBeInTheDocument());
  });
});
