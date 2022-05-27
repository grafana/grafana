import { Scene } from './Scene';
import { SceneFlexLayout } from './SceneFlexLayout';
import { VizPanel } from './VizPanel';

describe('Scene', () => {
  it('SceneItem should have parent when added to container', () => {
    const vizPanel = new VizPanel({ pluginId: 'table' });
    const scene = new Scene({
      title: 'Hello',
      layout: new SceneFlexLayout({
        direction: 'row',
        size: {},
        children: [vizPanel],
      }),
    });

    expect(vizPanel.parent).toBe(scene.state.layout);
    expect(vizPanel.parent!.parent).toBe(scene);
  });
});
