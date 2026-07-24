import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { mockComboboxRect } from '@grafana/test-utils';

import { MetricTypeFilter } from './MetricTypeFilter';

mockComboboxRect();

describe('MetricTypeFilter', () => {
  it('calls onChange with the selected type', async () => {
    const onChange = jest.fn();
    render(<MetricTypeFilter value={null} onChange={onChange} />);

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(await screen.findByText('Counter'));

    expect(onChange).toHaveBeenCalledWith('counter');
  });

  it('calls onChange with null when the selection is cleared', async () => {
    const onChange = jest.fn();
    render(<MetricTypeFilter value="gauge" onChange={onChange} />);

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByTitle('Clear value'));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('reflects the current value in the rendered control', () => {
    render(<MetricTypeFilter value="gauge" onChange={jest.fn()} />);

    expect(screen.getByDisplayValue('Gauge')).toBeInTheDocument();
  });

  it('offers all six metric types', async () => {
    render(<MetricTypeFilter value={null} onChange={jest.fn()} />);

    await userEvent.click(screen.getByRole('combobox'));

    expect(await screen.findByText('Counter')).toBeInTheDocument();
    expect(screen.getByText('Gauge')).toBeInTheDocument();
    expect(screen.getByText('Histogram')).toBeInTheDocument();
    expect(screen.getByText('Native histogram')).toBeInTheDocument();
    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});
