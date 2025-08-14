import { VariableRefresh } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import {
  SceneCanvasText,
  SceneGridLayout,
  SceneGridRow,
  SceneGridItem,
  SceneTimeRange,
  SceneVariableSet,
  TestVariable,
  VariableValueOption,
} from '@grafana/scenes';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from 'app/features/variables/constants';

import { getCloneKey, isRepeatCloneOrChildOf } from '../../utils/clone';
import { activateFullSceneTree } from '../../utils/test-utils';
import { DashboardScene } from '../DashboardScene';

import { RepeatDirection } from './DashboardGridItem';
import { DefaultGridLayoutManager } from './DefaultGridLayoutManager';
import { RowRepeaterBehavior } from './RowRepeaterBehavior';
import { RowActions } from './row-actions/RowActions';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  setPluginExtensionGetter: jest.fn(),
  getPluginLinkExtensions: jest.fn().mockReturnValue({ extensions: [] }),
}));

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

describe('RowRepeaterBehavior', () => {
  describe('Given scene with variable with 5 values', () => {
    let scene: DashboardScene, grid: SceneGridLayout, repeatBehavior: RowRepeaterBehavior;
    let gridStateUpdates: unknown[];

    beforeEach(async () => {
      ({ scene, grid, repeatBehavior } = buildScene({ variableQueryTime: 0 }));

      gridStateUpdates = [];
      grid.subscribeToState((state) => gridStateUpdates.push(state));

      activateFullSceneTree(scene);
      await new Promise((r) => setTimeout(r, 1));
    });

    it('Should repeat row', () => {
      // Verify that panel above row remains
      expect(grid.state.children[0]).toBeInstanceOf(SceneGridItem);

      // Verify that first row still has repeat behavior
      const row1 = grid.state.children[1] as SceneGridRow;
      expect(row1.state.key).toBe('row-1');
      expect(row1.state.$behaviors?.[0]).toBeInstanceOf(RowRepeaterBehavior);
      expect(row1.state.$variables!.state.variables[0].getValue()).toBe('A1');
      expect(row1.state.actions).toBeDefined();

      const gridItemRow1 = row1.state.children[0] as SceneGridItem;
      expect(gridItemRow1.state.key!).toBe('grid-item-1');

      const row2 = grid.state.children[2] as SceneGridRow;
      expect(row2.state.key).toBe(getCloneKey('row-1', 1));
      expect(row2.state.$behaviors).toEqual([]);
      expect(row2.state.$variables!.state.variables[0].getValueText?.()).toBe('B');
      expect(row2.state.actions).toBeUndefined();

      const gridItemRow2 = row2.state.children[0] as SceneGridItem;
      expect(gridItemRow2.state.key!).toBe(row2.state.key! + 'grid-item-1');
    });

    it('Repeated rows should be read only', () => {
      const row1 = grid.state.children[1] as SceneGridRow;
      const row2 = grid.state.children[2] as SceneGridRow;
      expect(isRepeatCloneOrChildOf(row1)).toBe(false);
      expect(isRepeatCloneOrChildOf(row2)).toBe(true);
    });

    it('Should update all rows when a panel is added to a clone', async () => {
      const originalRow = grid.state.children[1] as SceneGridRow;
      const clone1 = grid.state.children[2] as SceneGridRow;
      const clone2 = grid.state.children[3] as SceneGridRow;

      expect(originalRow.state.children.length).toBe(1);
      expect(clone1.state.children.length).toBe(1);
      expect(clone2.state.children.length).toBe(1);

      clone1.setState({
        children: [
          ...clone1.state.children,
          new SceneGridItem({
            x: 0,
            y: 16,
            width: 24,
            height: 5,
            key: 'grid-item-4',
            body: new SceneCanvasText({
              text: 'new panel',
            }),
          }),
        ],
      });

      grid.forceRender();

      // repeater has run so there are new clone row objects
      const newClone1 = grid.state.children[2] as SceneGridRow;
      const newClone2 = grid.state.children[3] as SceneGridRow;

      expect(originalRow.state.children.length).toBe(2);
      expect(newClone1.state.children.length).toBe(2);
      expect(newClone2.state.children.length).toBe(2);
    });

    it('Should push row at the bottom down', () => {
      // Should push row at the bottom down
      const rowAtTheBottom = grid.state.children[6] as SceneGridRow;
      expect(rowAtTheBottom.state.title).toBe('Row at the bottom');

      // Panel at the top is 10, each row is (1+5)*5 = 30, so the grid item below it should be 40
      expect(rowAtTheBottom.state.y).toBe(40);
    });

    it('Should push row at the bottom down and also offset its children', () => {
      const rowAtTheBottom = grid.state.children[6] as SceneGridRow;
      const rowChildOne = rowAtTheBottom.state.children[0] as SceneGridItem;
      const rowChildTwo = rowAtTheBottom.state.children[1] as SceneGridItem;

      expect(rowAtTheBottom.state.title).toBe('Row at the bottom');

      // Panel at the top is 10, each row is (1+5)*5 = 30, so the grid item below it should be 40
      expect(rowAtTheBottom.state.y).toBe(40);
      expect(rowChildOne.state.y).toBe(41);
      expect(rowChildTwo.state.y).toBe(49);
    });

    it('Should handle second repeat cycle and update remove old repeats', async () => {
      const sourceRow = grid.state.children[1] as SceneGridRow;
      const sourceGridItem = sourceRow.state.children[0] as SceneGridItem;

      // trigger another repeat cycle by changing the variable
      const variable = scene.state.$variables!.state.variables[0] as TestVariable;
      variable.changeValueTo(['B1', 'C1']);

      await new Promise((r) => setTimeout(r, 1));

      // should now only have 2 repeated rows (and the panel above + the row at the bottom)
      expect(grid.state.children.length).toBe(4);

      // Should reuse source row item instances
      const sourceRowAfterRepeat = grid.state.children[1] as SceneGridRow;
      const sourceItemAfterRepeat = sourceRowAfterRepeat.state.children[0] as SceneGridItem;
      expect(sourceRowAfterRepeat).toBe(sourceRow);
      expect(sourceItemAfterRepeat).toBe(sourceGridItem);
    });

    it('Should ignore repeat process if variable values are the same', async () => {
      // trigger another repeat cycle by changing the variable
      repeatBehavior.performRepeat();

      await new Promise((r) => setTimeout(r, 1));

      expect(gridStateUpdates.length).toBe(1);
    });
  });

  describe('Given scene with variable with 15 values', () => {
    let scene: DashboardScene, grid: SceneGridLayout;
    let gridStateUpdates: unknown[];

    beforeEach(async () => {
      ({ scene, grid } = buildScene({ variableQueryTime: 0 }, [
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

      gridStateUpdates = [];
      grid.subscribeToState((state) => gridStateUpdates.push(state));

      activateFullSceneTree(scene);
      await new Promise((r) => setTimeout(r, 1));
    });

    it('Should handle second repeat cycle and update remove old repeats', async () => {
      // should have 15 repeated rows (and the panel above + the row at the bottom)
      expect(grid.state.children.length).toBe(17);

      // trigger another repeat cycle by changing the variable
      const variable = scene.state.$variables!.state.variables[0] as TestVariable;
      variable.changeValueTo(['B1', 'C1']);

      await new Promise((r) => setTimeout(r, 1));

      // should now only have 2 repeated rows (and the panel above + the row at the bottom)
      expect(grid.state.children.length).toBe(4);
    });
  });

  describe('Given scene empty row', () => {
    let scene: DashboardScene;
    let grid: SceneGridLayout;
    let rowToRepeat: SceneGridRow;

    beforeEach(async () => {
      ({ scene, grid, rowToRepeat } = buildScene({ variableQueryTime: 0 }));

      rowToRepeat.setState({ children: [] });

      activateFullSceneTree(scene);
      await new Promise((r) => setTimeout(r, 1));
    });

    it('Should repeat row', () => {
      // Verify that panel above row remains
      expect(grid.state.children[0]).toBeInstanceOf(SceneGridItem);
      // Verify that first row still has repeat behavior
      const row1 = grid.state.children[1] as SceneGridRow;
      const row2 = grid.state.children[2] as SceneGridRow;
      expect(row1.state.y).toBe(10);
      expect(row2.state.y).toBe(11);
    });
  });

  describe('Given a scene with empty variable', () => {
    it('Should preserve repeat row', async () => {
      const { scene, grid } = buildScene({ variableQueryTime: 0 }, []);
      activateFullSceneTree(scene);
      await new Promise((r) => setTimeout(r, 1));

      // Should have 3 rows, two without repeat and one with the dummy row
      expect(grid.state.children.length).toBe(3);
      expect(grid.state.children[1].state.$behaviors?.[0]).toBeInstanceOf(RowRepeaterBehavior);
    });
  });
});

interface SceneOptions {
  variableQueryTime: number;
  maxPerRow?: number;
  itemHeight?: number;
  repeatDirection?: RepeatDirection;
  variableRefresh?: VariableRefresh;
}

function buildScene(
  options: SceneOptions,
  variableOptions?: VariableValueOption[],
  variableStateOverrides?: { isMulti: boolean }
) {
  const repeatBehavior = new RowRepeaterBehavior({ variableName: 'server' });

  const grid = new SceneGridLayout({
    children: [
      new SceneGridItem({
        key: 'griditem-no-row',
        x: 0,
        y: 0,
        width: 24,
        height: 10,
        body: new SceneCanvasText({
          text: 'Panel above row',
        }),
      }),
      new SceneGridRow({
        key: 'row-1',
        x: 0,
        y: 10,
        width: 24,
        height: 1,
        actions: new RowActions({}),
        $behaviors: [repeatBehavior],
        children: [
          new SceneGridItem({
            key: 'grid-item-1',
            x: 0,
            y: 11,
            width: 24,
            height: 5,
            body: new SceneCanvasText({
              key: 'canvas-1',
              text: 'Panel inside repeated row, server = $server',
            }),
          }),
        ],
      }),
      new SceneGridRow({
        key: 'row-2',
        x: 0,
        y: 16,
        width: 24,
        height: 5,
        title: 'Row at the bottom',
        children: [
          new SceneGridItem({
            key: 'grid-item-2',
            x: 0,
            y: 17,
            body: new SceneCanvasText({
              key: 'canvas-2',
              text: 'Panel inside row, server = $server',
            }),
          }),
          new SceneGridItem({
            key: 'grid-item-3',
            x: 0,
            y: 25,
            body: new SceneCanvasText({
              key: 'canvas-3',
              text: 'Panel inside row, server = $server',
            }),
          }),
        ],
      }),
    ],
  });

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
    body: new DefaultGridLayoutManager({ grid }),
  });

  const rowToRepeat = repeatBehavior.parent as SceneGridRow;

  return { scene, grid, repeatBehavior, rowToRepeat };
}
