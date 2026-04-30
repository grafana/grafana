import { act, screen, waitFor } from '@testing-library/react';
import { render } from 'test/test-utils';

import { type VariableRefresh } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { locationService, setPluginImportUtils } from '@grafana/runtime';
import {
  CustomVariable,
  LocalValueVariable,
  type MultiValueVariable,
  SceneTimeRange,
  SceneVariableSet,
  TestVariable,
  UrlSyncManager,
  type VariableValueOption,
  PanelBuilders,
} from '@grafana/scenes';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from 'app/features/variables/constants';
import { TextMode } from 'app/plugins/panel/text/panelcfg.gen';

import { DashboardScene } from '../DashboardScene';
import { AutoGridItem } from '../layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from '../layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from '../layout-auto-grid/AutoGridLayoutManager';

import { TabItem } from './TabItem';
import { performTabRepeats } from './TabItemRepeater';
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
  beforeEach(() => {
    locationService.replace({ search: '' });
  });

  describe('Given scene with variable with 3 values', () => {
    it('Should repeat tab', async () => {
      const { tabToRepeat } = renderScene({ variableQueryTime: 0 });

      await waitFor(() => {
        expect(screen.queryByText('Tab A')).toBeInTheDocument();
        expect(screen.queryByText('Tab B')).toBeInTheDocument();
        expect(screen.queryByText('Tab C')).toBeInTheDocument();
      });

      expect(tabToRepeat.state.key).toBe('tab-1');
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

    it('Should render source tab instead of infinite spinner when $__all is selected and variable returns no options', async () => {
      const { tabToRepeat } = renderScene({ variableQueryTime: 0 }, []);

      await waitFor(() => {
        expect(tabToRepeat.state.repeatedTabs).toBeDefined();
        expect(tabToRepeat.state.repeatedTabs).toHaveLength(0);
      });
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

    it('Should preserve section variable with duplicate name when removing repeats', () => {
      const sectionScopedVariable = new CustomVariable({
        name: 'server',
        query: 'row-scope',
        value: 'row-scope',
        text: 'row-scope',
      });
      const tabToRepeat = new TabItem({
        key: 'tab-1',
        title: 'Tab $server',
        repeatByVariable: 'server',
        $variables: new SceneVariableSet({
          variables: [new LocalValueVariable({ name: 'server', value: 'A1', text: 'A' }), sectionScopedVariable],
        }),
        layout: AutoGridLayoutManager.createEmpty(),
      });

      tabToRepeat.onChangeRepeat(undefined);

      expect(tabToRepeat.state.repeatedTabs).toBeUndefined();
      expect(tabToRepeat.state.repeatByVariable).toBeUndefined();
      expect(tabToRepeat.state.$variables?.state.variables).toHaveLength(1);
      expect(tabToRepeat.state.$variables?.state.variables[0]).toBeInstanceOf(CustomVariable);
      expect(tabToRepeat.state.$variables?.state.variables[0].state.name).toBe('server');
      expect(tabToRepeat.state.$variables?.state.variables[0].getValue()).toBe('row-scope');
    });

    it('Should prefer section variable in repeated tab content on name collision', async () => {
      const sectionScopedVariable = new CustomVariable({
        name: 'server',
        query: 'row-scope',
        value: 'row-scope',
        text: 'row-scope',
      });
      const tabVariables = new SceneVariableSet({ variables: [sectionScopedVariable] });

      const { tabToRepeat } = renderScene({ variableQueryTime: 0 }, undefined, undefined, tabVariables);

      await waitFor(() => {
        expect(screen.queryByText('Tab A')).toBeInTheDocument();
        expect(screen.queryByText('Tab B')).toBeInTheDocument();
        expect(screen.queryByText('Tab C')).toBeInTheDocument();
      });

      const repeatedTabs = [tabToRepeat, ...(tabToRepeat.state.repeatedTabs ?? [])];
      expect(repeatedTabs).toHaveLength(3);

      for (const tab of repeatedTabs) {
        const variables = tab.state.$variables?.state.variables;
        expect(variables).toBeDefined();
        expect(variables![0]).toBeInstanceOf(CustomVariable);
        expect(variables![0].state.name).toBe('server');
        expect(variables![0].getValue()).toBe('row-scope');
      }
    });
  });

  describe('URL sync for delayed repeats', () => {
    it('hydrates source and clone section variable values from URL', () => {
      locationService.replace({
        search: 'var-section=blah&var-section-2=abc&var-section-3=de&var-section-4=moo',
      });

      const sectionVariable = new CustomVariable({
        name: 'section',
        query: 'default',
        value: 'default',
        text: 'default',
      });
      const repeatByVariable = new TestVariable({
        name: 'server',
        query: 'A.*',
        value: ['A1', 'B1', 'C1', 'D1'],
        text: ['A', 'B', 'C', 'D'],
        isMulti: true,
        includeAll: true,
        optionsToReturn: [
          { label: 'A', value: 'A1' },
          { label: 'B', value: 'B1' },
          { label: 'C', value: 'C1' },
          { label: 'D', value: 'D1' },
        ],
      });
      const tab = new TabItem({
        key: 'tab-1',
        title: 'Tab',
        repeatByVariable: 'server',
        $variables: new SceneVariableSet({ variables: [sectionVariable] }),
        layout: AutoGridLayoutManager.createEmpty(),
      });
      const scene = new DashboardScene({
        $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
        $variables: new SceneVariableSet({ variables: [repeatByVariable] }),
        body: new TabsLayoutManager({ tabs: [tab] }),
      });
      const urlSyncManager = new UrlSyncManager();

      // Simulate refresh order: URL sync is initialized before repeats are built.
      urlSyncManager.initSync(scene);
      performTabRepeats(repeatByVariable as unknown as MultiValueVariable, tab, false);

      const repeatedTabs = [tab, ...(tab.state.repeatedTabs ?? [])];
      const sectionValues = repeatedTabs.map((repeatedTab) => {
        const sectionVar = repeatedTab.state.$variables?.state.variables.find(
          (variable) => variable instanceof CustomVariable
        ) as CustomVariable;
        return sectionVar.getValue();
      });

      expect(sectionValues).toEqual(['blah', 'abc', 'de', 'moo']);
      expect(locationService.getLocation().search).toContain('var-section=blah');
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
  variableStateOverrides?: { isMulti: boolean },
  tabVariables?: SceneVariableSet
) {
  const tabs = [
    new TabItem({
      key: 'tab-1',
      title: 'Tab $server',
      repeatByVariable: 'server',
      $variables: tabVariables,
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
