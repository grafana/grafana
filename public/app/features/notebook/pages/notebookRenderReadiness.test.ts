import { LoadingState, getDefaultTimeRange } from '@grafana/data';
import {
  EmbeddedScene,
  SceneFlexItem,
  SceneFlexLayout,
  SceneQueryRunner,
  VizPanel,
  behaviors,
  type SceneQueryControllerEntry,
} from '@grafana/scenes';

import {
  NO_QUERY_GRACE_MS,
  RENDER_READY_FALLBACK_MS,
  createRenderCompleteReporter,
  watchRenderReadiness,
} from './notebookRenderReadiness';

const FRAME_MS = 20;

function buildScene(children: SceneFlexItem[] = []) {
  const controller = new behaviors.SceneQueryController();
  const scene = new EmbeddedScene({ $behaviors: [controller], body: new SceneFlexLayout({ children }) });
  const deactivate = scene.activate();

  return { scene, controller, deactivate };
}

function startQuery(controller: behaviors.SceneQueryController, scene: EmbeddedScene) {
  const entry: SceneQueryControllerEntry = { type: 'SceneQueryRunner/runQueries', origin: scene };
  controller.queryStarted(entry);

  return () => controller.queryCompleted(entry);
}

describe('watchRenderReadiness', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('is ready one frame after the queries that started have finished', () => {
    const { scene, controller } = buildScene();
    const onReady = jest.fn();
    watchRenderReadiness(scene, onReady);

    const complete = startQuery(controller, scene);
    jest.advanceTimersByTime(NO_QUERY_GRACE_MS + FRAME_MS);
    expect(onReady).not.toHaveBeenCalled();

    complete();
    expect(onReady).not.toHaveBeenCalled();
    jest.advanceTimersByTime(FRAME_MS);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('waits for queries that start while others are finishing', () => {
    const { scene, controller } = buildScene();
    const onReady = jest.fn();
    watchRenderReadiness(scene, onReady);

    const completeFirst = startQuery(controller, scene);
    completeFirst();
    const completeSecond = startQuery(controller, scene);
    jest.advanceTimersByTime(NO_QUERY_GRACE_MS + FRAME_MS);
    expect(onReady).not.toHaveBeenCalled();

    completeSecond();
    jest.advanceTimersByTime(FRAME_MS);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('is ready shortly after activation when the notebook has no queries', () => {
    const { scene } = buildScene();
    const onReady = jest.fn();
    watchRenderReadiness(scene, onReady);

    jest.advanceTimersByTime(NO_QUERY_GRACE_MS - 1);
    expect(onReady).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1 + FRAME_MS);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('keeps waiting past the grace period for a panel whose query has not reached the controller yet', () => {
    const runner = new SceneQueryRunner({ queries: [{ refId: 'A' }], runQueriesMode: 'manual' });
    const panel = new VizPanel({ pluginId: 'timeseries', $data: runner });
    const { scene, controller } = buildScene([new SceneFlexItem({ body: panel })]);
    runner.activate();
    const onReady = jest.fn();
    watchRenderReadiness(scene, onReady);

    jest.advanceTimersByTime(NO_QUERY_GRACE_MS + FRAME_MS);
    expect(onReady).not.toHaveBeenCalled();

    const complete = startQuery(controller, scene);
    runner.setState({ data: { state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() } });
    complete();
    jest.advanceTimersByTime(FRAME_MS);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('falls back to ready after the timeout when a query never finishes', () => {
    const { scene, controller } = buildScene();
    const onReady = jest.fn();
    watchRenderReadiness(scene, onReady);
    startQuery(controller, scene);

    jest.advanceTimersByTime(RENDER_READY_FALLBACK_MS - 1);
    expect(onReady).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('is ready only once, even when queries run again or the fallback elapses afterwards', () => {
    const { scene, controller } = buildScene();
    const onReady = jest.fn();
    watchRenderReadiness(scene, onReady);

    startQuery(controller, scene)();
    jest.advanceTimersByTime(FRAME_MS);
    startQuery(controller, scene)();
    jest.advanceTimersByTime(RENDER_READY_FALLBACK_MS);

    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('never fires after it has been stopped', () => {
    const { scene, controller } = buildScene();
    const onReady = jest.fn();
    const stop = watchRenderReadiness(scene, onReady);

    const complete = startQuery(controller, scene);
    stop();
    complete();
    jest.advanceTimersByTime(RENDER_READY_FALLBACK_MS);

    expect(onReady).not.toHaveBeenCalled();
  });
});

describe('createRenderCompleteReporter', () => {
  let channel: jest.Mock;

  beforeEach(() => {
    channel = jest.fn();
    window.__grafanaImageRendererMessageChannel = channel;
  });

  afterEach(() => {
    delete window.__grafanaImageRendererMessageChannel;
  });

  const sent = () => channel.mock.calls.map(([raw]) => JSON.parse(String(raw)));

  it('sends the first result over the renderer binding', () => {
    const report = createRenderCompleteReporter();

    report(true);

    expect(sent()).toEqual([{ type: 'REPORT_RENDER_COMPLETE', data: { success: true } }]);
  });

  it('sends nothing after the first result', () => {
    const report = createRenderCompleteReporter();

    report(true);
    report(true);
    report(false);

    expect(sent()).toEqual([{ type: 'REPORT_RENDER_COMPLETE', data: { success: true } }]);
  });

  it('does not report success after a failure', () => {
    const report = createRenderCompleteReporter();

    report(false);
    report(true);

    expect(sent()).toEqual([{ type: 'REPORT_RENDER_COMPLETE', data: { success: false } }]);
  });

  it('does nothing when the page is not being captured by the renderer', () => {
    delete window.__grafanaImageRendererMessageChannel;
    const report = createRenderCompleteReporter();

    expect(() => report(true)).not.toThrow();
  });
});
