import { SortOrder } from '@grafana/schema';

import { SeriesVisibilityChangeMode } from '../PanelChrome/types';

import { VizLegendItem } from './types';

export const naturalCompare = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare;

export function mapMouseEventToMode(event: React.MouseEvent): SeriesVisibilityChangeMode {
  if (event.ctrlKey || event.metaKey || event.shiftKey) {
    return SeriesVisibilityChangeMode.AppendToSelection;
  }
  return SeriesVisibilityChangeMode.ToggleSelection;
}

/**
 * Sort legend items alphabetically by label using natural comparison.
 * Returns the original array unchanged when sortOrder is None or undefined.
 */
export function sortLegendItems<T>(items: Array<VizLegendItem<T>>, sortOrder?: SortOrder): Array<VizLegendItem<T>> {
  if (!sortOrder || sortOrder === SortOrder.None) {
    return items;
  }

  const sorted = [...items];
  const mult = sortOrder === SortOrder.Descending ? -1 : 1;
  sorted.sort((a, b) => mult * naturalCompare(a.label, b.label));
  return sorted;
}
