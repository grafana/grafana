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

function RepeatDirection({ gridItem }: { gridItem: DashboardGridItem }) {
  const [repeatCategory] = getDashboardGridItemOptions(gridItem);
  const directionItem = repeatCategory.items.find((item) => item.props.id === 'repeat-options-repeat-direction')!;
  return <>{directionItem.props.render(directionItem)}</>;
}

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
