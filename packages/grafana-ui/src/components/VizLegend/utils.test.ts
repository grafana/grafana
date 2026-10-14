import { LegendDisplayMode } from '@grafana/schema';

import { SeriesVisibilityChangeMode } from '../PanelChrome/types';

import { mapMouseEventToMode, shouldShowLegend } from './utils';

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
