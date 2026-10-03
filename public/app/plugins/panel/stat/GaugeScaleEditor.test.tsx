import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ScaleDistribution } from '@grafana/schema';

import { GaugeScaleEditor } from './GaugeScaleEditor';

describe('GaugeScaleEditor', () => {
  it('selects Linear when no scale is set', () => {
    render(<GaugeScaleEditor value={undefined} onChange={jest.fn()} />);
    expect(screen.getByRole('radio', { name: 'Linear' })).toBeChecked();
  });

  it('selects Linear for a symlog scale carried over from another visualization', () => {
    render(<GaugeScaleEditor value={{ type: ScaleDistribution.Symlog, log: 2 }} onChange={jest.fn()} />);
    expect(screen.getByRole('radio', { name: 'Linear' })).toBeChecked();
  });

  it('switches to a log scale', async () => {
    const onChange = jest.fn();
    render(<GaugeScaleEditor value={undefined} onChange={onChange} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Logarithmic' }));

    expect(onChange).toHaveBeenCalledWith({ type: ScaleDistribution.Log });
  });
});
