import React from 'react';
import { render, screen } from '@testing-library/react';
import { dateTime } from '@grafana/data';
import { DateTimePicker, Props } from './DateTimePicker';

const renderDatetimePicker = (props?: Props) => {
  const combinedProps = Object.assign(
    {
      date: dateTime('2021-05-05 12:00:00'),
      onChange: () => {},
    },
    props
  );

  return render(<DateTimePicker {...combinedProps} />);
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

  it('should ');
});
