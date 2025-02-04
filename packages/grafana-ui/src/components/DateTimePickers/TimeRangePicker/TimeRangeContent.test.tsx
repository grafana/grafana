import { fireEvent, render, RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { dateTimeParse, systemDateFormats, TimeRange } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import { TimeRangeContent } from './TimeRangeContent';

type TimeRangeFormRenderResult = RenderResult & {
  getCalendarDayByLabelText(label: string): HTMLButtonElement;
};

const mockClipboard = {
  writeText: jest.fn(),
  readText: jest.fn(),
};

Object.defineProperty(global.navigator, 'clipboard', {
  value: mockClipboard,
});

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

function setup(initial: TimeRange = defaultTimeRange, timeZone = 'utc'): TimeRangeFormRenderResult {
  const result = render(
    <TimeRangeContent isFullscreen={true} value={initial} onApply={() => {}} timeZone={timeZone} />
  );

  return {
    ...result,
    getCalendarDayByLabelText: (label: string) => {
      const item = result.getByLabelText(label);
      return item?.parentElement as HTMLButtonElement;
    },
  };
}

describe('TimeRangeForm', () => {
  it('should render form correctly', () => {
    const { getByLabelText, getByText, getAllByRole } = setup();

    expect(getByText('Apply time range')).toBeInTheDocument();
    expect(getAllByRole('button', { name: 'Open calendar' })).toHaveLength(2);
    expect(getByLabelText('From')).toBeInTheDocument();
    expect(getByLabelText('To')).toBeInTheDocument();
  });

  it('should display calendar when clicking the calendar icon', () => {
    const { getByLabelText, getAllByRole } = setup();
    const { TimePicker } = selectors.components;
    const openCalendarButton = getAllByRole('button', { name: 'Open calendar' });

    fireEvent.click(openCalendarButton[0]);
    expect(getByLabelText(TimePicker.calendar.label)).toBeInTheDocument();
  });

  it('should have passed time range entered in form', () => {
    const { getByLabelText } = setup();

    const fromValue = defaultTimeRange.raw.from as string;
    const toValue = defaultTimeRange.raw.to as string;

    expect(getByLabelText('From')).toHaveValue(fromValue);
    expect(getByLabelText('To')).toHaveValue(toValue);
  });

  it('should parse UTC iso strings and render in current timezone', () => {
    const { getByLabelText } = setup(
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

    expect(getByLabelText('From')).toHaveValue('2021-06-16 20:00:00');
    expect(getByLabelText('To')).toHaveValue('2021-06-19 19:59:00');
  });

  describe('Given custom system date format', () => {
    const originalFullDate = systemDateFormats.fullDate;
    beforeEach(() => {
      systemDateFormats.fullDate = 'DD.MM.YYYY HH:mm:ss';
    });

    afterAll(() => {
      systemDateFormats.fullDate = originalFullDate;
    });

    it('should parse UTC iso strings and render in current timezone', () => {
      const { getByLabelText } = setup(
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

      expect(getByLabelText('From')).toHaveValue('16.06.2021 20:00:00');
      expect(getByLabelText('To')).toHaveValue('19.06.2021 19:59:00');
    });
  });

  it('should close calendar when clicking the close icon', () => {
    const { queryByLabelText, getAllByRole, getByRole } = setup();
    const { TimePicker } = selectors.components;
    const openCalendarButton = getAllByRole('button', { name: 'Open calendar' });

    fireEvent.click(openCalendarButton[0]);
    expect(getByRole('button', { name: 'Close calendar' })).toBeInTheDocument();

    fireEvent.click(getByRole('button', { name: 'Close calendar' }));
    expect(queryByLabelText(TimePicker.calendar.label)).toBeNull();
  });

  it('should not display calendar without clicking the calendar icon', () => {
    const { queryByLabelText } = setup();
    const { TimePicker } = selectors.components;

    expect(queryByLabelText(TimePicker.calendar.label)).toBeNull();
  });

  it('should have passed time range selected in calendar', () => {
    const { getAllByRole, getCalendarDayByLabelText } = setup();
    const openCalendarButton = getAllByRole('button', { name: 'Open calendar' });

    fireEvent.click(openCalendarButton[0]);
    const from = getCalendarDayByLabelText('June 17, 2021');
    const to = getCalendarDayByLabelText('June 19, 2021');

    expect(from).toHaveClass('react-calendar__tile--rangeStart');
    expect(to).toHaveClass('react-calendar__tile--rangeEnd');
  });

  it('should select correct time range in calendar when having a custom time zone', () => {
    const { getAllByRole, getCalendarDayByLabelText } = setup(defaultTimeRange, 'Asia/Tokyo');
    const openCalendarButton = getAllByRole('button', { name: 'Open calendar' });

    fireEvent.click(openCalendarButton[1]);
    const from = getCalendarDayByLabelText('June 17, 2021');
    const to = getCalendarDayByLabelText('June 19, 2021');

    expect(from).toHaveClass('react-calendar__tile--rangeStart');
    expect(to).toHaveClass('react-calendar__tile--rangeEnd');
  });

  it('should copy time range to clipboard', async () => {
    const { getByTestId } = setup();

    await userEvent.click(getByTestId('data-testid TimePicker copy button'));
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
    it('should show error on invalid dates', () => {
      const invalidTimeRange: TimeRange = {
        from: dateTimeParse('foo', { timeZone: 'utc' }),
        to: dateTimeParse('2021-06-19 23:59:00', { timeZone: 'utc' }),
        raw: {
          from: 'foo',
          to: '2021-06-19 23:59:00',
        },
      };
      const { getAllByRole } = setup(invalidTimeRange, 'Asia/Tokyo');
      const error = getAllByRole('alert');

      expect(error).toHaveLength(1);
      expect(error[0]).toBeVisible();
      expect(error[0]).toHaveTextContent('Please enter a past date or "now"');
    });

    it('should show error on invalid range', () => {
      const invalidTimeRange: TimeRange = {
        from: dateTimeParse('2021-06-19 00:00:00', { timeZone: 'utc' }),
        to: dateTimeParse('2021-06-17 23:59:00', { timeZone: 'utc' }),
        raw: {
          from: '2021-06-19 00:00:00',
          to: '2021-06-17 23:59:00',
        },
      };
      const { getAllByRole } = setup(invalidTimeRange, 'Asia/Tokyo');
      const error = getAllByRole('alert');

      expect(error[0]).toBeVisible();
      expect(error[0]).toHaveTextContent('"From" can\'t be after "To"');
    });

    it('should not show range error when "to" is invalid', () => {
      const invalidTimeRange: TimeRange = {
        from: dateTimeParse('2021-06-19 00:00:00', { timeZone: 'utc' }),
        to: dateTimeParse('foo', { timeZone: 'utc' }),
        raw: {
          from: '2021-06-19 00:00:00',
          to: 'foo',
        },
      };
      const { getAllByRole } = setup(invalidTimeRange, 'Asia/Tokyo');
      const error = getAllByRole('alert');

      expect(error).toHaveLength(1);
      expect(error[0]).toBeVisible();
      expect(error[0]).toHaveTextContent('Please enter a past date or "now"');
    });
  });
});
