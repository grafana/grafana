import { config } from '@grafana/runtime';
import { behaviors, performanceUtils } from '@grafana/scenes';

import { ReportRenderReadinessObserver } from './ReportRenderReadinessObserver';
import { SCENES_POST_STORM_WINDOW_MS } from './performanceConstants';

/**
 * Verifies the fix for blank repeat panels on the report render page (`/d-report/`).
 *
 * The image renderer waits for a single `REPORT_RENDER_COMPLETE` message, which the scenes profiler
 * used to send as soon as `SceneQueryController.runningQueriesCount()` reached 0 (after a ~2s
 * post-storm tail window). With repeat panels, the running-query count momentarily hits 0 in the gap
 * *after* the repeat variable's query completes but *before* the freshly-materialized repeat panels
 * have registered their own queries — if nothing re-registered within that 2s tail, the profiler
 * declared the dashboard done and the renderer captured a half-loaded page.
 *
 * The fix layers a second, longer grace window (`config.reportRenderQueryGracePeriodMs`, backed by
 * the `report_render_query_grace_period` ini setting) onto the observer itself: on `dashboard_view`
 * completion it doesn't trust the signal immediately. It watches the query controller directly —
 * pausing while any query is running (regardless of how long it takes) and only counting down once
 * the controller is genuinely idle — and only sends `REPORT_RENDER_COMPLETE` once that quiet window
 * elapses uninterrupted.
 *
 * This test drives the real SceneQueryController + SceneRenderProfiler + ReportRenderReadinessObserver
 * through that exact query timeline, using the controller's real `queryStarted`/`queryCompleted` API
 * so the timeline is deterministic instead of dependent on browser render timing.
 *
 * The fix is gated behind the `reportRenderQueryDebounce` feature toggle (default off) so it can be
 * enabled selectively rather than changing behavior for every report render by default.
 */

type QueryEntry = Parameters<behaviors.SceneQueryController['queryStarted']>[0];

function makeQueryEntry(type = 'data-source-request'): QueryEntry {
  return { type, origin: {}, cancel: () => {} } as unknown as QueryEntry;
}

