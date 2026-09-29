import { type TimeRange } from '@grafana/data';

type RangeBounds = { from: { valueOf(): number } | number; to: { valueOf(): number } | number };

const zoomedRanges = new WeakMap<object, string>();
const zoomedExploreRanges = new Map<string, string>();

function rangeKey(range: RangeBounds): string {
  return `${range.from.valueOf()}:${range.to.valueOf()}`;
}

export function markPanelZoom(panel: object, range: RangeBounds): void {
  zoomedRanges.set(panel, rangeKey(range));
}

export function clearPanelZoom(panel: object): void {
  zoomedRanges.delete(panel);
}

export function wasPanelZoomed(panel: object, range: TimeRange): boolean {
  return zoomedRanges.get(panel) === rangeKey(range);
}

export function markExploreZoom(exploreId: string, range: RangeBounds): void {
  zoomedExploreRanges.set(exploreId, rangeKey(range));
}

export function clearExploreZoom(exploreId: string): void {
  zoomedExploreRanges.delete(exploreId);
}

export function wasExploreZoomed(exploreId: string, range: TimeRange): boolean {
  return zoomedExploreRanges.get(exploreId) === rangeKey(range);
}
