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

    await userEvent.click(screen.getByLabelText('Time picker'));
    await userEvent.click(screen.getAllByRole('textbox')[1]);

    const hourElement = screen.getAllByRole('button', {
      name: '00',
    })[0];
    expect(hourElement).toBeVisible();

    await userEvent.click(hourElement);
    expect(hourElement).toBeVisible();

    await userEvent.click(document.body);
    expect(
      screen.queryByRole('button', {
        name: '00',
      })
    ).not.toBeInTheDocument();
  });
});
