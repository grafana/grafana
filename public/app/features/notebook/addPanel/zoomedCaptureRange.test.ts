import { rangeUtil } from '@grafana/data';

import {
  clearExploreZoom,
  clearPanelZoom,
  markExploreZoom,
  markPanelZoom,
  wasExploreZoomed,
  wasPanelZoomed,
} from './zoomedCaptureRange';

const zoomed = rangeUtil.convertRawToRange({ from: '2026-09-25T10:15:00.000Z', to: '2026-09-25T10:25:00.000Z' }, 'utc');
const changed = rangeUtil.convertRawToRange(
  { from: '2026-09-25T10:00:00.000Z', to: '2026-09-25T11:00:00.000Z' },
  'utc'
);

it('only locks the range produced by a zoom on that panel', () => {
  const panel = {};
  const otherPanel = {};
  markPanelZoom(panel, zoomed);

  expect(wasPanelZoomed(panel, zoomed)).toBe(true);
  expect(wasPanelZoomed(panel, changed)).toBe(false);
  expect(wasPanelZoomed(otherPanel, zoomed)).toBe(false);

  clearPanelZoom(panel);
  expect(wasPanelZoomed(panel, zoomed)).toBe(false);
});

it('clears an Explore zoom after a different time interaction', () => {
  markExploreZoom('left', zoomed);
  expect(wasExploreZoomed('left', zoomed)).toBe(true);
  expect(wasExploreZoomed('right', zoomed)).toBe(false);

  clearExploreZoom('left');
  expect(wasExploreZoomed('left', zoomed)).toBe(false);
});
