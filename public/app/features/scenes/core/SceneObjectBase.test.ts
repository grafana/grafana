import { SceneVariableSet } from '../variables/sets/SceneVariableSet';

import { SceneDataNode } from './SceneDataNode';
import { SceneObjectBase } from './SceneObjectBase';
import { SceneObjectStateChangedEvent } from './events';
import { SceneLayoutChild, SceneObject, SceneObjectStatePlain } from './types';
import { getSceneObjectsCache } from './SceneObjectsCache';

interface TestSceneState extends SceneObjectStatePlain {
  name?: string;
  nested?: SceneObject<TestSceneState>;
  children?: SceneLayoutChild[];
  actions?: SceneObject[];
}

class TestScene extends SceneObjectBase<TestSceneState> {}

interface TestObjectState extends SceneObjectStatePlain {
  stateProp1: number;
  stateProp2: {
    a: string;
  };
}
class TestObject extends SceneObjectBase<TestObjectState> {
  public constructor(state: Partial<TestObjectState>) {
    super({
      // default state
      stateProp1: 2,
      // default state
      stateProp2: {
        a: 'b',
      },
      ...state,
    });
  }
}

describe('SceneObject', () => {
  it('Can clone', () => {
    const scene = new TestScene({
      nested: new TestScene({
        name: 'nested',
      }),
      actions: [
        new TestScene({
          name: 'action child',
        }),
      ],
      children: [
        new TestScene({
          name: 'layout child',
        }),
      ],
    });

    scene.state.nested?.activate();

    const clone = scene.clone();
    expect(clone).not.toBe(scene);
    expect(clone.state.nested).not.toBe(scene.state.nested);
    expect(clone.state.nested?.isActive).toBe(false);
    expect(clone.state.children![0]).not.toBe(scene.state.children![0]);
    expect(clone.state.actions![0]).not.toBe(scene.state.actions![0]);
  });

  it('SceneObject should have parent when added to container', () => {
    const scene = new TestScene({
      nested: new TestScene({
        name: 'nested',
      }),
      children: [
        new TestScene({
          name: 'layout child',
        }),
      ],
      actions: [
        new TestScene({
          name: 'layout child',
        }),
      ],
    });

    expect(scene.parent).toBe(undefined);
    expect(scene.state.nested?.parent).toBe(scene);
    expect(scene.state.children![0].parent).toBe(scene);
    expect(scene.state.actions![0].parent).toBe(scene);
  });

  it('Can clone with state change', () => {
    const scene = new TestScene({
      nested: new TestScene({
        name: 'nested',
      }),
    });

    const clone = scene.clone({ name: 'new name' });
    expect(clone.state.name).toBe('new name');
  });

  it('Cannot modify state', () => {
    const scene = new TestScene({ name: 'name' });
    expect(() => {
      scene.state.name = 'new name';
    }).toThrow();

    scene.setState({ name: 'new name' });
    expect(scene.state.name).toBe('new name');

    expect(() => {
      scene.state.name = 'other name';
    }).toThrow();
  });

  describe('When activated', () => {
    const scene = new TestScene({
      $data: new SceneDataNode({}),
      $variables: new SceneVariableSet({ variables: [] }),
    });

    scene.activate();

    it('Should set isActive true', () => {
      expect(scene.isActive).toBe(true);
    });

    it('Should activate $data', () => {
      expect(scene.state.$data!.isActive).toBe(true);
    });

    it('Should activate $variables', () => {
      expect(scene.state.$variables!.isActive).toBe(true);
    });
  });

  describe('When deactivated', () => {
    const scene = new TestScene({
      $data: new SceneDataNode({}),
      $variables: new SceneVariableSet({ variables: [] }),
    });

    scene.activate();

    // Subscribe to state change and to event
    const stateSub = scene.subscribeToState({ next: () => {} });
    const eventSub = scene.subscribeToEvent(SceneObjectStateChangedEvent, () => {});

    scene.deactivate();

    it('Should close subscriptions', () => {
      expect(stateSub.closed).toBe(true);
      expect((eventSub as any).closed).toBe(true);
    });

    it('Should set isActive false', () => {
      expect(scene.isActive).toBe(false);
    });

    it('Should deactivate $data', () => {
      expect(scene.state.$data!.isActive).toBe(false);
    });

    it('Should deactivate $variables', () => {
      expect(scene.state.$variables!.isActive).toBe(false);
    });
  });

  describe('Caching', () => {
    beforeEach(() => {
      getSceneObjectsCache().set({
        key: 'previouslyCachedKey',
        cacheKey: 'cacheKey',
        stateProp1: 1,
        stateProp2: { a: 'a' },
      });
    });

    it('when no cache key specified should initialise with provided state ', () => {
      const obj = new TestObject({
        stateProp1: 4,
        stateProp2: { a: 'c' },
      });
      obj.activate();

      expect(obj.state.stateProp1).toBe(4);
      expect(obj.state.stateProp2).toEqual({ a: 'c' });
    });
    it('when no cache key specified and not cached previously should initialise with provided state and cache state ', () => {
      const obj = new TestObject({
        cacheKey: 'cacheKeyNotCachedYet',
        stateProp1: 4,
        stateProp2: { a: 'c' },
      });
      obj.activate();

      expect(obj.state.stateProp1).toBe(4);
      expect(obj.state.stateProp2).toEqual({ a: 'c' });

      const cached = getSceneObjectsCache().get('cacheKeyNotCachedYet');
      expect(cached).toBeDefined();
      expect((cached as TestObjectState).stateProp1).toBe(4);
      expect((cached as TestObjectState).stateProp2).toEqual({ a: 'c' });
    });
    it('should resolve initial state from cache', () => {
      const obj = new TestObject({
        cacheKey: 'cacheKey',
      });
      obj.activate();

      expect(obj.state.stateProp1).toBe(1);
      expect(obj.state.stateProp2).toEqual({ a: 'a' });
      expect(obj.state.key).not.toBe('previouslyCachedKey');
    });

    it('should update cache when state changes', () => {
      const obj = new TestObject({
        cacheKey: 'cacheKey',
      });
      obj.activate();
      obj.setState({
        stateProp1: 2,
        stateProp2: { a: 'b' },
      });

      expect(obj.state.stateProp1).toBe(2);
      expect(obj.state.stateProp2).toEqual({ a: 'b' });
      expect(obj.state.key).not.toBe('previouslyCachedKey');
    });

    it('should preserve state in cache when deactivated', () => {
      const obj = new TestObject({
        cacheKey: 'cacheKey',
      });
      obj.activate();
      obj.setState({
        stateProp1: 2,
        stateProp2: { a: 'b' },
      });

      obj.deactivate();

      expect(obj.state.stateProp1).toBe(2);
      expect(obj.state.stateProp2).toEqual({ a: 'b' });
      expect(obj.state.key).not.toBe('previouslyCachedKey');
    });
  });
});
