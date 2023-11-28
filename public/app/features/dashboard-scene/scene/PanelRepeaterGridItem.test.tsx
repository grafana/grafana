import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { setPluginImportUtils } from '@grafana/runtime';
import {
  EmbeddedScene,
  SceneGridLayout,
  SceneGridRow,
  SceneTimeRange,
  SceneVariableSet,
  TestVariable,
  VizPanel,
} from '@grafana/scenes';
import { ALL_VARIABLE_TEXT, ALL_VARIABLE_VALUE } from 'app/features/variables/constants';

import { activateFullSceneTree } from '../utils/test-utils';

import { PanelRepeaterGridItem, RepeatDirection } from './PanelRepeaterGridItem';

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

describe('PanelRepeaterGridItem', () => {
  it('Given scene with variable with 2 values', async () => {
    const { scene, repeater } = buildScene({ variableQueryTime: 0 });

    activateFullSceneTree(scene);

    expect(repeater.state.repeatedPanels?.length).toBe(5);

    const panel1 = repeater.state.repeatedPanels![0];
    const panel2 = repeater.state.repeatedPanels![1];

    // Panels should have scoped variables
    expect(panel1.state.$variables?.state.variables[0].getValue()).toBe('1');
    expect(panel1.state.$variables?.state.variables[0].getValueText?.()).toBe('A');
    expect(panel2.state.$variables?.state.variables[0].getValue()).toBe('2');
  });

  it('Should wait for variable to load', async () => {
    const { scene, repeater } = buildScene({ variableQueryTime: 1 });

    activateFullSceneTree(scene);

    expect(repeater.state.repeatedPanels?.length).toBe(0);

    await new Promise((r) => setTimeout(r, 10));

    expect(repeater.state.repeatedPanels?.length).toBe(5);
  });

  it('Should adjust container height to fit panels direction is horizontal', async () => {
    const { scene, repeater } = buildScene({ variableQueryTime: 0, maxPerRow: 2, itemHeight: 10 });

    const layoutForceRender = jest.fn();
    (scene.state.body as SceneGridLayout).forceRender = layoutForceRender;

    activateFullSceneTree(scene);

    // panels require 3 rows so total height should be 30
    expect(repeater.state.height).toBe(30);
    // Should update layout state by force re-render
    expect(layoutForceRender.mock.calls.length).toBe(1);
  });

  it('Should adjust container height to fit panels when direction is vertical', async () => {
    const { scene, repeater } = buildScene({ variableQueryTime: 0, itemHeight: 10, repeatDirection: 'v' });

    activateFullSceneTree(scene);

    // In vertical direction height itemCount * itemHeight
    expect(repeater.state.height).toBe(50);
  });

  it('Should adjust itemHeight when container is resized, direction horizontal', async () => {
    const { scene, repeater } = buildScene({
      variableQueryTime: 0,
      itemHeight: 10,
      repeatDirection: 'h',
      maxPerRow: 4,
    });

    activateFullSceneTree(scene);

    // Sould be two rows (5 panels and maxPerRow 5)
    expect(repeater.state.height).toBe(20);

    // resize container
    repeater.setState({ height: 10 });
    // given 2 current rows, the itemHeight is halved
    expect(repeater.state.itemHeight).toBe(5);
  });

  it('Should adjust itemHeight when container is resized, direction vertical', async () => {
    const { scene, repeater } = buildScene({
      variableQueryTime: 0,
      itemHeight: 10,
      repeatDirection: 'v',
    });

    activateFullSceneTree(scene);

    // In vertical direction height itemCount * itemHeight
    expect(repeater.state.height).toBe(50);

    // resize container
    repeater.setState({ height: 25 });
    // given 5 rows with total height 25 gives new itemHeight of 5
    expect(repeater.state.itemHeight).toBe(5);
  });

  it('When updating variable should update repeats', async () => {
    const { scene, repeater, variable } = buildScene({ variableQueryTime: 0 });

    activateFullSceneTree(scene);

    variable.changeValueTo(['1', '3'], ['A', 'C']);

    expect(repeater.state.repeatedPanels?.length).toBe(2);
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

  const variable = new TestVariable({
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
  });

  const scene = new EmbeddedScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    $variables: new SceneVariableSet({
      variables: [variable],
    }),
    body: new SceneGridLayout({
      children: [
        new SceneGridRow({
          children: [repeater],
        }),
      ],
    }),
  });

  return { scene, repeater, variable };
}
