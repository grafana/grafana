import {
  type SceneDataTransformation,
  type SceneDataTransformerState,
  type SceneObject,
  type SceneObjectState,
  SceneObjectStateChangedEvent,
} from '@grafana/scenes';
import { type Dashboard, DataTopic } from '@grafana/schema';
import { type CorsWorker } from 'app/core/utils/CorsWorker';
import * as createDetectChangesWorker from 'app/features/dashboard-scene/saving/createDetectChangesWorker';

import { DashboardScene } from '../scene/DashboardScene';
import { PanelDataTransformer } from '../scene/PanelDataTransformer';

import { DashboardSceneChangeTracker } from './DashboardSceneChangeTracker';

jest.mock('../serialization/transformSceneToSaveModel', () => {
  return {
    transformSceneToSaveModel: () => {
      return {
        title: 'updated dashboard',
        invalidProp: () => 'function',
      };
    },
  };
});

describe('DashboardSceneChangeTracker', () => {
  it('should set _changesWorker to undefined when terminate is called', () => {
    const terminate = jest.fn();
    jest.spyOn(createDetectChangesWorker, 'createWorker').mockImplementation(
      () =>
        ({
          terminate,
        }) as unknown as CorsWorker
    );
    const changeTracker = new DashboardSceneChangeTracker({
      subscribeToEvent: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
    } as unknown as DashboardScene);
    changeTracker.startTrackingChanges();

    expect(changeTracker['_changesWorker']).not.toBeUndefined();
    changeTracker.terminate();
    expect(changeTracker['_changesWorker']).toBeUndefined();
  });

  it('should remove non clonable properties before sending to worker', () => {
    const scene = new DashboardScene({});
    const postMessage = jest.fn();

    jest.spyOn(createDetectChangesWorker, 'createWorker').mockImplementation(() => {
      return {
        postMessage,
      } as unknown as CorsWorker;
    });
    jest.spyOn(DashboardSceneChangeTracker, 'isUpdatingPersistedState').mockImplementation(() => {
      return true;
    });
    jest.spyOn(scene, 'getInitialSaveModel').mockReturnValue({
      title: 'initial dashboard',
      invalidProp: () => 'function',
    } as unknown as Dashboard);

    const changeTracker = new DashboardSceneChangeTracker(scene);
    changeTracker.startTrackingChanges();

    scene.publishEvent({ type: SceneObjectStateChangedEvent.type, payload: { a: 1 } });

    expect(postMessage).toHaveBeenCalledWith({
      initial: { title: 'initial dashboard' },
      changed: { title: 'updated dashboard' },
    });
  });

  describe('isUpdatingPersistedState', () => {
    // An earlier test in this file stubs the method being tested here.
    beforeEach(() => {
      jest.restoreAllMocks();
    });

    /**
     * The guard diffs prev against new rather than reading the update key, so both states have to be
     * real — `newState` is derived the way `setState` would derive it.
     */
    function stateChangedEvent(
      changedObject: SceneObject,
      partialUpdate: Partial<SceneDataTransformerState>,
      prevState: Partial<SceneDataTransformerState> = { transformations: [] }
    ) {
      return new SceneObjectStateChangedEvent({
        prevState: prevState as SceneObjectState,
        newState: { ...prevState, ...partialUpdate } as SceneObjectState,
        partialUpdate,
        changedObject,
      });
    }

    const systemPrepend: SceneDataTransformation = {
      operator: () => (source) => source,
      topic: DataTopic.Series,
      origin: 'system',
      position: 'prepend',
    };

    it('treats a transformations change as a change to persisted state', () => {
      const transformer = new PanelDataTransformer({ transformations: [] });

      expect(
        DashboardSceneChangeTracker.isUpdatingPersistedState(
          stateChangedEvent(transformer, { transformations: [{ id: 'reduce', options: {} }] })
        )
      ).toBe(true);
    });

    it('ignores installing system transformations', () => {
      const transformer = new PanelDataTransformer({ transformations: [] });

      // The plugin's transformations are never persisted, so diffing the whole dashboard for
      // them would only cost main-thread time.
      expect(
        DashboardSceneChangeTracker.isUpdatingPersistedState(
          stateChangedEvent(transformer, { transformations: [systemPrepend] })
        )
      ).toBe(false);
    });

    it('ignores removing system transformations', () => {
      const transformer = new PanelDataTransformer({ transformations: [] });

      expect(
        DashboardSceneChangeTracker.isUpdatingPersistedState(
          stateChangedEvent(transformer, { transformations: [] }, { transformations: [systemPrepend] })
        )
      ).toBe(false);
    });

    it('treats a user edit alongside system transformations as a change', () => {
      const transformer = new PanelDataTransformer({ transformations: [] });

      // Both writes land on the same key, so only the user subset distinguishes them.
      expect(
        DashboardSceneChangeTracker.isUpdatingPersistedState(
          stateChangedEvent(
            transformer,
            { transformations: [systemPrepend, { id: 'organize', options: {} }] },
            { transformations: [systemPrepend, { id: 'reduce', options: {} }] }
          )
        )
      ).toBe(true);
    });
  });
});
