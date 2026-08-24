import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MetricDetailPanel } from './MetricDetailPanel';
import { type MetricInfo, type MetricType } from './types';

const metric = (overrides: Partial<MetricInfo> = {}): MetricInfo => ({
  name: 'http_server_requests_seconds_count',
  type: 'counter',
  help: 'Total number of HTTP requests observed.',
  ...overrides,
});

describe('<MetricDetailPanel />', () => {
  it('renders the metric name and its help text as the description', () => {
    render(<MetricDetailPanel refId="A" metric={metric()} onClose={jest.fn()} />);

    expect(screen.getByText('http_server_requests_seconds_count')).toBeInTheDocument();
    expect(screen.getByText('Total number of HTTP requests observed.')).toBeInTheDocument();
  });

  // The same name can carry different metadata on two datasources, so the panel has to say whose
  // list it came from.
  it('names the query the metric was selected from', () => {
    render(<MetricDetailPanel refId="short-name" metric={metric()} onClose={jest.fn()} />);

    expect(screen.getByText('Query short-name')).toBeInTheDocument();
  });

  // Prometheus metadata is optional, so a metric with no help text has to render as a panel with no
  // description rather than an empty line under the name.
  it('renders no description for a metric the datasource gave no help text for', () => {
    render(<MetricDetailPanel refId="A" metric={metric({ help: undefined })} onClose={jest.fn()} />);

    const panel = screen.getByTestId('metric-detail-panel');
    expect(panel).toHaveTextContent('http_server_requests_seconds_count');
    expect(screen.queryByText('Total number of HTTP requests observed.')).not.toBeInTheDocument();
  });

  // The description scrolls once the help text passes its cap, and a scroll region with no tab stop
  // is help text a keyboard user cannot read past the first few lines.
  it('lets a keyboard reach the description to scroll it', async () => {
    render(<MetricDetailPanel refId="A" metric={metric()} onClose={jest.fn()} />);

    // The close button comes first in the panel, so the description is the second stop.
    await userEvent.tab();
    await userEvent.tab();

    expect(screen.getByText('Total number of HTTP requests observed.')).toHaveFocus();
  });

  it('leaves no stray tab stop when there is no description to scroll', async () => {
    render(<MetricDetailPanel refId="A" metric={metric({ help: undefined })} onClose={jest.fn()} />);

    await userEvent.tab();

    expect(screen.getByRole('button', { name: 'Close metric details' })).toHaveFocus();
  });

  it.each<[MetricType, string]>([
    ['counter', 'COUNTER'],
    ['gauge', 'GAUGE'],
    ['histogram', 'HISTOGRAM'],
    ['native histogram', 'NATIVE HISTOGRAM'],
    ['summary', 'SUMMARY'],
    ['unknown', 'UNKNOWN'],
  ])('labels a %s with a badge', (type, badge) => {
    render(<MetricDetailPanel refId="A" metric={metric({ type })} onClose={jest.fn()} />);

    expect(screen.getByText(badge)).toBeInTheDocument();
  });

  it('closes on request', async () => {
    const onClose = jest.fn();
    render(<MetricDetailPanel refId="A" metric={metric()} onClose={onClose} />);

    await userEvent.click(screen.getByRole('button', { name: 'Close metric details' }));

    expect(onClose).toHaveBeenCalled();
  });
});
