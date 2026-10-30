import { act, render, screen, userEvent } from 'test/test-utils';

import { CustomVariable, SceneTimeRange, SceneVariableSet } from '@grafana/scenes';
import { mockComboboxRect } from '@grafana/test-utils';

import { activateFullSceneTree } from '../../utils/test-utils';
import { DashboardScene } from '../DashboardScene';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';

import { TabItem, type TabItemState } from './TabItem';
import { TabRepeatSelect } from './TabItemEditor';
import { TabsLayoutManager } from './TabsLayoutManager';

function buildTab(tabState: Partial<TabItemState> = {}) {
  const tab = new TabItem({ title: 'Tab 1', layout: DefaultGridLayoutManager.createEmpty(), ...tabState });
  const dashboard = new DashboardScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    $variables: new SceneVariableSet({
      variables: [new CustomVariable({ name: 'server', query: 'A,B', value: 'A', text: 'A' })],
    }),
    isEditing: true,
    body: new TabsLayoutManager({ tabs: [tab] }),
  });
  activateFullSceneTree(dashboard);

  return { tab, sidebar: dashboard.state.sidebar };
}

describe('TabItemEditor', () => {
  describe('TabRepeatSelect', () => {
    beforeAll(() => {
      mockComboboxRect();
    });

    it('records selecting a repeat variable as an undoable action and restores it on undo/redo', async () => {
      const { tab, sidebar } = buildTab();
      render(<TabRepeatSelect tab={tab} />);

      await userEvent.click(screen.getByRole('combobox'));
      await userEvent.click(await screen.findByRole('option', { name: 'server' }));

      expect(tab.state.repeatByVariable).toBe('server');
      expect(sidebar.state.undoStack).toHaveLength(1);
      expect(sidebar.state.undoStack[0].description).toBe('Tab repeat by');

      act(() => sidebar.undoAction());

      expect(tab.state.repeatByVariable).toBeUndefined();
      expect(sidebar.state.undoStack).toHaveLength(0);
      expect(sidebar.state.redoStack).toHaveLength(1);

      act(() => sidebar.redoAction());

      expect(tab.state.repeatByVariable).toBe('server');
    });

    it('records disabling repeating as an undoable action and restores the variable on undo', async () => {
      const { tab, sidebar } = buildTab({ repeatByVariable: 'server' });
      render(<TabRepeatSelect tab={tab} />);

      await userEvent.click(screen.getByRole('combobox'));
      await userEvent.click(await screen.findByRole('option', { name: 'Disable repeating' }));

      expect(tab.state.repeatByVariable).toBeUndefined();
      expect(sidebar.state.undoStack).toHaveLength(1);
      expect(sidebar.state.undoStack[0].description).toBe('Tab repeat by');

      act(() => sidebar.undoAction());

      expect(tab.state.repeatByVariable).toBe('server');
    });

    it('does not record an action when the already selected variable is picked again', async () => {
      const { tab, sidebar } = buildTab({ repeatByVariable: 'server' });
      render(<TabRepeatSelect tab={tab} />);

      await userEvent.click(screen.getByRole('combobox'));
      await userEvent.click(await screen.findByRole('option', { name: 'server' }));

      expect(tab.state.repeatByVariable).toBe('server');
      expect(sidebar.state.undoStack).toHaveLength(0);
    });
  });
});
