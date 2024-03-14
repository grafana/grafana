import { getPanelPlugin } from '@grafana/data/test/__mocks__/pluginMocks';
import { setPluginImportUtils } from '@grafana/runtime';
import { SceneGridLayout } from '@grafana/scenes';

import { activateFullSceneTree, buildPanelRepeaterScene } from '../utils/test-utils';

setPluginImportUtils({
  importPanelPlugin: (id: string) => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: (id: string) => undefined,
});

describe('PanelRepeaterGridItem', () => {
  it('Given scene with variable with 2 values', async () => {
    const { scene, repeater } = buildPanelRepeaterScene({ variableQueryTime: 0 });

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
    const { scene, repeater } = buildPanelRepeaterScene({ variableQueryTime: 1 });

    activateFullSceneTree(scene);

    expect(repeater.state.repeatedPanels?.length).toBe(0);

    await new Promise((r) => setTimeout(r, 10));

    expect(repeater.state.repeatedPanels?.length).toBe(5);
  });

  it('Should adjust container height to fit panels direction is horizontal', async () => {
    const { scene, repeater } = buildPanelRepeaterScene({ variableQueryTime: 0, maxPerRow: 2, itemHeight: 10 });

    const layoutForceRender = jest.fn();
    (scene.state.body as SceneGridLayout).forceRender = layoutForceRender;

    activateFullSceneTree(scene);

    // panels require 3 rows so total height should be 30
    expect(repeater.state.height).toBe(30);
    // Should update layout state by force re-render
    expect(layoutForceRender.mock.calls.length).toBe(1);
  });

  it('Should adjust container height to fit panels when direction is vertical', async () => {
    const { scene, repeater } = buildPanelRepeaterScene({ variableQueryTime: 0, itemHeight: 10, repeatDirection: 'v' });

    activateFullSceneTree(scene);

    // In vertical direction height itemCount * itemHeight
    expect(repeater.state.height).toBe(50);
  });

  it('Should adjust itemHeight when container is resized, direction horizontal', async () => {
    const { scene, repeater } = buildPanelRepeaterScene({
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
    const { scene, repeater } = buildPanelRepeaterScene({
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

  it('Should update repeats when updating variable', async () => {
    const { scene, repeater, variable } = buildPanelRepeaterScene({ variableQueryTime: 0 });

    activateFullSceneTree(scene);

    variable.changeValueTo(['1', '3'], ['A', 'C']);

    expect(repeater.state.repeatedPanels?.length).toBe(2);
  });

  it('Should fall back to default variable if specified variable cannot be found', () => {
    const { scene, repeater } = buildPanelRepeaterScene({ variableQueryTime: 0 });
    scene.setState({ $variables: undefined });
    activateFullSceneTree(scene);
    expect(repeater.state.repeatedPanels?.[0].state.$variables?.state.variables[0].state.name).toBe(
      '_____default_sys_repeat_var_____'
    );
  });
});
