import { act, screen, waitFor } from '@testing-library/react';
import { render } from 'test/test-utils';

import { VariableRefresh } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneTimeRange, SceneVariableSet, TestVariable, VariableValueOption, PanelBuilders } from '@grafana/scenes';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from 'app/features/variables/constants';
import { TextMode } from 'app/plugins/panel/text/panelcfg.gen';

import { DashboardScene } from '../DashboardScene';
import { AutoGridItem } from '../layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';

import { TabItem } from './TabItem';
import { TabsLayoutManager } from './TabsLayoutManager';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  setPluginExtensionGetter: jest.fn(),
  getPluginLinkExtensions: jest.fn().mockReturnValue({ extensions: [] }),
}));

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

describe('TabItemRepeater', () => {
  describe('Given scene with variable with 3 values', () => {
    it('Should repeat tab', async () => {
      const { tabToRepeat } = renderScene({ variableQueryTime: 0 });

      await waitFor(() => {
        expect(screen.queryByText('Tab A')).toBeInTheDocument();
        expect(screen.queryByText('Tab B')).toBeInTheDocument();
        expect(screen.queryByText('Tab C')).toBeInTheDocument();
      });

      expect(tabToRepeat.state.key).toBe('tab-1-clone-0');
      expect(tabToRepeat.state.repeatedTabs!.length).toBe(2);
      expect(tabToRepeat.state.repeatedTabs![0].state.key).toBe('tab-1-clone-1');
    });

    it('Should update repeats when variable value changes', async () => {
      const { repeatByVariable, tabToRepeat } = renderScene({ variableQueryTime: 0 });

      await waitFor(() => {
        expect(screen.queryByText('Tab C')).toBeInTheDocument();
      });

      act(() => {
        repeatByVariable.changeValueTo(['C', 'D']);
      });

      await waitFor(() => {
        expect(screen.queryByText('Tab A')).not.toBeInTheDocument();
        expect(screen.queryByText('Tab D')).toBeInTheDocument();
      });

      expect(tabToRepeat.state.repeatedTabs!.length).toBe(1);
    });

    it('Should skip update repeats when variable values the same', async () => {
      const { repeatByVariable, tabToRepeat } = renderScene({ variableQueryTime: 0 });
      let stateUpdates = 0;

      tabToRepeat.subscribeToState((s) => stateUpdates++);

      await waitFor(() => {
        expect(screen.queryByText('Tab C')).toBeInTheDocument();
      });

      act(() => {
        repeatByVariable.changeValueTo(['A1', 'B1', 'C1']);
      });

      expect(stateUpdates).toBe(1);
    });

    it('Should handle removing repeats', async () => {
      const { tabToRepeat } = renderScene({ variableQueryTime: 0 });

      await waitFor(() => {
        expect(screen.queryByText('Tab C')).toBeInTheDocument();
      });

      act(() => {
        tabToRepeat.onChangeRepeat(undefined);
      });

      expect(screen.queryByText('Tab C')).not.toBeInTheDocument();
      expect(tabToRepeat.state.$variables).toBe(undefined);
      expect(tabToRepeat.state.repeatedTabs).toBe(undefined);
      expect(tabToRepeat.state.repeatByVariable).toBe(undefined);
    });
  });
});

interface SceneOptions {
  variableQueryTime: number;
  variableRefresh?: VariableRefresh;
}

function buildTextPanel(key: string, content: string) {
  const panel = PanelBuilders.text().setOption('content', content).setOption('mode', TextMode.Markdown).build();
  panel.setState({ key });
  return panel;
}

function renderScene(
  options: SceneOptions,
  variableOptions?: VariableValueOption[],
  variableStateOverrides?: { isMulti: boolean }
) {
  const tabs = [
    new TabItem({
      key: 'tab-1',
      title: 'Tab $server',
      repeatByVariable: 'server',
      layout: new AutoGridLayoutManager({
        layout: new AutoGridLayout({
          children: [
            new AutoGridItem({
              body: buildTextPanel('text-1', 'Panel inside repeated tab, server = $server'),
            }),
          ],
        }),
      }),
    }),
  ];

  const layout = new TabsLayoutManager({ tabs });
  const repeatByVariable = new TestVariable({
    name: 'server',
    query: 'A.*',
    value: ALL_VARIABLE_VALUE,
    text: ALL_VARIABLE_TEXT,
    isMulti: true,
    includeAll: true,
    delayMs: options.variableQueryTime,
    refresh: options.variableRefresh,
    optionsToReturn: variableOptions ?? [
      { label: 'A', value: 'A1' },
      { label: 'B', value: 'B1' },
      { label: 'C', value: 'C1' },
    ],
    ...variableStateOverrides,
  });

  const scene = new DashboardScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    $variables: new SceneVariableSet({
      variables: [repeatByVariable],
    }),
    body: layout,
  });

  const tabToRepeat = tabs[0];

  render(<scene.Component model={scene} />);

  return { scene, layout, tabs, tabToRepeat, repeatByVariable };
}
