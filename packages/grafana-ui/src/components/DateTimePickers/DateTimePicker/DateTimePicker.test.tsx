import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('should be able to select values in TimeOfDayPicker without blurring the element', async () => {
    renderDatetimePicker();

    // open the calendar + time picker
    await userEvent.click(screen.getByLabelText('Time picker'));

    // open the time of day overlay
    await userEvent.click(screen.getAllByRole('textbox')[1]);

    // check the hour element is visible
    const hourElement = screen.getAllByRole('button', {
      name: '00',
    })[0];
    expect(hourElement).toBeVisible();

    // select the hour value and check it's still visible
    await userEvent.click(hourElement);
    expect(hourElement).toBeVisible();

    // click outside the overlay and check the hour element is no longer visible
    await userEvent.click(document.body);
    expect(
      screen.queryByRole('button', {
        name: '00',
      })
    ).not.toBeInTheDocument();
  });
});
