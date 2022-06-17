import { SceneObjectBase } from './SceneObjectBase';
import { SceneObject, SceneObjectList, SceneObjectState } from './types';

interface TestItemState extends SceneObjectState {
  name?: string;
  nested?: SceneObject<TestItemState>;
  children?: SceneObjectList;
}

class TestItem extends SceneObjectBase<TestItemState> {}

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

  it('SceneObject should have parent when added to container', () => {
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

    expect(scene.parent).toBe(undefined);
    expect(scene.state.nested?.parent).toBe(scene);
    expect(scene.state.children![0].parent).toBe(scene);
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
