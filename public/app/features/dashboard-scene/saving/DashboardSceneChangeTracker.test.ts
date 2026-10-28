import { SceneObjectStateChangedEvent } from '@grafana/scenes';
import { type Dashboard } from '@grafana/schema';
import { type CorsWorker } from 'app/core/utils/CorsWorker';

import { DashboardScene } from '../scene/DashboardScene';

import { DashboardSceneChangeTracker } from './DashboardSceneChangeTracker';
import * as createDetectChangesWorker from './createDetectChangesWorker';
import { type DashboardChangesRequest, type DashboardChangesResponse } from './shared';

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
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it.each([
    { discardPendingChecks: false, expectedDirty: true },
    { discardPendingChecks: true, expectedDirty: false },
  ])(
    'when stopped with discardPendingChecks=$discardPendingChecks, a pending reply sets dirty to $expectedDirty',
    ({ discardPendingChecks, expectedDirty }) => {
      const { scene, tracker, worker } = buildChangeTracker();
      tracker.startTrackingChanges();
      scene.setState({ title: 'Updated title' });
      const request = worker.postMessage.mock.calls[0][0];

      tracker.stopTrackingChanges({ discardPendingChecks });
      worker.onmessage?.(new MessageEvent('message', { data: { generation: request.generation, hasChanges: true } }));

      expect(scene.state.isDirty).toBe(expectedDirty);
      tracker.terminate();
    }
  );

  it('when resumed after discarding pending checks, an old reply cannot overwrite a fresh result', () => {
    const { scene, tracker, worker } = buildChangeTracker();
    tracker.startTrackingChanges();
    scene.setState({ title: 'Updated title' });
    const oldRequest = worker.postMessage.mock.calls[0][0];
    tracker.stopTrackingChanges({ discardPendingChecks: true });
    tracker.startTrackingChanges({ checkForChanges: true });
    const newRequest = worker.postMessage.mock.calls[1][0];

    worker.onmessage?.(new MessageEvent('message', { data: { generation: newRequest.generation, hasChanges: false } }));
    worker.onmessage?.(new MessageEvent('message', { data: { generation: oldRequest.generation, hasChanges: true } }));

    expect(scene.state.isDirty).toBe(false);
    tracker.terminate();
  });

  it('when resumed after discarding pending checks, a fresh reply marks new edits dirty', () => {
    const { scene, tracker, worker } = buildChangeTracker();
    tracker.startTrackingChanges();
    scene.setState({ title: 'Before pause' });
    tracker.stopTrackingChanges({ discardPendingChecks: true });
    scene.setState({ title: 'Edited while paused' });
    tracker.startTrackingChanges({ checkForChanges: true });
    const request = worker.postMessage.mock.calls[1][0];

    worker.onmessage?.(new MessageEvent('message', { data: { generation: request.generation, hasChanges: true } }));

    expect(scene.state.isDirty).toBe(true);
    tracker.terminate();
  });

  it.each([
    { discardPendingChecks: false, expectedRequests: 1 },
    { discardPendingChecks: true, expectedRequests: 0 },
  ])(
    'when stopped with discardPendingChecks=$discardPendingChecks, queued checks send $expectedRequests requests',
    ({ discardPendingChecks, expectedRequests }) => {
      jest.useFakeTimers();
      jest.replaceProperty(process.env, 'NODE_ENV', 'production');
      const { scene, tracker, worker } = buildChangeTracker();
      tracker.startTrackingChanges();
      scene.setState({ title: 'Updated title' });

      tracker.stopTrackingChanges({ discardPendingChecks });
      jest.advanceTimersByTime(250);
      scene.setState({ title: 'Edit after stop' });
      jest.advanceTimersByTime(250);

      expect(worker.postMessage).toHaveBeenCalledTimes(expectedRequests);
      tracker.terminate();
    }
  );

  it('keeps one change subscription when restarted and releases it on stop', () => {
    const scene = new DashboardScene({ title: 'Initial dashboard' });
    scene.setInitialSaveModel({ title: 'Initial dashboard', schemaVersion: 30 });
    const postMessage = jest.fn();
    const workerSpy = jest
      .spyOn(createDetectChangesWorker, 'createWorker')
      .mockImplementation(() => ({ postMessage }) as unknown as CorsWorker);
    const tracker = new DashboardSceneChangeTracker(scene);

    try {
      tracker.startTrackingChanges();
      tracker.startTrackingChanges();
      scene.setState({ title: 'First edit' });

      expect(postMessage).toHaveBeenCalledTimes(1);
      expect(postMessage).toHaveBeenCalledWith({
        generation: 0,
        initial: { title: 'Initial dashboard', schemaVersion: 30 },
        changed: { title: 'updated dashboard' },
      });

      tracker.stopTrackingChanges();
      scene.setState({ title: 'Edit after stop' });
      expect(postMessage).toHaveBeenCalledTimes(1);

      tracker.startTrackingChanges();
      scene.setState({ title: 'Edit after restart' });
      expect(postMessage).toHaveBeenCalledTimes(2);
    } finally {
      tracker.stopTrackingChanges();
      workerSpy.mockRestore();
    }
  });

  it('should set _changesWorker to undefined when terminate is called', () => {
    const terminate = jest.fn();
    jest.spyOn(createDetectChangesWorker, 'createWorker').mockImplementation(
      () =>
        ({
          terminate,
        }) as unknown as CorsWorker
    );
    const changeTracker = new DashboardSceneChangeTracker(new DashboardScene({}));
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
      generation: 0,
      initial: { title: 'initial dashboard' },
      changed: { title: 'updated dashboard' },
    });
  });
});

function buildChangeTracker() {
  const scene = new DashboardScene({ title: 'Initial dashboard', isEditing: true, isDirty: false });
  scene.setInitialSaveModel({ title: 'Initial dashboard', schemaVersion: 30 });
  const worker = {
    postMessage: jest.fn<void, [DashboardChangesRequest]>(),
    onmessage: null as ((event: MessageEvent<DashboardChangesResponse>) => void) | null,
    terminate: jest.fn(),
  };
  jest.spyOn(createDetectChangesWorker, 'createWorker').mockReturnValue(worker as unknown as CorsWorker);

  return { scene, tracker: new DashboardSceneChangeTracker(scene), worker };
}
