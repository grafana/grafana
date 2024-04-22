import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { dateTime, getTimeZone, setTimeZoneResolver } from '@grafana/data';
import { Components } from '@grafana/e2e-selectors';

import { DateTimePicker, Props } from './DateTimePicker';

// An assortment of timezones that we will test the behavior of the DateTimePicker with different timezones
const TEST_TIMEZONES = ['browser', 'Europe/Stockholm', 'America/Indiana/Marengo'];

let defaultTimeZone = getTimeZone();
afterAll(() => {
  return setTimeZoneResolver(() => defaultTimeZone);
});

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

  it.each(TEST_TIMEZONES)('should render (timezone %s)', (timeZone) => {
    setTimeZoneResolver(() => timeZone);
    renderDatetimePicker();
    const dateTimeInput = screen.getByTestId(Components.DateTimePicker.input);
    expect(dateTimeInput).toHaveDisplayValue('2021-05-05 12:00:00');
  });

  it.each(TEST_TIMEZONES)('should update date onblur (timezone: %)', async () => {
    const onChangeInput = jest.fn();
    render(<DateTimePicker date={dateTime('2021-05-05 12:00:00')} onChange={onChangeInput} />);
    const dateTimeInput = screen.getByTestId(Components.DateTimePicker.input);
    await userEvent.clear(dateTimeInput);
    await userEvent.type(dateTimeInput, '2021-07-31 12:30:30');
    expect(dateTimeInput).toHaveDisplayValue('2021-07-31 12:30:30');
    await userEvent.click(document.body);
    expect(onChangeInput).toHaveBeenCalled();
  });

  it('should not update onblur if invalid date', async () => {
    const onChangeInput = jest.fn();
    render(<DateTimePicker date={dateTime('2021-05-05 12:00:00')} onChange={onChangeInput} />);
    const dateTimeInput = screen.getByTestId(Components.DateTimePicker.input);
    await userEvent.clear(dateTimeInput);
    await userEvent.type(dateTimeInput, '2021:05:05 12-00-00');
    expect(dateTimeInput).toHaveDisplayValue('2021:05:05 12-00-00');
    await userEvent.click(document.body);
    expect(onChangeInput).not.toHaveBeenCalled();
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
