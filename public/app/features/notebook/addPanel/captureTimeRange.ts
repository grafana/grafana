import { type TimeRange } from '@grafana/data';

import { withQueryOptionsTimeRange } from '../scene/layout-notebook/cellTimeRange';
import { type PanelElement } from '../types';

export function withCapturedTimeRange(panel: PanelElement, range: TimeRange, locked: boolean) {
  if (panel.kind !== 'Panel') {
    return panel;
  }

  if (locked) {
    return withQueryOptionsTimeRange(panel, { from: range.from.toISOString(), to: range.to.toISOString() });
  }

  const { timeFrom, timeTo } = panel.spec.data.spec.queryOptions;
  return timeFrom && timeTo ? withQueryOptionsTimeRange(panel, undefined) : panel;
}
