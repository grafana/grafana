import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

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

  it('should update date onblur', () => {
    renderDatetimePicker();
    const dateTimeInput = screen.getByTestId('date-time-input');
    fireEvent.change(dateTimeInput, { target: { value: '2021-07-31 12:30:30' } });
    fireEvent.blur(dateTimeInput);

    expect(dateTimeInput).toHaveDisplayValue('2021-07-31 12:30:30');
  });
});
