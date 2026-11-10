import { LegendDisplayMode } from '@grafana/schema';

import { SeriesVisibilityChangeMode } from '../PanelChrome/types';

import { type VizLegendItem } from './types';
import { mapMouseEventToMode, shouldShowLegend, sortLegendItems } from './utils';

function mouseEvent(overrides: Partial<React.MouseEvent> = {}) {
  return { ctrlKey: false, metaKey: false, shiftKey: false, ...overrides } as React.MouseEvent;
}

describe('mapMouseEventToMode', () => {
  it('returns ToggleSelection for plain click', () => {
    expect(mapMouseEventToMode(mouseEvent())).toBe(SeriesVisibilityChangeMode.ToggleSelection);
  });

  it.each([{ key: 'ctrlKey' as const }, { key: 'metaKey' as const }, { key: 'shiftKey' as const }])(
    'returns AppendToSelection when $key is held',
    ({ key }) => {
      expect(mapMouseEventToMode(mouseEvent({ [key]: true }))).toBe(SeriesVisibilityChangeMode.AppendToSelection);
    }
  );
});

describe('shouldShowLegend', () => {
  it.each([
    { showLegend: true, displayMode: LegendDisplayMode.List, expected: true },
    { showLegend: true, displayMode: LegendDisplayMode.Table, expected: true },
    { showLegend: true, displayMode: undefined, expected: true },
    { showLegend: false, displayMode: LegendDisplayMode.List, expected: false },
    { showLegend: true, displayMode: LegendDisplayMode.Hidden, expected: false },
    { showLegend: false, displayMode: LegendDisplayMode.Hidden, expected: false },
  ])('returns $expected when showLegend is $showLegend and displayMode is $displayMode', ({ expected, ...legend }) => {
    expect(shouldShowLegend(legend)).toBe(expected);
  });

  it('treats a missing showLegend as visible, matching the panel default', () => {
    expect(shouldShowLegend({ displayMode: LegendDisplayMode.List } as Parameters<typeof shouldShowLegend>[0])).toBe(
      true
    );
  });
});

describe('sortLegendItems', () => {
  function item(label: string, mean?: number): VizLegendItem {
    return {
      label,
      color: 'red',
      yAxis: 1,
      getDisplayValues: () => (mean === undefined ? [] : [{ numeric: mean, text: String(mean), title: 'Mean' }]),
    };
  }

  const labels = (items: VizLegendItem[]) => items.map((i) => i.label);

  it('returns items in their original order when sortBy is not set', () => {
    const items = [item('b', 1), item('a', 2)];
    expect(sortLegendItems(items, undefined, false)).toBe(items);
  });

  it('sorts by name using natural ordering', () => {
    const items = [item('series 10'), item('series 2'), item('Series 1')];
    expect(labels(sortLegendItems(items, 'Name', false))).toEqual(['Series 1', 'series 2', 'series 10']);
    expect(labels(sortLegendItems(items, 'Name', true))).toEqual(['series 10', 'series 2', 'Series 1']);
  });

  it('sorts by the numeric value of the matching display value', () => {
    const items = [item('b', 3), item('a', -1), item('c', 10)];
    expect(labels(sortLegendItems(items, 'Mean', false))).toEqual(['a', 'b', 'c']);
    expect(labels(sortLegendItems(items, 'Mean', true))).toEqual(['c', 'b', 'a']);
  });

  it('places an item without the value last when sorting descending', () => {
    const items = [item('missing'), item('low', 1), item('high', 5)];
    expect(labels(sortLegendItems(items, 'Mean', true))).toEqual(['high', 'low', 'missing']);
  });

  it('does not mutate the input array', () => {
    const items = [item('b', 2), item('a', 1)];
    sortLegendItems(items, 'Mean', false);
    expect(labels(items)).toEqual(['b', 'a']);
  });
});
