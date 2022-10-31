import { SceneVariableSet } from '../variables/sets/SceneVariableSet';

import { SceneDataNode } from './SceneDataNode';
import { SceneObjectBase } from './SceneObjectBase';
import { SceneObjectStateChangedEvent } from './events';
import { SceneLayoutChild, SceneObject, SceneObjectStatePlain } from './types';

interface TestSceneState extends SceneObjectStatePlain {
  name?: string;
  nested?: SceneObject<TestSceneState>;
  children?: SceneLayoutChild[];
  actions?: SceneObject[];
}

class TestScene extends SceneObjectBase<TestSceneState> {}

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
});
