import { SceneItemBase } from './SceneItem';
import { SceneItem, SceneItemList, SceneItemState } from './types';

interface TestItemState extends SceneItemState {
  name?: string;
  nested?: SceneItem<TestItemState>;
  children?: SceneItemList;
}

class TestItem extends SceneItemBase<TestItemState> {}

describe('SceneItem', () => {
  it('Can clone', () => {
    const scene = new TestItem({
      nested: new TestItem({
        name: 'nested',
      }),
      children: [
        new TestItem({
          name: 'layout child',
        }),
      ],
    });

    scene.state.nested?.onMount();

    const clone = scene.clone();
    expect(clone).not.toBe(scene);
    expect(clone.state.nested).not.toBe(scene.state.nested);
    expect(clone.state.nested?.isMounted).toBe(undefined);
    expect(clone.state.children![0]).not.toBe(scene.state.children![0]);
  });

  it('Can clone with state change', () => {
    const scene = new TestItem({
      nested: new TestItem({
        name: 'nested',
      }),
    });

    const clone = scene.clone({ name: 'new name' });
    expect(clone.state.name).toBe('new name');
  });
});