describe('ReportRenderReadinessObserver — repeat panel render readiness', () => {
  let channel: jest.Mock;
  const originalGracePeriodMs = config.reportRenderQueryGracePeriodMs;
  const originalToggleValue = config.featureToggles.reportRenderQueryDebounce;

  beforeEach(() => {
    jest.useFakeTimers();
    // jest's fake `performance` omits the resource-timing APIs the profiler calls when capturing
    // network timing on completion. Stub them to the jsdom default (no resource entries).
    const perf = performance as unknown as {
      getEntriesByType: () => PerformanceEntry[];
      clearResourceTimings: () => void;
    };
    perf.getEntriesByType = () => [];
    perf.clearResourceTimings = () => {};
    channel = jest.fn();
    window.__grafanaImageRendererMessageChannel = channel;
    config.featureToggles.reportRenderQueryDebounce = true;
  });

  afterEach(() => {
    performanceUtils.getScenePerformanceTracker().clearObservers();
    delete (window as Record<string, unknown>).__grafanaImageRendererMessageChannel;
    config.reportRenderQueryGracePeriodMs = originalGracePeriodMs;
    config.featureToggles.reportRenderQueryDebounce = originalToggleValue;
    jest.useRealTimers();
  });

  function setupProfiledDashboard(withQueryController = true) {
    const profiler = new performanceUtils.SceneRenderProfiler();
    const queryController = new behaviors.SceneQueryController({ enableProfiling: true }, profiler);
    performanceUtils
      .getScenePerformanceTracker()
      .addObserver(new ReportRenderReadinessObserver(withQueryController ? queryController : undefined));
    queryController.startProfile('dashboard_view');
    return queryController;
  }

  it('withholds REPORT_RENDER_COMPLETE while a late-registering repeat panel query is in flight, then sends it once settled', () => {
    const queryController = setupProfiledDashboard();

    // The repeat variable's query runs and completes.
    const variableQuery = makeQueryEntry('variable');
    queryController.queryStarted(variableQuery);
    queryController.queryCompleted(variableQuery);
    expect(queryController.runningQueriesCount()).toBe(0);

    // Scenes' own post-storm tail elapses with nothing else registered — the exact gap the bug lived
    // in. The profiler declares dashboard_view complete internally, but the observer now withholds.
    jest.advanceTimersByTime(SCENES_POST_STORM_WINDOW_MS + 500);
    expect(channel).not.toHaveBeenCalled();

    // A repeat panel materializes late and registers its query, well after the profiler's own tail.
    jest.advanceTimersByTime(1000);
    const repeatPanelQuery = makeQueryEntry();
    queryController.queryStarted(repeatPanelQuery);

    // The grace timer is paused for as long as the query runs, no matter how long that takes.
    jest.advanceTimersByTime(config.reportRenderQueryGracePeriodMs + 2000);
    expect(channel).not.toHaveBeenCalled();

    queryController.queryCompleted(repeatPanelQuery);

    // Completion doesn't fire the instant the query finishes either — a fresh quiet window must
    // elapse in case another panel is about to register.
    expect(channel).not.toHaveBeenCalled();
    jest.advanceTimersByTime(config.reportRenderQueryGracePeriodMs - 100);
    expect(channel).not.toHaveBeenCalled();

    jest.advanceTimersByTime(200);
    expect(channel).toHaveBeenCalledWith(JSON.stringify({ type: 'REPORT_RENDER_COMPLETE', data: { success: true } }));

    // The settling guard should now be off — a further query cycle and grace window must not
    // produce a second send.
    const lateQuery = makeQueryEntry();
    queryController.queryStarted(lateQuery);
    queryController.queryCompleted(lateQuery);
    jest.advanceTimersByTime(config.reportRenderQueryGracePeriodMs + 500);
    expect(channel).toHaveBeenCalledTimes(1);
  });

  it('still completes a genuinely idle report once the grace window elapses with nothing further registering', () => {
    const queryController = setupProfiledDashboard();

    const variableQuery = makeQueryEntry('variable');
    queryController.queryStarted(variableQuery);
    queryController.queryCompleted(variableQuery);

    jest.advanceTimersByTime(SCENES_POST_STORM_WINDOW_MS + 500);
    expect(channel).not.toHaveBeenCalled();

    jest.advanceTimersByTime(config.reportRenderQueryGracePeriodMs);
    expect(channel).toHaveBeenCalledWith(JSON.stringify({ type: 'REPORT_RENDER_COMPLETE', data: { success: true } }));
  });

  it('honors a configured grace period instead of a hardcoded one', () => {
    config.reportRenderQueryGracePeriodMs = 500;
    const queryController = setupProfiledDashboard();

    const variableQuery = makeQueryEntry('variable');
    queryController.queryStarted(variableQuery);
    queryController.queryCompleted(variableQuery);

    jest.advanceTimersByTime(SCENES_POST_STORM_WINDOW_MS + 500);
    expect(channel).not.toHaveBeenCalled();

    // Would still be pending at this point under the 3s default, but the configured 500ms grace
    // period has already elapsed.
    jest.advanceTimersByTime(500);
    expect(channel).toHaveBeenCalledWith(JSON.stringify({ type: 'REPORT_RENDER_COMPLETE', data: { success: true } }));
  });

  it('sends REPORT_RENDER_COMPLETE immediately when constructed without a query controller, even with the toggle on', () => {
    const queryController = setupProfiledDashboard(false);

    // With no query controller to debounce against, the observer falls back to sending as soon as
    // the profiler's own dashboard_view completion fires — the branch a controller-less load
    // relies on to avoid hanging the renderer.
    const variableQuery = makeQueryEntry('variable');
    queryController.queryStarted(variableQuery);
    queryController.queryCompleted(variableQuery);
    jest.advanceTimersByTime(SCENES_POST_STORM_WINDOW_MS + 500);

    expect(channel).toHaveBeenCalledWith(JSON.stringify({ type: 'REPORT_RENDER_COMPLETE', data: { success: true } }));
  });

  it('only runs the debounce logic when reportRenderQueryDebounce is enabled — reproduces the original bug when it is off', () => {
    config.featureToggles.reportRenderQueryDebounce = false;
    const queryController = setupProfiledDashboard();

    // Same race as the other tests: the repeat variable's query completes, and nothing else has
    // registered a query yet.
    const variableQuery = makeQueryEntry('variable');
    queryController.queryStarted(variableQuery);
    queryController.queryCompleted(variableQuery);
    expect(queryController.runningQueriesCount()).toBe(0);

    jest.advanceTimersByTime(SCENES_POST_STORM_WINDOW_MS + 500);

    // With the toggle off, the observer never subscribes to the query controller at all — it sends
    // the moment the profiler's own (racy) signal fires, exactly like the pre-fix behavior.
    expect(channel).toHaveBeenCalledWith(JSON.stringify({ type: 'REPORT_RENDER_COMPLETE', data: { success: true } }));
  });
});
