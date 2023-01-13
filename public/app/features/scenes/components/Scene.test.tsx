import { SceneFlexLayout } from '@grafana/scenes';

import { Scene } from './Scene';

describe('Scene', () => {
  it('Simple scene', () => {
    const scene = new Scene({
      title: 'Hello',
      body: new SceneFlexLayout({
        children: [],
      }),
    });

    expect(scene.state.title).toBe('Hello');
  });
});
