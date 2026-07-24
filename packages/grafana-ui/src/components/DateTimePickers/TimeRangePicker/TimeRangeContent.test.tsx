import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { dateTimeParse, systemDateFormats, type TimeRange } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { TimeRangeContent } from './TimeRangeContent';

const mockClipboard = {
  writeText: jest.fn(),
  readText: jest.fn(),
};

const defaultTimeRange: TimeRange = {
  from: dateTimeParse('2021-06-17 00:00:00', { timeZone: 'utc' }),
  to: dateTimeParse('2021-06-19 23:59:00', { timeZone: 'utc' }),
  raw: {
    from: '2021-06-17 00:00:00',
    to: '2021-06-19 23:59:00',
  },
};

const customRawTimeRange = {
  from: '2023-06-17 00:00:00',
  to: '2023-06-19 23:59:00',
};

function setup(initial: TimeRange = defaultTimeRange, timeZone = 'utc') {
  return {
    ...render(<TimeRangeContent isFullscreen={true} value={initial} onApply={() => {}} timeZone={timeZone} />),
    getCalendarDayByLabelText: (label: string) => {
      const item = screen.getByLabelText(label);
      return item?.parentElement as HTMLButtonElement;
    },
  };
}

describe('TimeRangeForm', () => {
  let user: ReturnType<typeof userEvent.setup>;
  beforeEach(() => {
    mockClipboard.writeText.mockClear();
    mockClipboard.readText.mockClear();
    user = userEvent.setup();
    Object.defineProperty(global.navigator, 'clipboard', {
      value: mockClipboard,
    });
  });

  it('should render form correctly', async () => {
    const { findByLabelText, findByText, findAllByRole } = setup();

    expect(await findByText('Apply time range')).toBeInTheDocument();
    expect(await findAllByRole('button', { name: 'Open calendar' })).toHaveLength(2);
    expect(await findByLabelText('From')).toBeInTheDocument();
    expect(await findByLabelText('To')).toBeInTheDocument();
  });

  it('should display calendar when clicking the calendar icon', async () => {
    const user = userEvent.setup();
    setup();
    const { TimePicker } = selectors.components;
    const openCalendarButton = screen.getAllByRole('button', { name: 'Open calendar' });

    await user.click(openCalendarButton[0]);
    expect(screen.getByLabelText(TimePicker.calendar.label)).toBeInTheDocument();
  });

  it('should have passed time range entered in form', async () => {
    const { findByLabelText } = setup();

    const fromValue = defaultTimeRange.raw.from as string;
    const toValue = defaultTimeRange.raw.to as string;

    expect(await findByLabelText('From')).toHaveValue(fromValue);
    expect(await findByLabelText('To')).toHaveValue(toValue);
  });

  it('should parse UTC iso strings and render in current timezone', async () => {
    const { findByLabelText } = setup(
      {
        from: defaultTimeRange.from,
        to: defaultTimeRange.to,
        raw: {
          from: defaultTimeRange.from.toISOString(),
          to: defaultTimeRange.to.toISOString(),
        },
      },
      'America/New_York'
    );

    expect(await findByLabelText('From')).toHaveValue('2021-06-16 20:00:00');
    expect(await findByLabelText('To')).toHaveValue('2021-06-19 19:59:00');
  });

  it('copy in UTC then paste into different timezone should convert times', async () => {
    const sourceRange: TimeRange = {
      from: defaultTimeRange.from,
      to: defaultTimeRange.to,
      raw: {
        from: defaultTimeRange.from,
        to: defaultTimeRange.to,
      },
    };

    const source = setup(sourceRange);

    let written = '';
    mockClipboard.writeText.mockImplementation((text: string) => {
      written = text;
      return Promise.resolve();
    });

    await user.click(within(source.container).getByTestId('data-testid TimePicker copy button'));

    const target = setup(undefined, 'America/New_York');

    mockClipboard.readText.mockResolvedValue(written);

    const targetPasteButton = within(target.container).getByTestId('data-testid TimePicker paste button');
    await user.click(targetPasteButton);

    expect(within(target.container).getByLabelText('From')).toHaveValue('2021-06-16 20:00:00');
    expect(within(target.container).getByLabelText('To')).toHaveValue('2021-06-19 19:59:00');
  });

  describe('Given custom system date format', () => {
    const originalFullDate = systemDateFormats.fullDate;
    beforeEach(() => {
      systemDateFormats.fullDate = 'DD.MM.YYYY HH:mm:ss';
    });

    afterAll(() => {
      systemDateFormats.fullDate = originalFullDate;
    });

    it('should parse UTC iso strings and render current timezone', async () => {
      const { findByLabelText } = setup(
        {
          from: defaultTimeRange.from,
          to: defaultTimeRange.to,
          raw: {
            from: defaultTimeRange.from.toISOString(),
            to: defaultTimeRange.to.toISOString(),
          },
        },
        'America/New_York'
      );

      expect(await findByLabelText('From')).toHaveValue('16.06.2021 20:00:00');
      expect(await findByLabelText('To')).toHaveValue('19.06.2021 19:59:00');
    });
  });

  it('should close calendar when clicking the close icon', async () => {
    const { queryByLabelText, getAllByRole, getByRole } = setup();
    const { TimePicker } = selectors.components;
    const openCalendarButton = getAllByRole('button', { name: 'Open calendar' });

    await user.click(openCalendarButton[0]);
    expect(getByRole('button', { name: 'Close calendar' })).toBeInTheDocument();

    await user.click(getByRole('button', { name: 'Close calendar' }));
    expect(queryByLabelText(TimePicker.calendar.label)).not.toBeInTheDocument();
  });

  it('should not display calendar without clicking the calendar icon', async () => {
    const { queryByLabelText, findAllByLabelText } = setup();
    const { TimePicker } = selectors.components;

    expect(await findAllByLabelText('Open calendar')).toHaveLength(2);
    expect(queryByLabelText(TimePicker.calendar.label)).not.toBeInTheDocument();
  });

  it('should have passed time range selected in calendar', async () => {
    const { getAllByRole, getCalendarDayByLabelText } = setup();
    const openCalendarButton = getAllByRole('button', { name: 'Open calendar' });

    await user.click(openCalendarButton[0]);
    const from = getCalendarDayByLabelText('June 17, 2021');
    const to = getCalendarDayByLabelText('June 19, 2021');

    expect(from).toHaveClass('react-calendar__tile--rangeStart');
    expect(to).toHaveClass('react-calendar__tile--rangeEnd');
  });

  it('should select correct time range in calendar when having a custom time zone', async () => {
    const { getAllByRole, getCalendarDayByLabelText } = setup(defaultTimeRange, 'Asia/Tokyo');
    const openCalendarButton = getAllByRole('button', { name: 'Open calendar' });

    await user.click(openCalendarButton[1]);
    const from = getCalendarDayByLabelText('June 17, 2021');
    const to = getCalendarDayByLabelText('June 19, 2021');

    expect(from).toHaveClass('react-calendar__tile--rangeStart');
    expect(to).toHaveClass('react-calendar__tile--rangeEnd');
  });

  it('should update the selected range when clicking the same date twice in the calendar', async () => {
    const { getAllByRole, getCalendarDayByLabelText, findByLabelText } = setup();
    const openCalendarButton = getAllByRole('button', { name: 'Open calendar' });

    await user.click(openCalendarButton[0]);

    const targetDay = getCalendarDayByLabelText('June 15, 2021');
    await user.click(targetDay);
    await user.click(targetDay);

    const updatedTarget = getCalendarDayByLabelText('June 15, 2021');
    expect(updatedTarget).toHaveClass('react-calendar__tile--rangeStart');
    expect(updatedTarget).toHaveClass('react-calendar__tile--rangeEnd');

    const previousRangeStart = getCalendarDayByLabelText('June 17, 2021');
    expect(previousRangeStart).not.toHaveClass('react-calendar__tile--rangeStart');

    expect(await findByLabelText('From')).toHaveValue('2021-06-15 00:00:00');
    expect(await findByLabelText('To')).toHaveValue('2021-06-15 23:59:59');
  });

  it('should copy time range to clipboard', async () => {
    setup();

    await user.click(screen.getByTestId('data-testid TimePicker copy button'));
    expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith(
      JSON.stringify({ from: defaultTimeRange.raw.from, to: defaultTimeRange.raw.to })
    );
  });

  it('should paste time range from clipboard', async () => {
    const { getByTestId, getByLabelText } = setup();

    mockClipboard.readText.mockResolvedValue(JSON.stringify(customRawTimeRange));

    await userEvent.click(getByTestId('data-testid TimePicker paste button'));

    expect(getByLabelText('From')).toHaveValue(customRawTimeRange.from);
    expect(getByLabelText('To')).toHaveValue(customRawTimeRange.to);
  });

  describe('dates error handling', () => {
    it('should show error on invalid dates', async () => {
      const invalidTimeRange: TimeRange = {
        from: dateTimeParse('foo', { timeZone: 'utc' }),
        to: dateTimeParse('2021-06-19 23:59:00', { timeZone: 'utc' }),
        raw: {
          from: 'foo',
          to: '2021-06-19 23:59:00',
        },
      };
      const { getAllByRole } = setup(invalidTimeRange, 'Asia/Tokyo');
      await userEvent.click(screen.getByRole('button', { name: 'Apply time range' }));
      const error = getAllByRole('alert');

      expect(error).toHaveLength(1);
      expect(error[0]).toBeVisible();
      expect(error[0]).toHaveTextContent('Enter a date (YYYY-MM-DD HH:mm:ss) or relative time (now, now-1h)');
    });

    it('should show error on invalid range', async () => {
      const invalidTimeRange: TimeRange = {
        from: dateTimeParse('2021-06-19 00:00:00', { timeZone: 'utc' }),
        to: dateTimeParse('2021-06-17 23:59:00', { timeZone: 'utc' }),
        raw: {
          from: '2021-06-19 00:00:00',
          to: '2021-06-17 23:59:00',
        },
      };
      const { getAllByRole } = setup(invalidTimeRange, 'Asia/Tokyo');
      await userEvent.click(screen.getByRole('button', { name: 'Apply time range' }));
      const error = getAllByRole('alert');

      expect(error[0]).toBeVisible();
      expect(error[0]).toHaveTextContent('"From" date must be before "To" date');
    });

    it('should not show range error when "to" is invalid', async () => {
      const invalidTimeRange: TimeRange = {
        from: dateTimeParse('2021-06-19 00:00:00', { timeZone: 'utc' }),
        to: dateTimeParse('foo', { timeZone: 'utc' }),
        raw: {
          from: '2021-06-19 00:00:00',
          to: 'foo',
        },
      };
      const { getAllByRole } = setup(invalidTimeRange, 'Asia/Tokyo');
      await userEvent.click(screen.getByRole('button', { name: 'Apply time range' }));
      const error = getAllByRole('alert');

      expect(error).toHaveLength(1);
      expect(error[0]).toBeVisible();
      expect(error[0]).toHaveTextContent('Enter a date (YYYY-MM-DD HH:mm:ss) or relative time (now, now-1h)');
    });
  });
});
