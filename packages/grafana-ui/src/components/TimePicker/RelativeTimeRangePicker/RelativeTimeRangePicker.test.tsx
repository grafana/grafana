import React, { useState } from 'react';
import { render, fireEvent, RenderResult } from '@testing-library/react';
import { RelativeTimeRangePicker } from './RelativeTimeRangePicker';
import { RelativeTimeRange } from '@grafana/data';

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
    expect(getByText('Last 15 minutes')).toBeInTheDocument();
  });

  it('should open the picker when clicking the button', () => {
    const { getByText } = setup({ from: 900, to: 0 });

    fireEvent.click(getByText('Last 15 minutes'));

    expect(getByText('Specify time range')).toBeInTheDocument();
    expect(getByText('Example time ranges')).toBeInTheDocument();
  });

  it('should not have open picker without clicking the button', () => {
    const { queryByText } = setup({ from: 900, to: 0 });
    expect(queryByText('Specify time range')).toBeNull();
    expect(queryByText('Example time ranges')).toBeNull();
  });
});
