import { type TileArgs, type TileContentFunc } from 'react-calendar';

import { t } from '@grafana/i18n';

type CalendarValue = Date | [Date, Date] | null | undefined;

/**
 * react-calendar renders every tile as a plain button and marks the selected one with a CSS class,
 * so screen readers announce the selected date exactly like every other date in the month.
 * This adds visually hidden text to the selected tiles, making the selection part of the
 * button's accessible name.
 *
 * react-calendar has no way to set attributes on the tile buttons, so this can only be improved
 * (to a real programmatic state such as aria-pressed) upstream.
 */
export function getSelectedTileContent(value: CalendarValue): TileContentFunc {
  return function SelectedTileContent({ date, view }) {
    if (!isSelected(date, view, value)) {
      return null;
    }

    return <span className="sr-only">{t('grafana-ui.date-time-pickers.tile-selected', 'selected')}</span>;
  };
}

type View = TileArgs['view'];

/**
 * Mirrors how react-calendar picks the tiles it gives its --active/--hasActive classes to: a tile
 * is selected when the value overlaps the period that tile covers.
 */
function isSelected(date: Date, view: View, value: CalendarValue): boolean {
  if (!value) {
    return false;
  }

  const [tileStart, tileEnd] = getTilePeriod(date, view);
  // A single value selects the whole period it falls in, so 5pm on the 8th selects the 8th
  const [valueStart, valueEnd] = Array.isArray(value) ? value : getTilePeriod(value, view);

  return valueStart <= tileEnd && valueEnd >= tileStart;
}

/** The period a single tile covers - one day in the month view, one month in the year view, etc. */
function getTilePeriod(date: Date, view: View): [Date, Date] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  switch (view) {
    case 'month':
      return period(new Date(year, month, day), new Date(year, month, day + 1));
    case 'year':
      return period(new Date(year, month, 1), new Date(year, month + 1, 1));
    case 'decade':
      return period(new Date(year, 0, 1), new Date(year + 1, 0, 1));
    case 'century': {
      // react-calendar's decades run from a year ending in 1 to the next year ending in 0, e.g. 2021-2030
      const decadeStart = year - ((year - 1) % 10);
      return period(new Date(decadeStart, 0, 1), new Date(decadeStart + 10, 0, 1));
    }
  }
}

function period(start: Date, nextStart: Date): [Date, Date] {
  return [start, new Date(nextStart.getTime() - 1)];
}
