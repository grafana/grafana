import { detectDashboardChanges } from './DetectChangesWorker';
import { type DashboardChangesRequest } from './shared';

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

  it('does not treat a rendered plugin version as a dashboard edit', () => {
    const initial = {
      title: 'Dash',
      schemaVersion: 30,
      panels: [{ id: 1, type: 'timeseries', title: 'CPU', pluginVersion: '9.4.0' }],
    };
    const rendered = {
      ...initial,
      panels: [{ id: 1, type: 'timeseries', title: 'CPU', pluginVersion: '13.4.0' }],
    };
    const edited = {
      ...initial,
      panels: [{ id: 1, type: 'timeseries', title: 'Memory', pluginVersion: '13.4.0' }],
    };

    expect(detectDashboardChanges(initial, rendered).hasChanges).toBe(false);
    expect(detectDashboardChanges(initial, edited).hasChanges).toBe(true);
  });
});
