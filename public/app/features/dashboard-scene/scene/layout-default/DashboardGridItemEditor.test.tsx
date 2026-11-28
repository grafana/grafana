import { renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, screen } from 'test/test-utils';

import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';

import { DashboardInteractions } from '../../utils/interactions';
import { DashboardScene } from '../DashboardScene';

import { DashboardGridItem } from './DashboardGridItem';
import { getDashboardGridItemOptions } from './DashboardGridItemEditor';
import { DefaultGridLayoutManager } from './DefaultGridLayoutManager';

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

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

function RepeatDirection({ gridItem }: { gridItem: DashboardGridItem }) {
  const [repeatCategory] = getDashboardGridItemOptions(gridItem);
  const directionItem = repeatCategory.items.find((item) => item.props.id === 'repeat-options-repeat-direction')!;
  return <>{directionItem.props.render(directionItem)}</>;
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

describe('getDashboardGridItemOptions tracking', () => {
  let panelSettingChanged: jest.SpyInstance;

  beforeEach(() => {
    panelSettingChanged = jest.spyOn(DashboardInteractions, 'panelSettingChanged').mockImplementation();
  });

  afterEach(() => {
    panelSettingChanged.mockRestore();
  });

  it('reports a repeat direction change with the panel it repeats', async () => {
    const panel = new VizPanel({ key: 'panel-4', title: 'CPU', pluginId: 'stat' });
    const gridItem = new DashboardGridItem({ body: panel, variableName: 'server', repeatDirection: 'h' });
    const layout = DefaultGridLayoutManager.fromGridItems([gridItem]);
    new DashboardScene({ isEditing: true, body: layout });

    render(<RepeatDirection gridItem={gridItem} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Vertical' }));

    expect(panelSettingChanged).toHaveBeenCalledTimes(1);
    expect(panelSettingChanged).toHaveBeenCalledWith({
      item: 'change_panel_repeat_direction',
      source: 'edit_pane',
      panel_type: 'stat',
      panel_id: 4,
    });
  });
});
