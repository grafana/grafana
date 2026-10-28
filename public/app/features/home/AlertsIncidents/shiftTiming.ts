import { dateTimeFormat, getTimeZone, type TimeZone } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type OnCallScheduleEvent } from 'app/features/alerting/unified/api/onCallApi';

/** Epoch milliseconds. */
export interface ShiftWindow {
  start: number;
  end: number;
  isCurrent: boolean;
}

/**
 * Zone the homepage uses for shift clocks and for the engine's `date` / `user_tz` window.
 * A regional preference wins. Browser time, an empty preference, and UTC do not: UTC is how
 * dashboards stay aligned, and it was leaving "you're on call until" on the UTC clock.
 */
export function shiftTimeZone(): TimeZone {
  const zone = getTimeZone();
  if (!zone || zone === 'browser' || zone.toLowerCase() === 'utc') {
    return 'browser';
  }
  return zone;
}

const HAS_ZONE = /(?:Z|[+-]\d{2}(?::?\d{2})?)$/i;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Epoch ms for an OnCall start/end. Aware values keep their offset. A zone-less clock is a UTC
 * instant — `Date.parse` would read it as browser-local and the homepage would show the UTC wall time.
 */
export function parseShiftInstant(value: string): number {
  if (HAS_ZONE.test(value) || DATE_ONLY.test(value)) {
    return Date.parse(value);
  }
  const normalized = value.includes(' ') ? value.replace(' ', 'T') : value;
  return Date.parse(`${normalized}Z`);
}

/** The running shift, else the next one to start; undefined when every shift in the window has ended. */
export function nextShift(events: OnCallScheduleEvent[], now: number): ShiftWindow | undefined {
  // The window starts at local midnight, so shifts that ended earlier today come back too.
  const remaining = events
    .map((event) => ({ start: parseShiftInstant(event.start), end: parseShiftInstant(event.end) }))
    .filter((event) => event.end > now)
    .sort((a, b) => a.start - b.start);
  const next = remaining[0];
  return next && { ...next, isCurrent: next.start <= now };
}

const DAY_KEY = 'YYYY-MM-DD';
const CLOCK = 'HH:mm';
const DATE_CLOCK = 'MMM D, HH:mm';

/** The calendar day of `ts` in the shift zone, as the engine's `date` param spells it. */
export const dayKey = (ts: number) => dateTimeFormat(ts, { format: DAY_KEY, timeZone: shiftTimeZone() });

// Today in the viewer's zone → clock only; any other day → date and clock. Weekday names alone are
// ambiguous across a 30-day window.
function clock(ts: number, now: number): string {
  const today = dayKey(ts) === dayKey(now);
  return dateTimeFormat(ts, { format: today ? CLOCK : DATE_CLOCK, timeZone: shiftTimeZone() });
}

export function formatShiftTiming(shift: ShiftWindow, now: number): string {
  if (shift.isCurrent) {
    return t('home.on-call-card.current-shift', "You're on call until {{end}}", { end: clock(shift.end, now) });
  }
  const start = clock(shift.start, now);
  if (dayKey(shift.start) === dayKey(shift.end)) {
    return t('home.on-call-card.next-shift', 'Your next shift {{start}}–{{end}}', {
      start,
      end: dateTimeFormat(shift.end, { format: CLOCK, timeZone: shiftTimeZone() }),
    });
  }
  return t('home.on-call-card.next-shift-multi-day', 'Your next shift {{start}} – {{end}}', {
    start,
    end: clock(shift.end, now),
  });
}
