import { getTimeZoneInfo, setTimeZoneResolver } from '@grafana/data';

import { formatShiftTiming, nextShift, parseShiftInstant, shiftTimeZone } from './shiftTiming';

// Tuesday 10:00 UTC. Etc/GMT-5 is a fixed UTC+5 offset (the POSIX sign is reversed) and never
// observes daylight saving, so these clocks stay the same in every CI run.
const ZONE = 'Etc/GMT-5';
const NOW = Date.parse('2024-01-02T10:00:00Z');

const window = (start: string, end: string, isCurrent: boolean) => ({
  start: Date.parse(start),
  end: Date.parse(end),
  isCurrent,
});

const event = (start: string, end: string) => ({ start, end, all_day: false, users: [] });

/** Clock text for `ts` in the runner's browser zone. Independent of dateTimeFormat and of TZ. */
function browserClock(ts: number, now: number): string {
  const zone = getTimeZoneInfo('browser', now)?.ianaName;
  if (!zone) {
    throw new Error('browser time zone did not resolve');
  }
  const read = (value: number) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(value));
    return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  };
  const end = read(ts);
  const today = read(now);
  const clock = `${end.hour}:${end.minute}`;
  const sameDay = end.year === today.year && end.month === today.month && end.day === today.day;
  return sameDay ? clock : `${end.month} ${end.day}, ${clock}`;
}

describe('shiftTimeZone', () => {
  afterEach(() => setTimeZoneResolver(() => 'browser'));

  it.each(['', 'browser', 'utc', 'UTC'])('follows the browser for %j', (zone) => {
    setTimeZoneResolver(() => zone);
    expect(shiftTimeZone()).toBe('browser');
  });

  it('keeps a fixed-offset zone', () => {
    setTimeZoneResolver(() => ZONE);
    expect(shiftTimeZone()).toBe(ZONE);
  });
});

describe('formatShiftTiming', () => {
  beforeAll(() => setTimeZoneResolver(() => ZONE));
  afterAll(() => setTimeZoneResolver(() => 'browser'));

  it('shows only the clock when a current shift ends today', () => {
    // 17:00Z is 22:00 at UTC+5, still Jan 2.
    expect(formatShiftTiming(window('2024-01-02T08:00:00Z', '2024-01-02T17:00:00Z', true), NOW)).toBe(
      "You're on call until 22:00"
    );
  });

  it('adds the date when a current shift ends on another day', () => {
    expect(formatShiftTiming(window('2024-01-02T08:00:00Z', '2024-01-09T09:00:00Z', true), NOW)).toBe(
      "You're on call until Jan 9, 14:00"
    );
  });

  it('shows date and clock range for an upcoming same-day shift', () => {
    expect(formatShiftTiming(window('2024-01-04T10:00:00Z', '2024-01-04T18:00:00Z', false), NOW)).toBe(
      'Your next shift Jan 4, 15:00–23:00'
    );
  });

  it('shows only clocks for an upcoming shift later today', () => {
    // 12:00Z–14:00Z is 17:00–19:00 at UTC+5, still Jan 2.
    expect(formatShiftTiming(window('2024-01-02T12:00:00Z', '2024-01-02T14:00:00Z', false), NOW)).toBe(
      'Your next shift 17:00–19:00'
    );
  });

  it('dates the far end of a shift that crosses local midnight', () => {
    // 20:00Z is 01:00 on Jan 3 at UTC+5.
    expect(formatShiftTiming(window('2024-01-02T17:00:00Z', '2024-01-02T20:00:00Z', false), NOW)).toBe(
      'Your next shift 22:00 – Jan 3, 01:00'
    );
  });

  it('dates both ends of an upcoming shift that spans days', () => {
    expect(formatShiftTiming(window('2024-01-04T10:00:00Z', '2024-01-05T10:00:00Z', false), NOW)).toBe(
      'Your next shift Jan 4, 15:00 – Jan 5, 15:00'
    );
  });

  it('uses another fixed-offset zone unchanged', () => {
    setTimeZoneResolver(() => 'Etc/GMT+10');
    try {
      // Etc/GMT+10 is UTC-10 year round. 17:00Z is 07:00 the same day.
      expect(formatShiftTiming(window('2024-01-02T08:00:00Z', '2024-01-02T17:00:00Z', true), NOW)).toBe(
        "You're on call until 07:00"
      );
    } finally {
      setTimeZoneResolver(() => ZONE);
    }
  });

  it('uses the browser zone when the preference is UTC', () => {
    setTimeZoneResolver(() => 'utc');
    try {
      const end = Date.parse('2024-01-02T17:00:00Z');
      expect(formatShiftTiming(window('2024-01-02T08:00:00Z', '2024-01-02T17:00:00Z', true), NOW)).toBe(
        `You're on call until ${browserClock(end, NOW)}`
      );
    } finally {
      setTimeZoneResolver(() => ZONE);
    }
  });
});

describe('parseShiftInstant', () => {
  afterEach(() => setTimeZoneResolver(() => 'browser'));

  it('keeps an offset and reads a zone-less clock as UTC', () => {
    expect(parseShiftInstant('2024-01-02T15:00:00Z')).toBe(Date.parse('2024-01-02T15:00:00Z'));
    expect(parseShiftInstant('2024-01-02T15:00:00+00:00')).toBe(Date.parse('2024-01-02T15:00:00Z'));
    expect(parseShiftInstant('2024-01-02T15:00:00')).toBe(Date.parse('2024-01-02T15:00:00Z'));
    expect(parseShiftInstant('2024-01-02 15:00:00')).toBe(Date.parse('2024-01-02T15:00:00Z'));
  });

  it('shows that UTC wall time in the fixed-offset zone', () => {
    setTimeZoneResolver(() => ZONE);
    const shift = nextShift([event('2024-01-02T08:00:00', '2024-01-02T15:00:00')], NOW);
    expect(shift).toEqual({
      start: Date.parse('2024-01-02T08:00:00Z'),
      end: Date.parse('2024-01-02T15:00:00Z'),
      isCurrent: true,
    });
    // 15:00Z is 20:00 at UTC+5.
    expect(formatShiftTiming(shift!, NOW)).toBe("You're on call until 20:00");
  });
});
