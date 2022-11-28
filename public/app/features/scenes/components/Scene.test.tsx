import { Scene } from './Scene';
import { SceneFlexLayout } from './layout/SceneFlexLayout';

describe('Scene', () => {
  it('Simple scene', () => {
    const scene = new Scene({
      title: 'Hello',
      layout: new SceneFlexLayout({
        children: [],
      }),
    });

    expect(scene.state.title).toBe('Hello');
  });
});
