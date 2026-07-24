import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { MetricRow } from '../types';

import { MetricMetadataBlock } from './MetricMetadataBlock';

describe('MetricMetadataBlock', () => {
  it('renders type, name, help and unit', () => {
    render(
      <MetricMetadataBlock
        metric={{ name: 'up', type: 'gauge', help: 'target up', unit: 'bool' }}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText('up')).toBeInTheDocument();
    expect(screen.getByText('target up')).toBeInTheDocument();
    expect(screen.getByText(/gauge/i)).toBeInTheDocument();
    expect(screen.getByText('bool')).toBeInTheDocument();
  });

  it('renders an empty hint when nothing is selected', () => {
    render(<MetricMetadataBlock metric={undefined} onClose={jest.fn()} />);

    expect(screen.getByText(/select a metric/i)).toBeInTheDocument();
  });

  it('omits the unit line entirely when unit is undefined', () => {
    render(<MetricMetadataBlock metric={{ name: 'up', type: 'gauge', help: 'target up' }} onClose={jest.fn()} />);

    expect(screen.queryByTestId('metric-metadata-unit')).not.toBeInTheDocument();
  });

  it('calls onClose when the close control is activated', async () => {
    const onClose = jest.fn();
    render(<MetricMetadataBlock metric={{ name: 'up', type: 'gauge' }} onClose={onClose} />);

    await userEvent.click(screen.getByRole('button', { name: /close/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each<[MetricRow['type'], string]>([
    ['counter', 'Counter'],
    ['gauge', 'Gauge'],
    ['histogram', 'Histogram'],
    ['native histogram', 'Native histogram'],
    ['summary', 'Summary'],
    ['unknown', 'Unknown'],
  ])('renders the human label for type %s', (type, label) => {
    render(<MetricMetadataBlock metric={{ name: 'metric_name', type }} onClose={jest.fn()} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
