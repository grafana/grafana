import * as createDetectChangesWorker from 'app/features/dashboard-scene/saving/createDetectChangesWorker';

import { DashboardSceneChangeTracker } from './DashboardSceneChangeTracker';

describe('DashboardSceneChangeTracker', () => {
  it('should set _changesWorker to undefined when terminate is called', () => {
    const terminate = jest.fn();
    jest.spyOn(createDetectChangesWorker, 'createWorker').mockImplementation(
      () =>
        ({
          terminate,
        }) as any
    );
    const changeTracker = new DashboardSceneChangeTracker({
      subscribeToEvent: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
    } as any);
    changeTracker.startTrackingChanges();

    expect(changeTracker['_changesWorker']).not.toBeUndefined();
    changeTracker.terminate();
    expect(changeTracker['_changesWorker']).toBeUndefined();
  });
});
