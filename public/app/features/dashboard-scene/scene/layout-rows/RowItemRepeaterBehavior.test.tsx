import { VariableRefresh } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
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

import { RowItem } from './RowItem';
import { RowItemRepeaterBehavior } from './RowItemRepeaterBehavior';
import { RowsLayoutManager } from './RowsLayoutManager';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  setPluginExtensionGetter: jest.fn(),
  getPluginLinkExtensions: jest.fn().mockReturnValue({ extensions: [] }),
}));

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

describe('RowItemRepeaterBehavior', () => {
  describe('Given scene with variable with 5 values', () => {
    let scene: DashboardScene, layout: RowsLayoutManager, repeatBehavior: RowItemRepeaterBehavior;
    let layoutStateUpdates: unknown[];

    beforeEach(async () => {
      ({ scene, layout, repeatBehavior } = buildScene({ variableQueryTime: 0 }));

      layoutStateUpdates = [];
      layout.subscribeToState((state) => layoutStateUpdates.push(state));

      activateFullSceneTree(scene);
      await new Promise((r) => setTimeout(r, 1));
    });

    it('Should repeat row', () => {
      // Verify that first row still has repeat behavior
      const row1 = layout.state.rows[0];
      expect(row1.state.key).toBe(getCloneKey('row-1', 0));
      expect(row1.state.$behaviors?.[0]).toBeInstanceOf(RowItemRepeaterBehavior);
      expect(row1.state.$variables!.state.variables[0].getValue()).toBe('A1');

      const row1Children = getRowChildren(row1);
      expect(row1Children[0].state.key!).toBe(joinCloneKeys(row1.state.key!, 'grid-item-0'));
      expect(row1Children[0].state.body?.state.key).toBe(joinCloneKeys(row1Children[0].state.key!, 'panel-0'));

      const row2 = layout.state.rows[1];
      expect(row2.state.key).toBe(getCloneKey('row-1', 1));
      expect(row2.state.$behaviors).toEqual([]);
      expect(row2.state.$variables!.state.variables[0].getValueText?.()).toBe('B');

      const row2Children = getRowChildren(row2);
      expect(row2Children[0].state.key!).toBe(joinCloneKeys(row2.state.key!, 'grid-item-0'));
      expect(row2Children[0].state.body?.state.key).toBe(joinCloneKeys(row2Children[0].state.key!, 'panel-0'));
    });

    it('Repeated rows should be read only', () => {
      const row1 = layout.state.rows[0];
      expect(isInCloneChain(row1.state.key!)).toBe(false);

      const row2 = layout.state.rows[1];
      expect(isInCloneChain(row2.state.key!)).toBe(true);
    });

    it('Should push row at the bottom down', () => {
      // Should push row at the bottom down
      const rowAtTheBottom = layout.state.rows[5];
      expect(rowAtTheBottom.state.title).toBe('Row at the bottom');
    });

    it('Should handle second repeat cycle and update remove old repeats', async () => {
      // trigger another repeat cycle by changing the variable
      const variable = scene.state.$variables!.state.variables[0] as TestVariable;
      variable.changeValueTo(['B1', 'C1']);

      await new Promise((r) => setTimeout(r, 1));

      // should now only have 2 repeated rows (and the panel above + the row at the bottom)
      expect(layout.state.rows.length).toBe(3);
    });

    it('Should ignore repeat process if variable values are the same', async () => {
      // trigger another repeat cycle by changing the variable
      repeatBehavior.performRepeat();

      await new Promise((r) => setTimeout(r, 1));

      expect(layoutStateUpdates.length).toBe(1);
    });
  });

  describe('Given scene with variable with 15 values', () => {
    let scene: DashboardScene, layout: RowsLayoutManager;
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
      // should have 15 repeated rows (and the panel above)
      expect(layout.state.rows.length).toBe(16);

      // trigger another repeat cycle by changing the variable
      const variable = scene.state.$variables!.state.variables[0] as TestVariable;
      variable.changeValueTo(['B1', 'C1']);

      await new Promise((r) => setTimeout(r, 1));

      // should now only have 2 repeated rows (and the panel above)
      expect(layout.state.rows.length).toBe(3);
    });
  });

  describe('Given a scene with empty variable', () => {
    it('Should preserve repeat row', async () => {
      const { scene, layout } = buildScene({ variableQueryTime: 0 }, []);
      activateFullSceneTree(scene);
      await new Promise((r) => setTimeout(r, 1));

      // Should have 2 rows, one without repeat and one with the dummy row
      expect(layout.state.rows.length).toBe(2);
      expect(layout.state.rows[0].state.$behaviors?.[0]).toBeInstanceOf(RowItemRepeaterBehavior);
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
  const repeatBehavior = new RowItemRepeaterBehavior({ variableName: 'server' });

  const rows = [
    new RowItem({
      key: 'row-1',
      $behaviors: [repeatBehavior],
      layout: DefaultGridLayoutManager.fromGridItems([
        new DashboardGridItem({
          key: 'grid-item-1',
          x: 0,
          y: 11,
          width: 24,
          height: 5,
          body: buildTextPanel('text-1', 'Panel inside repeated row, server = $server'),
        }),
      ]),
    }),
    new RowItem({
      key: 'row-2',
      title: 'Row at the bottom',
      layout: DefaultGridLayoutManager.fromGridItems([
        new DashboardGridItem({
          key: 'grid-item-2',
          x: 0,
          y: 17,
          body: buildTextPanel('text-2', 'Panel inside row, server = $server'),
        }),
        new DashboardGridItem({
          key: 'grid-item-3',
          x: 0,
          y: 25,
          body: buildTextPanel('text-3', 'Panel inside row, server = $server'),
        }),
      ]),
    }),
  ];

  const layout = new RowsLayoutManager({ rows });

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

  const rowToRepeat = repeatBehavior.parent as SceneGridRow;

  return { scene, layout, rows, repeatBehavior, rowToRepeat };
}

function getRowLayout(row: RowItem): DefaultGridLayoutManager {
  const layout = row.getLayout();

  if (!(layout instanceof DefaultGridLayoutManager)) {
    throw new Error('Invalid layout');
  }

  return layout;
}

function getRowChildren(row: RowItem): DashboardGridItem[] {
  const layout = getRowLayout(row);

  const filteredChildren = layout.state.grid.state.children.filter((child) => child instanceof DashboardGridItem);

  if (filteredChildren.length !== layout.state.grid.state.children.length) {
    throw new Error('Invalid layout');
  }

  return filteredChildren;
}
