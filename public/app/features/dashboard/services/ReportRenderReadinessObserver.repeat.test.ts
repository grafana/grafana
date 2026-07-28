import { getDefaultTimeRange, LoadingState } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { behaviors, performanceUtils, SceneDataNode, SceneFlexItem, SceneFlexLayout, VizPanel } from '@grafana/scenes';

import { READINESS_POLL_INTERVAL_MS, ReportRenderReadinessObserver } from './ReportRenderReadinessObserver';

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

/**
 * Deterministic regression test for blank repeat panels on the report render page (`/d-report/`).
 *
 * The image renderer waits for a single `REPORT_RENDER_COMPLETE` message, which is sent when the
 * `dashboard_view` interaction completes. The scenes profiler completes that interaction as soon as
 * `SceneQueryController.runningQueriesCount()` reaches 0 (after a ~2s post-storm tail window).
 *
 * With repeat panels, the running-query count momentarily hits 0 in the gap *after* the repeat
 * variable's query completes but *before* the freshly-materialized repeat panels have registered
 * their own queries. If nothing re-registers within the tail window, the profiler declares the
 * dashboard done — which used to make the renderer capture a half-loaded page with blank repeat
 * panels.
 *
 * The fix gates the message on a scene-graph readiness check: the observer holds a reference to
 * the dashboard scene and only signals completion once every active panel holds terminal data,
 * polling until that is the case.
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
  let observer: ReportRenderReadinessObserver;

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
    observer = new ReportRenderReadinessObserver();
    performanceUtils.getScenePerformanceTracker().addObserver(observer);
  });

  afterEach(() => {
    observer.setScene(null);
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

  // Models a repeat clone right after performRepeat materialized it: mounted (active) but its
  // query has not settled yet — the state the scene is in during the racy zero-count gap.
  function buildSceneWithPendingRepeatClone() {
    const dataNode = new SceneDataNode({
      data: { state: LoadingState.Loading, series: [], timeRange: getDefaultTimeRange() },
    });
    const clone = new VizPanel({ key: 'panel-1-clone-1', pluginId: 'timeseries', $data: dataNode });
    const scene = new SceneFlexLayout({ children: [new SceneFlexItem({ body: clone })] });
    clone.activate();
    return { scene, dataNode };
  }

  it('holds REPORT_RENDER_COMPLETE during the zero-count gap and sends it once repeat panels have data', () => {
    const queryController = setupProfiledDashboard();
    const { scene, dataNode } = buildSceneWithPendingRepeatClone();
    observer.setScene(scene);

    // The repeat variable's query runs and completes.
    const variableQuery = makeQueryEntry('variable');
    queryController.queryStarted(variableQuery);
    queryController.queryCompleted(variableQuery);

    // The repeat panels have not registered their queries yet, but the count is already 0.
    expect(queryController.runningQueriesCount()).toBe(0);

    jest.advanceTimersByTime(POST_STORM_WINDOW + 500);

    // The dashboard_view interaction completed during the gap, but the observer sees the pending
    // repeat clone in the scene graph and withholds the completion message.
    expect(channel).not.toHaveBeenCalled();

    // The repeat clone's query settles; the readiness poll now signals completion.
    dataNode.setState({ data: { state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() } });
    jest.advanceTimersByTime(READINESS_POLL_INTERVAL_MS);

    expect(channel).toHaveBeenCalledTimes(1);
    expect(channel).toHaveBeenCalledWith(JSON.stringify({ type: 'REPORT_RENDER_COMPLETE', data: { success: true } }));
  });
});
