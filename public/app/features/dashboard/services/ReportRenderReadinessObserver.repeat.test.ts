import { behaviors, performanceUtils } from '@grafana/scenes';

import { ReportRenderReadinessObserver } from './ReportRenderReadinessObserver';

/**
 * Deterministic reproduction of blank repeat panels on the report render page (`/d-report/`).
 *
 * The image renderer waits for a single `REPORT_RENDER_COMPLETE` message, which is sent when the
 * `dashboard_view` interaction completes. The scenes profiler completes that interaction as soon as
 * `SceneQueryController.runningQueriesCount()` reaches 0 (after a ~2s post-storm tail window).
 *
 * With repeat panels, the running-query count momentarily hits 0 in the gap *after* the repeat
 * variable's query completes but *before* the freshly-materialized repeat panels have registered
 * their own queries. If nothing re-registers within the tail window, the profiler declares the
 * dashboard done and the renderer captures a half-loaded page — blank repeat panels.
 *
 * This test drives the real SceneQueryController + SceneRenderProfiler + ReportRenderReadinessObserver
 * through that exact query timeline. Panel/variable queries are represented via the controller's real
 * `queryStarted`/`queryCompleted` API — the same calls SceneQueryRunner and TestVariable make internally —
 * so the timeline is deterministic instead of dependent on browser render timing.
 */

// The profiler records a trailing-frame window after the running-query count reaches zero before it
// declares the interaction complete. Keep in sync with POST_STORM_WINDOW in @grafana/scenes.
const POST_STORM_WINDOW = 2000;

type QueryEntry = Parameters<behaviors.SceneQueryController['queryStarted']>[0];

function makeQueryEntry(type = 'data-source-request'): QueryEntry {
  return { type, origin: {}, cancel: () => {} } as unknown as QueryEntry;
}

describe('ReportRenderReadinessObserver — repeat panel render readiness', () => {
  let channel: jest.Mock;

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
    performanceUtils.getScenePerformanceTracker().addObserver(new ReportRenderReadinessObserver());
  });

  afterEach(() => {
    performanceUtils.getScenePerformanceTracker().clearObservers();
    delete (window as Record<string, unknown>).__grafanaImageRendererMessageChannel;
    jest.useRealTimers();
  });

  function setupProfiledDashboard() {
    const profiler = new performanceUtils.SceneRenderProfiler();
    const queryController = new behaviors.SceneQueryController({ enableProfiling: true }, profiler);
    queryController.startProfile('dashboard_view');
    return queryController;
  }

  // Deterministic reproduction of the bug (documents CURRENT, incorrect behaviour): the profiler
  // completes the dashboard_view interaction — and the renderer is told the report is done — as soon
  // as running queries hit zero, even though the repeat panels created from the just-resolved variable
  // have not registered their queries yet. This fires on every run, which is the intermittent
  // "blank repeat panels on /d-report/" bug made deterministic.
  //
  // The fix (owned by the dashboards squad) should prevent REPORT_RENDER_COMPLETE from being sent
  // during this gap; when it lands, this assertion should be inverted to `not.toHaveBeenCalled()`.
  it('reproduces premature REPORT_RENDER_COMPLETE while repeat panels still owe queries (bug)', () => {
    const queryController = setupProfiledDashboard();

    // The repeat variable's query runs and completes.
    const variableQuery = makeQueryEntry('variable');
    queryController.queryStarted(variableQuery);
    queryController.queryCompleted(variableQuery);

    // The repeat panels have not registered their queries yet, but the count is already 0.
    expect(queryController.runningQueriesCount()).toBe(0);

    jest.advanceTimersByTime(POST_STORM_WINDOW + 500);

    // BUG: render reported complete during the gap before repeat panel queries register.
    expect(channel).toHaveBeenCalledWith(JSON.stringify({ type: 'REPORT_RENDER_COMPLETE', data: { success: true } }));
  });
});
