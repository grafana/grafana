import { type DashboardChangesRequest } from './shared';

import './DetectChangesWorker';

describe('DetectChangesWorker', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('when a newer request replaces a queued check, the reply identifies the newer generation', () => {
    jest.useFakeTimers();

    const postMessage = jest.spyOn(window, 'postMessage').mockImplementation(() => {});

    const request: DashboardChangesRequest = {
      initial: { title: 'Original', schemaVersion: 30 },
      changed: { title: 'Changed', schemaVersion: 30 },
      generation: 1,
    };

    window.onmessage?.(new MessageEvent('message', { data: request }));
    window.onmessage?.(new MessageEvent('message', { data: { ...request, generation: 2 } }));
    jest.advanceTimersByTime(500);

    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ generation: 2, hasChanges: true }));
  });
});
