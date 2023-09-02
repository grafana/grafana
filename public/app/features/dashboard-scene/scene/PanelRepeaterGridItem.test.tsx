import { EmbeddedScene, SceneTimeRange, SceneVariableSet, TestVariable, VizPanel } from '@grafana/scenes';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from 'app/features/variables/constants';

import { PanelRepeaterGridItem, RepeatDirection } from './PanelRepeaterGridItem';

describe('PanelRepeaterGridItem', () => {
  it('Given scene with variable with 2 values', async () => {
    const { scene, repeater } = buildScene({ variableQueryTime: 0 });

    scene.activate();
    repeater.activate();

    expect(repeater.state.repeatedPanels?.length).toBe(5);

    const panel1 = repeater.state.repeatedPanels![0];
    const panel2 = repeater.state.repeatedPanels![1];

    // Panels should have scoped variables
    expect(panel1.state.$variables?.state.variables[0].getValue()).toBe('1');
    expect(panel2.state.$variables?.state.variables[0].getValue()).toBe('2');
  });

  it('Should wait for variable to load', async () => {
    const { scene, repeater } = buildScene({ variableQueryTime: 1 });

    scene.activate();
    repeater.activate();

    expect(repeater.state.repeatedPanels?.length).toBe(0);

    await new Promise((r) => setTimeout(r, 10));

    expect(repeater.state.repeatedPanels?.length).toBe(5);
  });

  it('Should adjust container height to fit panels direction is horizontal', async () => {
    const { scene, repeater } = buildScene({ variableQueryTime: 0, maxPerRow: 2, itemHeight: 10 });

    scene.activate();
    repeater.activate();

    // panels require 3 rows so total height should be 30
    expect(repeater.state.height).toBe(30);
  });

  it('Should adjust container height to fit panels when direction is vertical', async () => {
    const { scene, repeater } = buildScene({ variableQueryTime: 0, itemHeight: 10, repeatDirection: 'v' });

    scene.activate();
    repeater.activate();

    // panels require 5 rows so total height should be 50
    expect(repeater.state.height).toBe(50);
  });
});

interface SceneOptions {
  variableQueryTime: number;
  maxPerRow?: number;
  itemHeight?: number;
  repeatDirection?: RepeatDirection;
}

function buildScene(options: SceneOptions) {
  const repeater = new PanelRepeaterGridItem({
    variableName: 'server',
    repeatedPanels: [],
    repeatDirection: options.repeatDirection,
    maxPerRow: options.maxPerRow,
    itemHeight: options.itemHeight,
    source: new VizPanel({
      title: 'Panel $server',
      pluginId: 'timeseries',
    }),
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
    body: repeater,
  });

  return { scene, repeater };
}
