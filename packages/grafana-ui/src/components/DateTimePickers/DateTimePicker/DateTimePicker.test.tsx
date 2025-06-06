import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { dateTime, dateTimeAsMoment, dateTimeForTimeZone, getTimeZone, setTimeZoneResolver } from '@grafana/data';
import { Components } from '@grafana/e2e-selectors';

import { DateTimePicker, Props } from './DateTimePicker';

// An assortment of timezones that we will test the behavior of the DateTimePicker with different timezones
const TEST_TIMEZONES = ['browser', 'Europe/Stockholm', 'America/Indiana/Marengo'];

const defaultTimeZone = getTimeZone();
afterAll(() => {
  return setTimeZoneResolver(() => defaultTimeZone);
});

const renderDatetimePicker = (props?: Partial<Props>) => {
  const combinedProps = Object.assign(
    {
      date: dateTimeForTimeZone(getTimeZone(), '2021-05-05 12:00:00'),
      onChange: () => {},
    },
    props
  );

  return render(<DateTimePicker {...combinedProps} />);
};

describe('Date time picker', () => {
  it('should render component', () => {
    renderDatetimePicker();

    expect(screen.getByTestId('date-time-picker')).toBeInTheDocument();
  });

  it.each(TEST_TIMEZONES)('input should have a value (timezone: %s)', (timeZone) => {
    setTimeZoneResolver(() => timeZone);
    renderDatetimePicker();
    const dateTimeInput = screen.getByTestId(Components.DateTimePicker.input);
    expect(dateTimeInput).toHaveDisplayValue('2021-05-05 12:00:00');
  });

  it.each(TEST_TIMEZONES)('should render (timezone %s)', (timeZone) => {
    setTimeZoneResolver(() => timeZone);
    renderDatetimePicker();
    const dateTimeInput = screen.getByTestId(Components.DateTimePicker.input);
    expect(dateTimeInput).toHaveDisplayValue('2021-05-05 12:00:00');
  });

  it.each(TEST_TIMEZONES)('should update date onblur (timezone: %)', async (timeZone) => {
    setTimeZoneResolver(() => timeZone);
    const onChangeInput = jest.fn();
    render(<DateTimePicker date={dateTime('2021-05-05 12:00:00')} onChange={onChangeInput} />);
    const dateTimeInput = screen.getByTestId(Components.DateTimePicker.input);
    await userEvent.clear(dateTimeInput);
    await userEvent.type(dateTimeInput, '2021-07-31 12:30:30');
    expect(dateTimeInput).toHaveDisplayValue('2021-07-31 12:30:30');
    await userEvent.click(document.body);
    expect(onChangeInput).toHaveBeenCalled();
  });

  it.each(TEST_TIMEZONES)('should not update onblur if invalid date (timezone: %s)', async (timeZone) => {
    setTimeZoneResolver(() => timeZone);
    const onChangeInput = jest.fn();
    render(<DateTimePicker date={dateTime('2021-05-05 12:00:00')} onChange={onChangeInput} />);
    const dateTimeInput = screen.getByTestId(Components.DateTimePicker.input);
    await userEvent.clear(dateTimeInput);
    await userEvent.type(dateTimeInput, '2021:05:05 12-00-00');
    expect(dateTimeInput).toHaveDisplayValue('2021:05:05 12-00-00');
    await userEvent.click(document.body);
    expect(onChangeInput).not.toHaveBeenCalled();
  });

  it.each(TEST_TIMEZONES)(
    'should not change the day at times near the day boundary (timezone: %s)',
    async (timeZone) => {
      setTimeZoneResolver(() => timeZone);
      const onChangeInput = jest.fn();
      render(<DateTimePicker date={dateTime('2021-05-05 12:34:56')} onChange={onChangeInput} />);

      // Click the calendar button
      await userEvent.click(screen.getByRole('button', { name: 'Time picker' }));

      // Check the active day is the 5th
      expect(screen.getByRole('button', { name: 'May 5, 2021' })).toHaveClass('react-calendar__tile--active');

      // open the time of day overlay
      await userEvent.click(screen.getAllByRole('textbox')[1]);
      const hourList = screen.getAllByRole('list')[0];

      // change the hour
      await userEvent.click(within(hourList).getByText('00'));

      // Check the active day is the 5th
      expect(screen.getByRole('button', { name: 'May 5, 2021' })).toHaveClass('react-calendar__tile--active');

      // change the hour
      await userEvent.click(within(hourList).getByText('23'));

      // Check the active day is the 5th
      expect(screen.getByRole('button', { name: 'May 5, 2021' })).toHaveClass('react-calendar__tile--active');
    }
  );

  it.each(TEST_TIMEZONES)(
    'should not reset the time when selecting a different day (timezone: %s)',
    async (timeZone) => {
      setTimeZoneResolver(() => timeZone);
      const onChangeInput = jest.fn();
      render(<DateTimePicker date={dateTime('2021-05-05 12:34:56')} onChange={onChangeInput} />);

      // Click the calendar button
      await userEvent.click(screen.getByRole('button', { name: 'Time picker' }));

      // Select a different day in the calendar
      await userEvent.click(screen.getByRole('button', { name: 'May 15, 2021' }));

      const timeInput = screen.getAllByRole('textbox')[1];
      expect(timeInput).not.toHaveDisplayValue('00:00:00');
    }
  );

  it.each(TEST_TIMEZONES)(
    'should always show the correct matching day in the calendar (timezone: %s)',
    async (timeZone) => {
      setTimeZoneResolver(() => timeZone);
      const onChangeInput = jest.fn();
      render(<DateTimePicker date={dateTime('2021-05-05T23:59:41.000000Z')} onChange={onChangeInput} />);

      const dateTimeInputValue = screen.getByTestId(Components.DateTimePicker.input).getAttribute('value')!;

      // takes the string from the input
      // depending on the timezone, this will look something like 2024-04-05 19:59:41
      // parses out the day value and strips the leading 0
      const day = parseInt(dateTimeInputValue.split(' ')[0].split('-')[2], 10);

      // Click the calendar button
      await userEvent.click(screen.getByRole('button', { name: 'Time picker' }));

      // Check the active day matches the input
      expect(screen.getByRole('button', { name: `May ${day}, 2021` })).toHaveClass('react-calendar__tile--active');
    }
  );

  it.each(TEST_TIMEZONES)(
    'should always show the correct matching day when selecting a date in the calendar (timezone: %s)',
    async (timeZone) => {
      setTimeZoneResolver(() => timeZone);
      const onChangeInput = jest.fn();
      render(<DateTimePicker date={dateTime('2021-05-05T23:59:41.000000Z')} onChange={onChangeInput} />);

      // Click the calendar button
      await userEvent.click(screen.getByRole('button', { name: 'Time picker' }));

      // Select a new day
      const day = 8;
      await userEvent.click(screen.getByRole('button', { name: `May ${day}, 2021` }));
      await userEvent.click(screen.getByRole('button', { name: 'Apply' }));

      const onChangeInputArg = onChangeInput.mock.calls[0][0];

      expect(dateTimeAsMoment(dateTimeForTimeZone(timeZone, onChangeInputArg)).date()).toBe(day);
    }
  );

  it.each(TEST_TIMEZONES)('should not alter a UTC time when blurring (timezone: %s)', async (timeZone) => {
    setTimeZoneResolver(() => timeZone);
    const onChangeInput = jest.fn();

    // render with a UTC value
    const { rerender } = render(
      <DateTimePicker date={dateTime('2024-04-16T08:44:41.000000Z')} onChange={onChangeInput} />
    );

    const inputValue = screen.getByTestId(Components.DateTimePicker.input).getAttribute('value')!;

    // blur the input to trigger an onChange
    await userEvent.click(screen.getByTestId(Components.DateTimePicker.input));
    await userEvent.click(document.body);

    const onChangeValue = onChangeInput.mock.calls[0][0];
    expect(onChangeInput).toHaveBeenCalledWith(onChangeValue);

    // now rerender with the "changed" value
    rerender(<DateTimePicker date={onChangeValue} onChange={onChangeInput} />);

    // expect the input to show the same value
    expect(screen.getByTestId(Components.DateTimePicker.input)).toHaveDisplayValue(inputValue);

    // blur the input to trigger an onChange
    await userEvent.click(screen.getByTestId(Components.DateTimePicker.input));
    await userEvent.click(document.body);

    // expect the onChange to be called with the same value
    expect(onChangeInput).toHaveBeenCalledWith(onChangeValue);
  });

  it.each(TEST_TIMEZONES)(
    'should be able to select values in TimeOfDayPicker without blurring the element (timezone: %s)',
    async (timeZone) => {
      setTimeZoneResolver(() => timeZone);
      renderDatetimePicker();

      // open the calendar + time picker
      await userEvent.click(screen.getByLabelText('Time picker'));

      // open the time of day overlay
      await userEvent.click(screen.getAllByRole('textbox')[1]);

      // check the hour element is visible
      const hourElement = screen.getAllByText('00')[0];
      expect(hourElement).toBeVisible();

      // select the hour value and check it's still visible
      await userEvent.click(hourElement);
      expect(hourElement).toBeVisible();

      // click outside the overlay and check the hour element is no longer visible
      await userEvent.click(document.body);
      expect(screen.queryByText('00')).not.toBeInTheDocument();
    }
  );

  it('should be able to use a custom timeZone', async () => {
    renderDatetimePicker({
      timeZone: 'America/New_York',
      date: dateTimeForTimeZone(getTimeZone({ timeZone: 'utc' }), '2024-07-01 02:00:00'),
    });

    const dateTimeInput = screen.getByTestId(Components.DateTimePicker.input);
    expect(dateTimeInput).toHaveDisplayValue('2024-06-30 22:00:00');

    await userEvent.click(screen.getByRole('button', { name: 'Time picker' }));
    // Check that calendar date is set correctly
    expect(screen.getByRole('button', { name: `June 30, 2024` })).toHaveClass('react-calendar__tile--active');
    // Check that time is set correctly
    expect(screen.getAllByRole('textbox')[1]).toHaveValue('22:00:00');
  });
});
