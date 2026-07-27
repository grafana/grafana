import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MetricsExplorer } from './MetricsExplorer';

describe('<MetricsExplorer />', () => {
  it('renders the metrics title and search input', () => {
    render(<MetricsExplorer />);

    expect(screen.getByText('Metrics')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search metrics')).toBeInTheDocument();
  });

  it('renders the stub metric list', () => {
    render(<MetricsExplorer />);

    expect(screen.getByText('up')).toBeInTheDocument();
    expect(screen.getByText('node_cpu_seconds_total')).toBeInTheDocument();
  });

  it('filters the metric list by the search term', async () => {
    render(<MetricsExplorer />);

    await userEvent.type(screen.getByPlaceholderText('Search metrics'), 'node_cpu');

    expect(screen.getByText('node_cpu_seconds_total')).toBeInTheDocument();
    expect(screen.queryByText('up')).not.toBeInTheDocument();
  });

  it('shows no metrics when the search term matches nothing', async () => {
    render(<MetricsExplorer />);

    await userEvent.type(screen.getByPlaceholderText('Search metrics'), 'no_such_metric');

    expect(screen.queryByText('up')).not.toBeInTheDocument();
    expect(screen.queryByText('node_cpu_seconds_total')).not.toBeInTheDocument();
  });
});
