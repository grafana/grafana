import { VariableRefresh } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import {
  SceneGridRow,
  SceneTimeRange,
  SceneVariableSet,
  TestVariable,
  VariableValueOption,
  PanelBuilders,
} from '@grafana/scenes';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from 'app/features/variables/constants';
import { TextMode } from 'app/plugins/panel/text/panelcfg.gen';

import { getCloneKey, isInCloneChain, joinCloneKeys } from '../../utils/clone';
import { activateFullSceneTree } from '../../utils/test-utils';
import { DashboardScene } from '../DashboardScene';
import { DashboardGridItem } from '../layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../layout-default/DefaultGridLayoutManager';

import { TabItem } from './TabItem';
import { TabItemRepeaterBehavior } from './TabItemRepeaterBehavior';
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

describe('TabItemRepeaterBehavior', () => {
  describe('Given scene with variable with 5 values', () => {
    let scene: DashboardScene, layout: TabsLayoutManager, repeatBehavior: TabItemRepeaterBehavior;
    let layoutStateUpdates: unknown[];

    beforeEach(async () => {
      ({ scene, layout, repeatBehavior } = buildScene({ variableQueryTime: 0 }));

      layoutStateUpdates = [];
      layout.subscribeToState((state) => layoutStateUpdates.push(state));

      activateFullSceneTree(scene);
      await new Promise((r) => setTimeout(r, 1));
    });

    it('Should repeat tab', () => {
      // Verify that first tab still has repeat behavior
      const tab1 = layout.state.tabs[0];
      expect(tab1.state.key).toBe(getCloneKey('tab-1', 0));
      expect(tab1.state.$behaviors?.[0]).toBeInstanceOf(TabItemRepeaterBehavior);
      expect(tab1.state.$variables!.state.variables[0].getValue()).toBe('A1');

      const tab1Children = getTabChildren(tab1);
      expect(tab1Children[0].state.key!).toBe(joinCloneKeys(tab1.state.key!, 'grid-item-0'));
      expect(tab1Children[0].state.body?.state.key).toBe(joinCloneKeys(tab1Children[0].state.key!, 'panel-0'));

      const tab2 = layout.state.tabs[1];
      expect(tab2.state.key).toBe(getCloneKey('tab-1', 1));
      expect(tab2.state.$behaviors).toEqual([]);
      expect(tab2.state.$variables!.state.variables[0].getValueText?.()).toBe('B');

      const tab2Children = getTabChildren(tab2);
      expect(tab2Children[0].state.key!).toBe(joinCloneKeys(tab2.state.key!, 'grid-item-0'));
      expect(tab2Children[0].state.body?.state.key).toBe(joinCloneKeys(tab2Children[0].state.key!, 'panel-0'));
    });

    it('Repeated tabs should be read only', () => {
      const tab1 = layout.state.tabs[0];
      expect(isInCloneChain(tab1.state.key!)).toBe(false);

      const tab2 = layout.state.tabs[1];
      expect(isInCloneChain(tab2.state.key!)).toBe(true);
    });

    it('Should push tab at the bottom down', () => {
      // Should push tab at the bottom down
      const tabAtTheBottom = layout.state.tabs[5];
      expect(tabAtTheBottom.state.title).toBe('Tab at the bottom');
    });

    it('Should handle second repeat cycle and update remove old repeats', async () => {
      // trigger another repeat cycle by changing the variable
      const variable = scene.state.$variables!.state.variables[0] as TestVariable;
      variable.changeValueTo(['B1', 'C1']);

      await new Promise((r) => setTimeout(r, 1));

      // should now only have 2 repeated tabs (and the panel above + the tab at the bottom)
      expect(layout.state.tabs.length).toBe(3);
    });

    it('Should ignore repeat process if variable values are the same', async () => {
      // trigger another repeat cycle by changing the variable
      repeatBehavior.performRepeat();

      await new Promise((r) => setTimeout(r, 1));

      expect(layoutStateUpdates.length).toBe(1);
    });
  });

  describe('Given scene with variable with 15 values', () => {
    let scene: DashboardScene, layout: TabsLayoutManager;
    let layoutStateUpdates: unknown[];

    beforeEach(async () => {
      ({ scene, layout } = buildScene({ variableQueryTime: 0 }, [
        { label: 'A', value: 'A1' },
        { label: 'B', value: 'B1' },
        { label: 'C', value: 'C1' },
        { label: 'D', value: 'D1' },
        { label: 'E', value: 'E1' },
        { label: 'F', value: 'F1' },
        { label: 'G', value: 'G1' },
        { label: 'H', value: 'H1' },
        { label: 'I', value: 'I1' },
        { label: 'J', value: 'J1' },
        { label: 'K', value: 'K1' },
        { label: 'L', value: 'L1' },
        { label: 'M', value: 'M1' },
        { label: 'N', value: 'N1' },
        { label: 'O', value: 'O1' },
      ]));

      layoutStateUpdates = [];
      layout.subscribeToState((state) => layoutStateUpdates.push(state));

      activateFullSceneTree(scene);
      await new Promise((r) => setTimeout(r, 1));
    });

    it('Should handle second repeat cycle and update remove old repeats', async () => {
      // should have 15 repeated tabs (and the panel above)
      expect(layout.state.tabs.length).toBe(16);

      // trigger another repeat cycle by changing the variable
      const variable = scene.state.$variables!.state.variables[0] as TestVariable;
      variable.changeValueTo(['B1', 'C1']);

      await new Promise((r) => setTimeout(r, 1));

      // should now only have 2 repeated tabs (and the panel above)
      expect(layout.state.tabs.length).toBe(3);
    });
  });

  describe('Given a scene with empty variable', () => {
    it('Should preserve repeat tab', async () => {
      const { scene, layout } = buildScene({ variableQueryTime: 0 }, []);
      activateFullSceneTree(scene);
      await new Promise((r) => setTimeout(r, 1));

      // Should have 2 tabs, one without repeat and one with the dummy tab
      expect(layout.state.tabs.length).toBe(2);
      expect(layout.state.tabs[0].state.$behaviors?.[0]).toBeInstanceOf(TabItemRepeaterBehavior);
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

function buildScene(
  options: SceneOptions,
  variableOptions?: VariableValueOption[],
  variableStateOverrides?: { isMulti: boolean }
) {
  const repeatBehavior = new TabItemRepeaterBehavior({ variableName: 'server' });

  const tabs = [
    new TabItem({
      key: 'tab-1',
      $behaviors: [repeatBehavior],
      layout: DefaultGridLayoutManager.fromGridItems([
        new DashboardGridItem({
          key: 'grid-item-1',
          x: 0,
          y: 11,
          width: 24,
          height: 5,
          body: buildTextPanel('text-1', 'Panel inside repeated tab, server = $server'),
        }),
      ]),
    }),
    new TabItem({
      key: 'tab-2',
      title: 'Tab at the bottom',
      layout: DefaultGridLayoutManager.fromGridItems([
        new DashboardGridItem({
          key: 'grid-item-2',
          x: 0,
          y: 17,
          body: buildTextPanel('text-2', 'Panel inside tab, server = $server'),
        }),
        new DashboardGridItem({
          key: 'grid-item-3',
          x: 0,
          y: 25,
          body: buildTextPanel('text-3', 'Panel inside tab, server = $server'),
        }),
      ]),
    }),
  ];

  const layout = new TabsLayoutManager({ tabs });

  const scene = new DashboardScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    $variables: new SceneVariableSet({
      variables: [
        new TestVariable({
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
            { label: 'D', value: 'D1' },
            { label: 'E', value: 'E1' },
          ],
          ...variableStateOverrides,
        }),
      ],
    }),
    body: layout,
  });

  const tabToRepeat = repeatBehavior.parent as SceneGridRow;

  return { scene, layout, tabs, repeatBehavior, tabToRepeat };
}

function getTabLayout(tab: TabItem): DefaultGridLayoutManager {
  const layout = tab.getLayout();

  if (!(layout instanceof DefaultGridLayoutManager)) {
    throw new Error('Invalid layout');
  }

  return layout;
}

function getTabChildren(tab: TabItem): DashboardGridItem[] {
  const layout = getTabLayout(tab);

  const filteredChildren = layout.state.grid.state.children.filter((child) => child instanceof DashboardGridItem);

  if (filteredChildren.length !== layout.state.grid.state.children.length) {
    throw new Error('Invalid layout');
  }

  return filteredChildren;
}
