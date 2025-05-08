import { render, RenderResult, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { RelativeTimeRange } from '@grafana/data';

import { RelativeTimeRangePicker } from './RelativeTimeRangePicker';

function setup(initial: RelativeTimeRange = { from: 900, to: 0 }): RenderResult {
  const StatefulPicker = () => {
    const [value, setValue] = useState<RelativeTimeRange>(initial);
    return <RelativeTimeRangePicker timeRange={value} onChange={setValue} />;
  };

  return render(<StatefulPicker />);
}

describe('RelativeTimePicker', () => {
  it('should render the picker button with an user friendly text', () => {
    setup({ from: 900, to: 0 });
    expect(screen.getByText('now-15m to now')).toBeInTheDocument();
  });

  it('should open the picker when clicking the button', async () => {
    setup({ from: 900, to: 0 });

    await userEvent.click(screen.getByText('now-15m to now'));

    expect(screen.getByText('Specify time range')).toBeInTheDocument();
    expect(screen.getByText('Example time ranges')).toBeInTheDocument();
  });

  it('should not have open picker without clicking the button', () => {
    setup({ from: 900, to: 0 });
    expect(screen.queryByText('Specify time range')).not.toBeInTheDocument();
    expect(screen.queryByText('Example time ranges')).not.toBeInTheDocument();
  });

  it('should not be able to apply range via quick options', async () => {
    setup({ from: 900, to: 0 });

    await userEvent.click(screen.getByText('now-15m to now')); // open the picker
    await userEvent.click(screen.getByText('Last 30 minutes')); // select the quick range, should close picker.

    expect(screen.queryByText('Specify time range')).not.toBeInTheDocument();
    expect(screen.queryByText('Example time ranges')).not.toBeInTheDocument();

    expect(screen.getByText('now-30m to now')).toBeInTheDocument(); // new text on picker button
  });
});
