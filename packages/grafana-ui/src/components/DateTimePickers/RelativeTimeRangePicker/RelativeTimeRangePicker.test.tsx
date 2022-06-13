import { render, fireEvent, RenderResult } from '@testing-library/react';
import React, { useState } from 'react';

import { RelativeTimeRange } from '@grafana/data';

import { RelativeTimeRangePicker } from './RelativeTimeRangePicker';

function setup(initial: RelativeTimeRange = { from: 900, to: 0 }): RenderResult {
  const StatefulPicker: React.FC<{}> = () => {
    const [value, setValue] = useState<RelativeTimeRange>(initial);
    return <RelativeTimeRangePicker timeRange={value} onChange={setValue} />;
  };

  return render(<StatefulPicker />);
}

describe('RelativeTimePicker', () => {
  it('should render the picker button with an user friendly text', () => {
    const { getByText } = setup({ from: 900, to: 0 });
    expect(getByText('now-15m to now')).toBeInTheDocument();
  });

  it('should open the picker when clicking the button', () => {
    const { getByText } = setup({ from: 900, to: 0 });

    fireEvent.click(getByText('now-15m to now'));

    expect(getByText('Specify time range')).toBeInTheDocument();
    expect(getByText('Example time ranges')).toBeInTheDocument();
  });

  it('should not have open picker without clicking the button', () => {
    const { queryByText } = setup({ from: 900, to: 0 });
    expect(queryByText('Specify time range')).toBeNull();
    expect(queryByText('Example time ranges')).toBeNull();
  });

  it('should not be able to apply range via quick options', () => {
    const { getByText, queryByText } = setup({ from: 900, to: 0 });

    fireEvent.click(getByText('now-15m to now')); // open the picker
    fireEvent.click(getByText('Last 30 minutes')); // select the quick range, should close picker.

    expect(queryByText('Specify time range')).toBeNull();
    expect(queryByText('Example time ranges')).toBeNull();

    expect(getByText('now-30m to now')).toBeInTheDocument(); // new text on picker button
  });
});
