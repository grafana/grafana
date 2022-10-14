import { Scene } from '../components/Scene';

import { SceneContextObject } from './SceneContextObject';
import { SceneDataObject, SceneObjectBase } from './SceneObjectBase';
import {
  DataInputState,
  SceneDataState,
  SceneLayoutChild,
  SceneLayoutState,
  SceneObject,
  SceneObjectStatePlain,
} from './types';

interface TestSceneState extends SceneObjectStatePlain {
  name?: string;
  nested?: SceneObject<TestSceneState>;
  children?: SceneLayoutChild[];
  actions?: SceneObject[];
}

class TestScene extends SceneContextObject<TestSceneState> {}

describe('SceneObject', () => {
  it('Can clone', () => {
    const scene = new TestScene({
      nested: new TestScene({
        name: 'nested',
      }),
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
    expect(clone.state.nested?.isActive).toBe(undefined);
    expect(clone.state.children![0]).not.toBe(scene.state.children![0]);
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
});

describe('SceneDataObject context', () => {
  interface TestDataConsumerState extends SceneObjectStatePlain, DataInputState<SceneDataState, SceneDataObject> {}
  class TestDataConsumer extends SceneObjectBase<TestDataConsumerState> {}
  class TestDataProducer extends SceneDataObject<SceneDataState> {}

  interface BasicSceneLayoutState extends SceneObjectStatePlain, SceneLayoutState {}
  class BasicSceneLayout extends SceneObjectBase<BasicSceneLayoutState> {}

  class SceneContextProvider extends SceneContextObject<
    SceneObjectStatePlain & { layout: SceneObject; inheritContext?: boolean }
  > {}

  it('should use Scene context', () => {
    const dataProducer = new TestDataProducer({});
    const dataConsumer = new TestDataConsumer({
      $data: dataProducer,
    });

    const scene = new Scene({
      title: 'Test',
      layout: dataConsumer,
    });

    dataConsumer.activate();
    expect(dataProducer.getContext()).toEqual(scene.getContext());
  });

  it('should use closes context', () => {
    const dataProducer1 = new TestDataProducer({});
    const dataConsumer1 = new TestDataConsumer({
      $data: dataProducer1,
    });

    const dataProducer2 = new TestDataProducer({});
    const dataConsumer2 = new TestDataConsumer({
      $data: dataProducer2,
    });

    const nestedScene = new Scene({
      title: 'Nested',
      layout: dataConsumer2,
    });

    const scene = new SceneContextProvider({
      layout: new BasicSceneLayout({
        children: [dataConsumer1, nestedScene],
      }),
    });

    dataConsumer1.activate();
    dataConsumer2.activate();
    expect(dataProducer1.getContext()).toEqual(scene.getContext());
    expect(nestedScene.getContext()).not.toEqual(scene.getContext());
    expect(dataProducer2.getContext()).toEqual(nestedScene.getContext());
  });

  it('should use inherit context', () => {
    const dataProducer1 = new TestDataProducer({});
    const dataConsumer1 = new TestDataConsumer({
      $data: dataProducer1,
    });

    const dataProducer2 = new TestDataProducer({});
    const dataConsumer2 = new TestDataConsumer({
      $data: dataProducer2,
    });

    const nestedScene = new SceneContextProvider({
      inheritContext: true,
      layout: dataConsumer2,
    });

    const scene = new Scene({
      title: 'Test',
      layout: new BasicSceneLayout({
        children: [dataConsumer1, nestedScene],
      }),
    });

    dataConsumer1.activate();
    dataConsumer2.activate();

    expect(dataProducer1.getContext()).toEqual(scene.getContext());
    expect(nestedScene.getContext()).toEqual(scene.getContext());
    expect(dataProducer2.getContext()).toEqual(scene.getContext());
  });
});
