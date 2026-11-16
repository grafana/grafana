import { dateTimeFormat } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type OnCallScheduleEvent } from 'app/features/alerting/unified/api/onCallApi';

/** Epoch milliseconds. */
export interface ShiftWindow {
  start: number;
  end: number;
  isCurrent: boolean;
}

/** The running shift, else the next one to start; undefined when every shift in the window has ended. */
export function nextShift(events: OnCallScheduleEvent[], now: number): ShiftWindow | undefined {
  // The window starts at local midnight, so shifts that ended earlier today come back too.
  const remaining = events
    .map((event) => ({ start: Date.parse(event.start), end: Date.parse(event.end) }))
    .filter((event) => event.end > now)
    .sort((a, b) => a.start - b.start);
  const next = remaining[0];
  return next && { ...next, isCurrent: next.start <= now };
}

const DAY_KEY = 'YYYY-MM-DD';
const CLOCK = 'HH:mm';
const DATE_CLOCK = 'MMM D, HH:mm';

/** The calendar day of `ts` in the user's time zone, as the engine's `date` param spells it. */
export const dayKey = (ts: number) => dateTimeFormat(ts, { format: DAY_KEY });

// Today in the user's zone → clock only; any other day → date and clock. Weekday names alone are
// ambiguous across a 30-day window.
function clock(ts: number, now: number): string {
  const today = dayKey(ts) === dayKey(now);
  return dateTimeFormat(ts, { format: today ? CLOCK : DATE_CLOCK });
}

export function formatShiftTiming(shift: ShiftWindow, now: number): string {
  if (shift.isCurrent) {
    return t('home.on-call-card.current-shift', "You're on call until {{end}}", { end: clock(shift.end, now) });
  }
  const start = clock(shift.start, now);
  if (dayKey(shift.start) === dayKey(shift.end)) {
    return t('home.on-call-card.next-shift', 'Your next shift {{start}}–{{end}}', {
      start,
      end: dateTimeFormat(shift.end, { format: CLOCK }),
    });
  }
  return t('home.on-call-card.next-shift-multi-day', 'Your next shift {{start}} – {{end}}', {
    start,
    end: clock(shift.end, now),
  });
}
