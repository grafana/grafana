import { renderHook } from '@testing-library/react';

import { VizPanel } from '@grafana/scenes';

import { DashboardGridItem } from './DashboardGridItem';
import { getDashboardGridItemOptions } from './DashboardGridItemEditor';

function isMaxPerRowShown(gridItem: DashboardGridItem) {
  const { result: categories } = renderHook(() => getDashboardGridItemOptions(gridItem));
  const maxPerRow = categories.current[0].items.find((item) => item.props.id === 'repeat-options-max-per-row')!;
  return renderHook(() => maxPerRow.useShowIf()).result.current;
}

function buildGridItem(repeatDirection?: 'h' | 'v') {
  return new DashboardGridItem({
    body: new VizPanel({ key: 'panel-1', pluginId: 'text' }),
    variableName: 'server',
    repeatDirection,
  });
}

describe('getDashboardGridItemOptions', () => {
  it.each([
    { repeatDirection: undefined, shown: true },
    { repeatDirection: 'h' as const, shown: true },
    { repeatDirection: 'v' as const, shown: false },
  ])('shows max per row for repeat direction $repeatDirection: $shown', ({ repeatDirection, shown }) => {
    expect(isMaxPerRowShown(buildGridItem(repeatDirection))).toBe(shown);
  });
});
