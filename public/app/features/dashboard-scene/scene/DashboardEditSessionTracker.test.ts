import { DashboardInteractions } from '../utils/interactions';

import { DashboardEditSessionTracker } from './DashboardEditSessionTracker';
import type { DashboardScene } from './DashboardScene';

function setup(uid = 'dash-uid') {
  const scene = { state: { uid } } as unknown as DashboardScene;
  const tracker = new DashboardEditSessionTracker(scene);
  const startedSpy = jest.spyOn(DashboardInteractions, 'editSessionStarted').mockImplementation();
  return { tracker, startedSpy };
}

describe('DashboardEditSessionTracker', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('emits a single started event on the first assistant edit only', () => {
    const { tracker, startedSpy } = setup();

    tracker.recordAssistantEdit();
    tracker.recordAssistantEdit();

    expect(startedSpy).toHaveBeenCalledTimes(1);
    expect(startedSpy).toHaveBeenCalledWith({ dashboard_uid: 'dash-uid' });
  });

  it('reports a zero count and emits nothing when there is no assistant edit', () => {
    const { tracker, startedSpy } = setup();

    expect(tracker.getAssistantEditCount()).toBe(0);
    expect(startedSpy).not.toHaveBeenCalled();
  });

  it('getAssistantEditCount returns the number of assistant edits without closing the session', () => {
    const { tracker } = setup();

    tracker.recordAssistantEdit();
    tracker.recordAssistantEdit();
    tracker.recordAssistantEdit();

    expect(tracker.getAssistantEditCount()).toBe(3);
    // pure read: the count is unchanged on a second call
    expect(tracker.getAssistantEditCount()).toBe(3);
  });

  it('reset() closes the session so the count restarts and a new edit opens a new session', () => {
    const { tracker, startedSpy } = setup();

    tracker.recordAssistantEdit();
    tracker.recordAssistantEdit();
    tracker.reset();

    expect(tracker.getAssistantEditCount()).toBe(0);

    tracker.recordAssistantEdit();
    expect(startedSpy).toHaveBeenCalledTimes(2);
    expect(tracker.getAssistantEditCount()).toBe(1);
  });
});
