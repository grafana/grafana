import { dateTimeFormat } from '@grafana/data';
import { t } from '@grafana/i18n';

/** Epoch milliseconds. */
export interface ShiftWindow {
  start: number;
  end: number;
  isCurrent: boolean;
}

const DAY_KEY = 'YYYY-MM-DD';
const CLOCK = 'HH:mm';
const DATE_CLOCK = 'MMM D, HH:mm';

// Today in the user's zone → clock only; any other day → date and clock. Weekday names alone are
// ambiguous across a 30-day window.
function clock(ts: number, now: number): string {
  const today = dateTimeFormat(ts, { format: DAY_KEY }) === dateTimeFormat(now, { format: DAY_KEY });
  return dateTimeFormat(ts, { format: today ? CLOCK : DATE_CLOCK });
}

export function formatShiftTiming(shift: ShiftWindow, now = Date.now()): string {
  if (shift.isCurrent) {
    return t('home.on-call-card.current-shift', "You're on call until {{end}}", { end: clock(shift.end, now) });
  }
  const start = clock(shift.start, now);
  if (dateTimeFormat(shift.start, { format: DAY_KEY }) === dateTimeFormat(shift.end, { format: DAY_KEY })) {
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
