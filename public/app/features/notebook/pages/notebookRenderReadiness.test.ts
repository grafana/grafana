import { LoadingState, PanelPlugin, type PanelPluginMeta, getDefaultTimeRange } from '@grafana/data';
import {
  EmbeddedScene,
  SceneFlexItem,
  SceneFlexLayout,
  SceneQueryRunner,
  VizPanel,
  behaviors,
  type SceneQueryControllerEntry,
} from '@grafana/scenes';
import { LibraryPanelBehavior } from 'app/features/dashboard-scene/scene/LibraryPanelBehavior';

import {
  RENDER_READY_FALLBACK_MS,
  RENDER_SETTLE_MS,
  createRenderCompleteReporter,
  watchRenderReadiness,
} from './notebookRenderReadiness';

function buildPlugin(id: string) {
  const plugin = new PanelPlugin(() => null);
  plugin.meta = { id } as PanelPluginMeta;

  return plugin;
}

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

  it('is ready once the queries that started have finished and the scene has settled', () => {
    const { scene, controller } = buildScene();
    const onReady = jest.fn();
    watchRenderReadiness(scene, onReady);

    const complete = startQuery(controller, scene);
    jest.advanceTimersByTime(RENDER_SETTLE_MS * 2);
    expect(onReady).not.toHaveBeenCalled();

    complete();
    jest.advanceTimersByTime(RENDER_SETTLE_MS - 1);
    expect(onReady).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('starts the settle window over when a query starts inside it', () => {
    const { scene, controller } = buildScene();
    const onReady = jest.fn();
    watchRenderReadiness(scene, onReady);

    startQuery(controller, scene)();
    jest.advanceTimersByTime(RENDER_SETTLE_MS - 1);
    const completeSecond = startQuery(controller, scene);
    jest.advanceTimersByTime(RENDER_SETTLE_MS * 2);
    expect(onReady).not.toHaveBeenCalled();

    completeSecond();
    jest.advanceTimersByTime(RENDER_SETTLE_MS);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('is ready after the settle window when the notebook has no queries', () => {
    const { scene } = buildScene();
    const onReady = jest.fn();
    watchRenderReadiness(scene, onReady);

    jest.advanceTimersByTime(RENDER_SETTLE_MS - 1);
    expect(onReady).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('keeps waiting for a panel whose query has not reached the controller yet', () => {
    const runner = new SceneQueryRunner({ queries: [{ refId: 'A' }], runQueriesMode: 'manual' });
    const panel = new VizPanel({ pluginId: 'timeseries', $data: runner });
    const { scene, controller } = buildScene([new SceneFlexItem({ body: panel })]);
    runner.activate();
    const onReady = jest.fn();
    watchRenderReadiness(scene, onReady);

    jest.advanceTimersByTime(RENDER_SETTLE_MS * 3);
    expect(onReady).not.toHaveBeenCalled();

    const complete = startQuery(controller, scene);
    runner.setState({ data: { state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() } });
    complete();
    jest.advanceTimersByTime(RENDER_SETTLE_MS);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('keeps waiting for a panel whose plugin has not loaded yet', () => {
    const panel = new VizPanel({ pluginId: 'timeseries' });
    const { scene } = buildScene([new SceneFlexItem({ body: panel })]);
    jest.spyOn(panel, 'isActive', 'get').mockReturnValue(true);
    jest.spyOn(panel, 'getPlugin').mockReturnValue(undefined);
    const onReady = jest.fn();
    watchRenderReadiness(scene, onReady);

    jest.advanceTimersByTime(RENDER_SETTLE_MS * 3);
    expect(onReady).not.toHaveBeenCalled();

    jest.spyOn(panel, 'getPlugin').mockReturnValue(buildPlugin('timeseries'));
    jest.advanceTimersByTime(RENDER_SETTLE_MS);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('keeps waiting while a loaded library panel still shows the placeholder plugin', () => {
    const behavior = new LibraryPanelBehavior({ uid: 'lp-1', name: 'Shared panel', isLoaded: true });
    const panel = new VizPanel({ pluginId: 'timeseries', $behaviors: [behavior] });
    const { scene } = buildScene([new SceneFlexItem({ body: panel })]);
    jest.spyOn(panel, 'isActive', 'get').mockReturnValue(true);
    const getPlugin = jest
      .spyOn(panel, 'getPlugin')
      .mockReturnValue(buildPlugin(LibraryPanelBehavior.LOADING_VIZ_PANEL_PLUGIN_ID));
    const onReady = jest.fn();
    watchRenderReadiness(scene, onReady);

    jest.advanceTimersByTime(RENDER_SETTLE_MS * 3);
    expect(onReady).not.toHaveBeenCalled();

    getPlugin.mockReturnValue(buildPlugin('timeseries'));
    jest.advanceTimersByTime(RENDER_SETTLE_MS);
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it('keeps waiting for a library panel whose definition has not been fetched yet', () => {
    const behavior = new LibraryPanelBehavior({ uid: 'lp-1', name: 'Shared panel' });
    const panel = new VizPanel({ pluginId: 'timeseries', $behaviors: [behavior] });
    const { scene } = buildScene([new SceneFlexItem({ body: panel })]);
    jest.spyOn(panel, 'isActive', 'get').mockReturnValue(true);
    jest.spyOn(panel, 'getPlugin').mockReturnValue(buildPlugin('timeseries'));
    const onReady = jest.fn();
    watchRenderReadiness(scene, onReady);

    jest.advanceTimersByTime(RENDER_SETTLE_MS * 3);
    expect(onReady).not.toHaveBeenCalled();

    behavior.setState({ isLoaded: true });
    jest.advanceTimersByTime(RENDER_SETTLE_MS);
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
    jest.advanceTimersByTime(RENDER_SETTLE_MS);
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
