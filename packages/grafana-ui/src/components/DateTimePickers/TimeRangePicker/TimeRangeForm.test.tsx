import React from 'react';
import { render, RenderResult } from '@testing-library/react';
import { getDefaultTimeRange, TimeRange, TimeZone } from '@grafana/data';
import { TimeRangeForm } from './TimeRangeForm';

function setup(initial: TimeRange = getDefaultTimeRange(), timeZone?: TimeZone): RenderResult {
  return render(<TimeRangeForm isFullscreen={true} value={initial} onApply={() => {}} timeZone={timeZone} />);
}

describe('TimeRangeForm', () => {
  it('renders buttons correcty', () => {
    const container = setup();

    expect(container.queryByLabelText(/timepicker open button/i)).toBeInTheDocument();
  });
});
