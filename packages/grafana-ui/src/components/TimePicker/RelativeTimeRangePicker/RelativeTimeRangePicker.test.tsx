import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { RelativeTimeRangePicker } from './RelativeTimeRangePicker';

describe('RelativeTimePicker', () => {
  it('should render the picker button with an user friendly text', () => {
    const { getByText } = render(
      <RelativeTimeRangePicker
        onChange={(value) => {}}
        timeRange={{
          from: 900,
          to: 0,
        }}
      />
    );

    expect(getByText('Last 900 seconds')).toBeInTheDocument();
  });

  it('should open the picker when clicking the button', () => {
    const { getByText } = render(
      <RelativeTimeRangePicker
        onChange={(value) => {}}
        timeRange={{
          from: 900,
          to: 0,
        }}
      />
    );

    fireEvent.click(getByText('Last 900 seconds'));

    expect(getByText('Specify time range')).toBeInTheDocument();
    expect(getByText('Example time ranges')).toBeInTheDocument();
  });

  it('should not have open picker without clicking the button', () => {
    const { queryByText } = render(
      <RelativeTimeRangePicker
        onChange={(value) => {}}
        timeRange={{
          from: 900,
          to: 0,
        }}
      />
    );

    expect(queryByText('Specify time range')).not.toBeInTheDocument();
    expect(queryByText('Example time ranges')).not.toBeInTheDocument();
  });
});
