import { LegendDisplayMode, type VizLegendOptions } from '@grafana/schema';

import { SeriesVisibilityChangeMode } from '../PanelChrome/types';

import { type VizLegendItem } from './types';

/** @internal */
export const LEGEND_SORT_BY_NAME = 'Name';

const naturalCompare = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare;

/**
 * Sorts legend items by name or by the numeric value of the display value whose title matches `sortKey`.
 * Returns a new array and leaves the input untouched.
 *
 * @internal
 */
export function sortLegendItems<T>(
  items: Array<VizLegendItem<T>>,
  sortKey: string | undefined,
  sortDesc: boolean | undefined
): Array<VizLegendItem<T>> {
  if (sortKey == null) {
    return items;
  }

  let itemVals = new Map<VizLegendItem<T>, number>();

  items.forEach((item) => {
    if (sortKey !== LEGEND_SORT_BY_NAME && item.getDisplayValues) {
      const stat = item.getDisplayValues().find((stat) => stat.title === sortKey);
      const val = stat == null || Number.isNaN(stat.numeric) ? -Infinity : stat.numeric;
      itemVals.set(item, val);
    }
  });

  let sortMult = sortDesc ? -1 : 1;

  if (sortKey === LEGEND_SORT_BY_NAME) {
    return [...items].sort((a, b) => {
      return sortMult * naturalCompare(a.label, b.label);
    });
  }

  return [...items].sort((a, b) => {
    const aVal = itemVals.get(a) ?? 0;
    const bVal = itemVals.get(b) ?? 0;

    return sortMult * (aVal - bVal);
  });
}

export function mapMouseEventToMode(event: React.MouseEvent): SeriesVisibilityChangeMode {
  if (event.ctrlKey || event.metaKey || event.shiftKey) {
    return SeriesVisibilityChangeMode.AppendToSelection;
  }
  return SeriesVisibilityChangeMode.ToggleSelection;
}

/**
 * `displayMode: hidden` is deprecated in favour of `showLegend: false`. The v37 migration normalizes stored
 * v1 dashboards, but the value can still arrive via v2 dashboards, dashboards written at schemaVersion >= 37,
 * or options built in code. VizLegend renders nothing for it, so a legend passed to VizLayout would reserve
 * an empty slot that measures 0px, and the viz is never sized.
 *
 * @internal
 */
export function shouldShowLegend(legend: Pick<VizLegendOptions, 'showLegend' | 'displayMode'>): boolean {
  return legend.showLegend !== false && legend.displayMode !== LegendDisplayMode.Hidden;
}
