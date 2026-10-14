import { rangeUtil, type RawTimeRange } from '@grafana/data';

import { withQueryOptionsTimeRange } from '../scene/layout-notebook/cellTimeRange';
import { type PanelElement } from '../types';

/**
 * The window a visualization was captured in: the source's effective range at the moment the add
 * started, as raw from/to — the same shape a locked notebook cell stores (see cellTimeRange).
 *
 * Raw rather than resolved on purpose. An absolute range is already two wall-clock instants, so
 * nothing is lost; a relative one the user chose to lock should keep re-evaluating in the notebook,
 * the same as one locked from the cell's own control.
 */
export interface CapturedTimeRange {
  from: string;
  to: string;
  /** The source's time zone, used only to describe the range to the user. */
  timeZone?: string;
}

/**
 * `raw` is what the source had, not what it resolved to: a dashboard's SceneTimeRange keeps its
 * from/to as the strings the picker wrote, and Explore's TimeRange.raw is the same thing for a pane.
 */
export function captureTimeRange(raw: RawTimeRange, timeZone?: string): CapturedTimeRange {
  // formatRawTimeRange's from/to are always strings; RawTimeRange's type just does not say so.
  const { from, to } = rangeUtil.formatRawTimeRange(raw);
  return { from: String(from), to: String(to), timeZone };
}

/**
 * Whether the lock starts on for this capture.
 *
 * Zooming into an interval is usually the reason a visualization gets captured at all, and zooming
 * is what turns a range absolute — so an absolute window is taken as one worth keeping, and the
 * notebook's own range would otherwise replace it the moment the panel lands. A relative range has
 * no particular window to preserve, so it follows the notebook instead.
 *
 * Either end being absolute is enough: a half-pinned window (an instant through `now`) is still not
 * one the notebook's range can stand in for.
 */
export function shouldLockCapturedTimeRange(range: CapturedTimeRange): boolean {
  return !rangeUtil.isRelativeTime(range.from) || !rangeUtil.isRelativeTime(range.to);
}

/** How the range reads in the picker, matching what the cell's own lock pill will say. */
export function describeCapturedTimeRange(range: CapturedTimeRange): string {
  // Through convertRawToRange first: describeTimeRange formats absolute ends only once they are
  // DateTimes, and would otherwise print the stored ISO strings verbatim.
  const { raw } = rangeUtil.convertRawToRange({ from: range.from, to: range.to }, range.timeZone);

  return rangeUtil.describeTimeRange(raw, range.timeZone);
}

/**
 * Locks a captured panel to its window, by writing the pair of query options the notebook reads back
 * as a cell time range (see deserializeNotebookLayout).
 *
 * The panel's time shift is cleared along with it. The captured window is the one the panel was
 * showing, so the shift is already in it — and a shift left behind would make buildVizPanelState put
 * a PanelTimeRange under the cell's range on load and move the window a second time. A comparison
 * is kept: it adds a query beside the window rather than moving it.
 *
 * A library panel element has no query options to write to. buildPanelElementFromDashboard inlines
 * every loaded library panel, so what reaches here as one is a panel whose model had not loaded yet
 * — it is stored as a reference to a panel that is still free to change, and there is no captured
 * window to pin on it. The capture itself is worth more than refusing it, so the lock is dropped.
 */
export function withCapturedTimeRange(panel: PanelElement, range: CapturedTimeRange): PanelElement {
  if (panel.kind !== 'Panel') {
    return panel;
  }

  const locked = withQueryOptionsTimeRange(panel, { from: range.from, to: range.to });

  return {
    ...locked,
    spec: {
      ...locked.spec,
      data: {
        ...locked.spec.data,
        spec: {
          ...locked.spec.data.spec,
          queryOptions: { ...locked.spec.data.spec.queryOptions, timeShift: undefined },
        },
      },
    },
  };
}
