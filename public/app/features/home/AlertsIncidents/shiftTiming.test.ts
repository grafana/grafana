import { setTimeZoneResolver } from '@grafana/data';

import { formatShiftTiming } from './shiftTiming';

// Tuesday 10:00 UTC.
const NOW = Date.parse('2024-01-02T10:00:00Z');

const window = (start: string, end: string, isCurrent: boolean) => ({
  start: Date.parse(start),
  end: Date.parse(end),
  isCurrent,
});

describe('formatShiftTiming', () => {
  beforeAll(() => setTimeZoneResolver(() => 'utc'));
  afterAll(() => setTimeZoneResolver(() => 'browser'));

  it('shows only the clock when a current shift ends today', () => {
    expect(formatShiftTiming(window('2024-01-02T08:00:00Z', '2024-01-02T17:00:00Z', true), NOW)).toBe(
      "You're on call until 17:00"
    );
  });

  it('adds the date when a current shift ends on another day', () => {
    expect(formatShiftTiming(window('2024-01-02T08:00:00Z', '2024-01-09T09:00:00Z', true), NOW)).toBe(
      "You're on call until Jan 9, 09:00"
    );
  });

  it('shows date and clock range for an upcoming same-day shift', () => {
    expect(formatShiftTiming(window('2024-01-04T10:00:00Z', '2024-01-04T18:00:00Z', false), NOW)).toBe(
      'Your next shift Jan 4, 10:00–18:00'
    );
  });

  it('shows only clocks for an upcoming shift later today', () => {
    expect(formatShiftTiming(window('2024-01-02T17:00:00Z', '2024-01-02T23:00:00Z', false), NOW)).toBe(
      'Your next shift 17:00–23:00'
    );
  });

  it('dates both ends of an upcoming shift that spans days', () => {
    expect(formatShiftTiming(window('2024-01-04T10:00:00Z', '2024-01-05T10:00:00Z', false), NOW)).toBe(
      'Your next shift Jan 4, 10:00 – Jan 5, 10:00'
    );
  });

  it("compares days in the user's time zone", () => {
    setTimeZoneResolver(() => 'Europe/Berlin');
    try {
      // 23:30Z is already 00:30 on Jan 3 in Berlin.
      expect(
        formatShiftTiming(
          window('2024-01-02T22:00:00Z', '2024-01-02T23:30:00Z', true),
          Date.parse('2024-01-02T22:30:00Z')
        )
      ).toBe("You're on call until Jan 3, 00:30");
    } finally {
      setTimeZoneResolver(() => 'utc');
    }
  });
});
