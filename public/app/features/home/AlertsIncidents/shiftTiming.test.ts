import { setTimeZoneResolver } from '@grafana/data';

import { formatShiftTiming, nextShift, parseShiftInstant } from './shiftTiming';

// Tuesday 10:00 UTC. Helsinki is UTC+2 in January, so this is 12:00 local.
const NOW = Date.parse('2024-01-02T10:00:00Z');

const window = (start: string, end: string, isCurrent: boolean) => ({
  start: Date.parse(start),
  end: Date.parse(end),
  isCurrent,
});

const event = (start: string, end: string) => ({ start, end, all_day: false, users: [] });

describe('formatShiftTiming', () => {
  beforeAll(() => setTimeZoneResolver(() => 'Europe/Helsinki'));
  afterAll(() => setTimeZoneResolver(() => 'browser'));

  it('shows only the clock when a current shift ends today', () => {
    expect(formatShiftTiming(window('2024-01-02T08:00:00Z', '2024-01-02T17:00:00Z', true), NOW)).toBe(
      "You're on call until 19:00"
    );
  });

  it('adds the date when a current shift ends on another day', () => {
    expect(formatShiftTiming(window('2024-01-02T08:00:00Z', '2024-01-09T09:00:00Z', true), NOW)).toBe(
      "You're on call until Jan 9, 11:00"
    );
  });

  it('shows date and clock range for an upcoming same-day shift', () => {
    expect(formatShiftTiming(window('2024-01-04T10:00:00Z', '2024-01-04T18:00:00Z', false), NOW)).toBe(
      'Your next shift Jan 4, 12:00–20:00'
    );
  });

  it('shows only clocks for an upcoming shift later today', () => {
    // 17:00Z–20:00Z is 19:00–22:00 in Helsinki, still Jan 2.
    expect(formatShiftTiming(window('2024-01-02T17:00:00Z', '2024-01-02T20:00:00Z', false), NOW)).toBe(
      'Your next shift 19:00–22:00'
    );
  });

  it('dates the far end of a shift that crosses local midnight', () => {
    // 23:00Z is 01:00 on Jan 3 in Helsinki.
    expect(formatShiftTiming(window('2024-01-02T17:00:00Z', '2024-01-02T23:00:00Z', false), NOW)).toBe(
      'Your next shift 19:00 – Jan 3, 01:00'
    );
  });

  it('dates both ends of an upcoming shift that spans days', () => {
    expect(formatShiftTiming(window('2024-01-04T10:00:00Z', '2024-01-05T10:00:00Z', false), NOW)).toBe(
      'Your next shift Jan 4, 12:00 – Jan 5, 12:00'
    );
  });

  it("compares days in the user's regional time zone", () => {
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
      setTimeZoneResolver(() => 'Europe/Helsinki');
    }
  });

  it('uses the browser zone when the preference is UTC', () => {
    setTimeZoneResolver(() => 'utc');
    try {
      // Jest's TZ is Pacific/Easter (UTC-5 in January). 17:00Z is 12:00 there, not 17:00.
      expect(formatShiftTiming(window('2024-01-02T08:00:00Z', '2024-01-02T17:00:00Z', true), NOW)).toBe(
        "You're on call until 12:00"
      );
    } finally {
      setTimeZoneResolver(() => 'Europe/Helsinki');
    }
  });
});

describe('parseShiftInstant', () => {
  it('keeps an offset and reads a zone-less clock as UTC', () => {
    expect(parseShiftInstant('2024-01-02T15:00:00Z')).toBe(Date.parse('2024-01-02T15:00:00Z'));
    expect(parseShiftInstant('2024-01-02T15:00:00+00:00')).toBe(Date.parse('2024-01-02T15:00:00Z'));
    expect(parseShiftInstant('2024-01-02T15:00:00')).toBe(Date.parse('2024-01-02T15:00:00Z'));
    expect(parseShiftInstant('2024-01-02 15:00:00')).toBe(Date.parse('2024-01-02T15:00:00Z'));
  });

  it('shows that UTC wall time in the viewer zone', () => {
    setTimeZoneResolver(() => 'Europe/Helsinki');
    try {
      const shift = nextShift([event('2024-01-02T08:00:00', '2024-01-02T15:00:00')], NOW);
      expect(shift).toEqual({
        start: Date.parse('2024-01-02T08:00:00Z'),
        end: Date.parse('2024-01-02T15:00:00Z'),
        isCurrent: true,
      });
      expect(formatShiftTiming(shift!, NOW)).toBe("You're on call until 17:00");
    } finally {
      setTimeZoneResolver(() => 'browser');
    }
  });
});
