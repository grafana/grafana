import React from 'react';
import { render, screen } from '@testing-library/react';
import { dateTime } from '@grafana/data';
import { DateTimePicker } from './DateTimePicker';

const renderDatetimePicker = () => {
  return render(<DateTimePicker date={dateTime('2021-05-05 12:00:00')} onChange={() => {}} />);
};

describe('Date time picker', () => {
  it('should render component', () => {
    renderDatetimePicker();

    expect(screen.queryByTestId('date-time-picker')).toBeInTheDocument();
  });

  it('input should have a value', () => {
    renderDatetimePicker();

    expect(screen.queryByDisplayValue('2021-05-05 12:00:00')).toBeInTheDocument();
  });
});
