import { LegendDisplayMode, type VizLegendOptions } from '@grafana/schema';

import { SeriesVisibilityChangeMode } from '../PanelChrome/types';

export function mapMouseEventToMode(event: React.MouseEvent): SeriesVisibilityChangeMode {
  if (event.ctrlKey || event.metaKey || event.shiftKey) {
    return SeriesVisibilityChangeMode.AppendToSelection;
  }
  return SeriesVisibilityChangeMode.ToggleSelection;
}

/**
 * `displayMode: hidden` is deprecated in favour of `showLegend: false`, but saved dashboards still carry it,
 * usually without `showLegend: false`. VizLegend renders nothing for it, so a legend passed to VizLayout
 * would reserve an empty slot that measures 0px, and the viz is never sized.
 *
 * @internal
 */
export function shouldShowLegend(legend: Pick<VizLegendOptions, 'showLegend' | 'displayMode'>): boolean {
  return legend.showLegend !== false && legend.displayMode !== LegendDisplayMode.Hidden;
}
