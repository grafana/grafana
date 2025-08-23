import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { dateTimeParse, FeatureToggles, systemDateFormats, TimeRange } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

import * as commonFormatModule from '../commonFormat';

import { TimeRangeContent } from './TimeRangeContent';

// If this flag is deleted, this mock also should be, and the additional tests for when
// the flag was disabled.
type LocaleFormatPreferenceType = FeatureToggles['localeFormatPreference'];
jest.mock('../commonFormat', () => {
  const format = 'YYYY-MM-DD HH:mm:ss' as const;
  const moduleObject = {
    __esModule: true,
    commonFormat: format as undefined | 'YYYY-MM-DD HH:mm:ss',
    mockSetCommonFormat,
  };
  function mockSetCommonFormat(enabled: LocaleFormatPreferenceType = true) {
    moduleObject.commonFormat = enabled ? format : undefined;
  }
  return moduleObject;
});
// @ts-expect-error mockSetCommonFormat doesn't exist on the export type of commonFormat,
// but it's added above in the mock.
const mockSetCommonFormat: (enabled: LocaleFormatPreferenceType) => void = commonFormatModule.mockSetCommonFormat;

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

const mockOnApply = jest.fn();

beforeEach(() => {
  mockSetCommonFormat(true);
  mockOnApply.mockClear();
});

function setup(initial: TimeRange = defaultTimeRange, timeZone = 'utc') {
  return {
    ...render(<TimeRangeContent isFullscreen={true} value={initial} onApply={mockOnApply} timeZone={timeZone} />),
    getCalendarDayByLabelText: (label: string) => {
      const item = screen.getByLabelText(label);
      return item?.parentElement as HTMLButtonElement;
    },
  };
}

describe('TimeRangeForm', () => {
  let user: ReturnType<typeof userEvent.setup>;
  mockClipboard.writeText.mockClear();
  mockClipboard.readText.mockClear();
  beforeEach(() => {
    mockClipboard.writeText.mockClear();
    mockClipboard.readText.mockClear();
    user = userEvent.setup();
    Object.defineProperty(global.navigator, 'clipboard', {
      value: mockClipboard,
    });
  });

  it('should render form correctly', () => {
    const { getByLabelText, getByText, getAllByRole } = setup();

    expect(getByText('Apply time range')).toBeInTheDocument();
    expect(getAllByRole('button', { name: 'Open calendar' })).toHaveLength(2);
    expect(getByLabelText('From')).toBeInTheDocument();
    expect(getByLabelText('To')).toBeInTheDocument();
  });

  it('should display calendar when clicking the calendar icon', async () => {
    setup();
    const { TimePicker } = selectors.components;
    const openCalendarButton = screen.getAllByRole('button', { name: 'Open calendar' });

    await user.click(openCalendarButton[0]);
    expect(screen.getByLabelText(TimePicker.calendar.label)).toBeInTheDocument();
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

  describe('when common format are entered', () => {
    it('parses those dates in the current timezone', async () => {
      setup();

      const fromInput = screen.getByLabelText('From');
      const toInput = screen.getByLabelText('To');
      await user.clear(fromInput);
      await user.type(fromInput, '2021-05-10 20:00:00');
      await user.clear(toInput);
      await user.type(toInput, '2021-05-12 19:59:00');

      await user.click(screen.getByRole('button', { name: 'Apply time range' }));

      const appliedOrUndefined = mockOnApply.mock.lastCall?.at(0) as undefined | TimeRange;
      expect(appliedOrUndefined).not.toBe(undefined);
      const applied = appliedOrUndefined!; // previous line throws if undefined
      expect(applied.from.toISOString()).toBe('2021-05-10T20:00:00.000Z');
      expect(applied.to.toISOString()).toBe('2021-05-12T19:59:00.000Z');
    });
  });

  // once localeFormatPreference is permanently on, the only tests that should remain
  // in this block will be ones that ensures the system format is *not* used
  describe('Given custom system date format', () => {
    const originalFullDate = systemDateFormats.fullDate;
    beforeEach(() => {
      systemDateFormats.fullDate = 'DD.MM.YYYY HH:mm:ss';
    });

    afterAll(() => {
      systemDateFormats.fullDate = originalFullDate;
    });

    it('should parse UTC iso strings and render them in the common format and current timezone', () => {
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

    describe('when common format dates are entered', () => {
      it('parses those dates in the current timezone', async () => {
        setup();

        const fromInput = screen.getByLabelText('From');
        const toInput = screen.getByLabelText('To');
        await user.clear(fromInput);
        await user.type(fromInput, '2021-05-10 20:00:00');
        await user.clear(toInput);
        await user.type(toInput, '2021-05-12 19:59:00');

        await user.click(screen.getByRole('button', { name: 'Apply time range' }));

        const appliedOrUndefined = mockOnApply.mock.lastCall?.at(0) as undefined | TimeRange;
        expect(appliedOrUndefined).not.toBe(undefined);
        const applied = appliedOrUndefined!; // previous line throws if undefined
        expect(applied.from.toISOString()).toBe('2021-05-10T20:00:00.000Z');
        expect(applied.to.toISOString()).toBe('2021-05-12T19:59:00.000Z');
      });
    });

    describe('when the localeFormatPreference feature toggle is off', () => {
      beforeEach(() => {
        // when localeFormatPreference is permanently on, the parent describe block ("Given custom systemdate format")
        // needs to be cleared out as most of these tests will be redundant.
        mockSetCommonFormat(false);
      });

      it('should parse UTC ISO strings and render them in the system format', () => {
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

      describe('when common format dates are entered', () => {
        it('should show an error because of parsing failure', async () => {
          setup();

          const fromInput = screen.getByLabelText('From');
          const toInput = screen.getByLabelText('To');
          await user.clear(fromInput);
          await user.type(fromInput, '2021-05-10 20:00:00');
          await user.clear(toInput);
          await user.type(toInput, '2021-05-12 19:59:00');

          await user.click(screen.getByRole('button', { name: 'Apply time range' }));

          const error = screen.getAllByRole('alert');

          expect(error).toHaveLength(2);
          expect(error[0]).toBeVisible();
          expect(error[0]).toHaveTextContent('Please enter a past date or "now"');
        });
      });

      describe('when common format dates are entered', () => {
        it('should show an error because of parsing failure', async () => {
          setup();

          const fromInput = screen.getByLabelText('From');
          const toInput = screen.getByLabelText('To');
          await user.clear(fromInput);
          await user.type(fromInput, '10.05.2021 20:00:00');
          await user.clear(toInput);
          await user.type(toInput, '12.05.2021 19:59:00');

          await user.click(screen.getByRole('button', { name: 'Apply time range' }));

          const appliedOrUndefined = mockOnApply.mock.lastCall?.at(0) as undefined | TimeRange;
          expect(appliedOrUndefined).not.toBe(undefined);
          const applied = appliedOrUndefined!; // previous line throws if undefined
          expect(applied.from.toISOString()).toBe('2021-05-10T20:00:00.000Z');
          expect(applied.to.toISOString()).toBe('2021-05-12T19:59:00.000Z');
        });
      });
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

  it('should not display calendar without clicking the calendar icon', () => {
    const { queryByLabelText } = setup();
    const { TimePicker } = selectors.components;

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
