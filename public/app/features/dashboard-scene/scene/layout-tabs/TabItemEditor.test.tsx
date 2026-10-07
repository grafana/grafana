import { act, render, screen, userEvent } from 'test/test-utils';

import { useAssistant } from '@grafana/assistant';
import { type PanelPluginMeta } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { FlagKeys, setPanelPluginMetas } from '@grafana/runtime/internal';
import { CustomVariable, SceneTimeRange, SceneVariableSet } from '@grafana/scenes';
import { mockComboboxRect } from '@grafana/test-utils';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { activateFullSceneTree } from '../../utils/test-utils';
import { DashboardScene } from '../DashboardScene';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';

import { TabItem, type TabItemState } from './TabItem';
import { RestyleTabButton, TabRepeatSelect } from './TabItemEditor';
import { TabsLayoutManager } from './TabsLayoutManager';

function buildTab(tabState: Partial<TabItemState> = {}, canEdit = true) {
  const tab = new TabItem({ title: 'Tab 1', layout: DefaultGridLayoutManager.createEmpty(), ...tabState });
  const dashboard = new DashboardScene({
    meta: { canEdit },
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
  describe('RestyleTabButton', () => {
    const openAssistant = jest.fn();
    const customPanelMeta = { id: 'custom-panel', name: 'Custom panel' } as PanelPluginMeta;
    const restyleButton = selectors.components.PanelEditor.ElementEditPane.TabsLayout.restyleWithAssistant;

    function mockAssistant(isAvailable: boolean) {
      jest.mocked(useAssistant).mockReturnValue({
        isLoading: false,
        isAvailable,
        openAssistant: isAvailable ? openAssistant : undefined,
        closeAssistant: jest.fn(),
        toggleAssistant: jest.fn(),
      });
    }

    beforeAll(() => {
      setTestFlags({ [FlagKeys.GrafanaCustomPanel]: true });
    });

    afterAll(() => {
      setTestFlags({});
    });

    afterEach(() => {
      mockAssistant(false);
      openAssistant.mockReset();
    });

    it('asks the Assistant to restyle the tab by its title', async () => {
      mockAssistant(true);
      setPanelPluginMetas({ 'custom-panel': customPanelMeta });
      const { tab } = buildTab({ title: 'Latency' });
      render(<RestyleTabButton tab={tab} />);

      await userEvent.click(await screen.findByTestId(restyleButton));

      expect(openAssistant).toHaveBeenCalledWith(
        expect.objectContaining({
          origin: 'grafana/dashboards/custom-panel-landing',
          prompt: 'Restyle the Latency tab of this dashboard.',
        })
      );
    });

    it.each([
      ['the Assistant is not available', false, true, true],
      ['the Custom panel is not registered', true, false, true],
      ['the user cannot edit the dashboard', true, true, false],
    ])('is hidden when %s', async (_, assistant, customPanel, canEdit) => {
      mockAssistant(assistant);
      setPanelPluginMetas(customPanel ? { 'custom-panel': customPanelMeta } : {});
      const { tab } = buildTab({ title: 'Latency' }, canEdit);
      render(<RestyleTabButton tab={tab} />);

      // The plugin meta lookup is async; give it time to settle before checking.
      await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
      expect(screen.queryByTestId(restyleButton)).not.toBeInTheDocument();
    });
  });

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
