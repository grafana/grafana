import {
  EmbeddedScene,
  SceneCanvasText,
  SceneGridItem,
  SceneGridLayout,
  SceneGridRow,
  SceneTimeRange,
  SceneVariableSet,
  TestVariable,
} from '@grafana/scenes';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from 'app/features/variables/constants';

import { activateFullSceneTree } from '../utils/test-utils';

import { RepeatDirection } from './PanelRepeaterGridItem';
import { RowRepeaterBehavior } from './RowRepeaterBehavior';

describe('RowRepeaterBehavior', () => {
  describe('Given scene with variable with 5 values', () => {
    let scene: EmbeddedScene, grid: SceneGridLayout;

    beforeEach(async () => {
      ({ scene, grid } = buildScene({ variableQueryTime: 0 }));
      activateFullSceneTree(scene);
      await new Promise((r) => setTimeout(r, 1));
    });

    it('Should repeat row', () => {
      // Verify that panel above row remains
      expect(grid.state.children[0]).toBeInstanceOf(SceneGridItem);
      // Verify that first row still has repeat behavior
      const row1 = grid.state.children[1] as SceneGridRow;
      expect(row1.state.$behaviors?.[0]).toBeInstanceOf(RowRepeaterBehavior);
      expect(row1.state.$variables!.state.variables[0].getValue()).toBe('1');

      const row2 = grid.state.children[2] as SceneGridRow;
      expect(row2.state.$variables!.state.variables[0].getValueText?.()).toBe('B');

      // Should give repeated panels unique keys
      const gridItem = row2.state.children[0] as SceneGridItem;
      expect(gridItem.state.body?.state.key).toBe('canvas-1-row-1');
    });

    it('Should push row at the bottom down', () => {
      // Should push row at the bottom down
      const rowAtTheBottom = grid.state.children[6] as SceneGridRow;
      expect(rowAtTheBottom.state.title).toBe('Row at the bottom');

      // Panel at the top is 10, each row is (1+5)*5 = 30, so the grid item below it should be 40
      expect(rowAtTheBottom.state.y).toBe(40);
    });

    it('Should handle second repeat cycle and update remove old repeats', async () => {
      // trigger another repeat cycle by changing the variable
      const variable = scene.state.$variables!.state.variables[0] as TestVariable;
      variable.changeValueTo(['2', '3']);

      await new Promise((r) => setTimeout(r, 1));

      // should now only have 2 repeated rows (and the panel above + the row at the bottom)
      expect(grid.state.children.length).toBe(4);
    });
  });
});

interface SceneOptions {
  variableQueryTime: number;
  maxPerRow?: number;
  itemHeight?: number;
  repeatDirection?: RepeatDirection;
}

function buildScene(options: SceneOptions) {
  const grid = new SceneGridLayout({
    children: [
      new SceneGridItem({
        x: 0,
        y: 0,
        width: 24,
        height: 10,
        body: new SceneCanvasText({
          text: 'Panel above row',
        }),
      }),
      new SceneGridRow({
        x: 0,
        y: 10,
        width: 24,
        height: 1,
        $behaviors: [
          new RowRepeaterBehavior({
            variableName: 'server',
            sources: [
              new SceneGridItem({
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
        ],
      }),
      new SceneGridRow({
        x: 0,
        y: 16,
        width: 24,
        height: 5,
        title: 'Row at the bottom',
      }),
    ],
  });

  const scene = new EmbeddedScene({
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
          optionsToReturn: [
            { label: 'A', value: '1' },
            { label: 'B', value: '2' },
            { label: 'C', value: '3' },
            { label: 'D', value: '4' },
            { label: 'E', value: '5' },
          ],
        }),
      ],
    }),
    body: grid,
  });

  return { scene, grid };
}
