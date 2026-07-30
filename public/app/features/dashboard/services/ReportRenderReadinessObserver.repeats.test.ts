import { of } from 'rxjs';

import { getDefaultTimeRange } from '@grafana/data';
import {
  behaviors,
  ConstantVariable,
  performanceUtils,
  sceneGraph,
  SceneGridLayout,
  SceneGridRow,
  SceneObjectBase,
  SceneVariableSet,
  TestVariable,
  VizPanel,
  type MultiValueVariable,
  type SceneDataProvider,
  type SceneDataProviderResult,
  type SceneDataState,
  type SceneQueryControllerEntry,
  type SceneVariable,
} from '@grafana/scenes';
import { LoadingState } from '@grafana/schema';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { AutoGridItem } from 'app/features/dashboard-scene/scene/layout-auto-grid/AutoGridItem';
import { AutoGridLayout } from 'app/features/dashboard-scene/scene/layout-auto-grid/AutoGridLayout';
import { AutoGridLayoutManager } from 'app/features/dashboard-scene/scene/layout-auto-grid/AutoGridLayoutManager';
import { DashboardGridItem } from 'app/features/dashboard-scene/scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from 'app/features/dashboard-scene/scene/layout-default/DefaultGridLayoutManager';
import { RowRepeaterBehavior } from 'app/features/dashboard-scene/scene/layout-default/RowRepeaterBehavior';
import { RowItem } from 'app/features/dashboard-scene/scene/layout-rows/RowItem';
import { performRowRepeats } from 'app/features/dashboard-scene/scene/layout-rows/RowItemRepeater';
import { RowsLayoutManager } from 'app/features/dashboard-scene/scene/layout-rows/RowsLayoutManager';
import { TabItem } from 'app/features/dashboard-scene/scene/layout-tabs/TabItem';
import { performTabRepeats } from 'app/features/dashboard-scene/scene/layout-tabs/TabItemRepeater';
import { TabsLayoutManager } from 'app/features/dashboard-scene/scene/layout-tabs/TabsLayoutManager';
import { activateFullSceneTree } from 'app/features/dashboard-scene/utils/test-utils';

import {
  ReportRenderReadinessObserver,
  SETTLE_MAX_WAIT_MS,
  SETTLE_POLL_INTERVAL_MS,
} from './ReportRenderReadinessObserver';

const POST_STORM_WINDOW = 2000; // keep in sync with @grafana/scenes

// VizPanel activation loads its panel plugin through the runtime registry, which is
// only populated in a running Grafana instance. Serve a fake plugin from cache.
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getPluginImportUtils: () => ({
    getPanelPluginFromCache: () => {
      const { getPanelPlugin } = jest.requireActual('@grafana/data/test');
      return getPanelPlugin({ id: 'timeseries' });
    },
  }),
}));

/**
 * Stands in for SceneQueryRunner. Data stays `undefined` (panel not settled) until the
 * test explicitly runs the query — the equivalent of React mounting the panel.
 */
class FakePanelDataProvider extends SceneObjectBase<SceneDataState> implements SceneDataProvider {
  #entry: SceneQueryControllerEntry | undefined;

  public constructor() {
    super({ data: undefined });
  }

  public startQuery() {
    this.#entry = { type: 'data', origin: this, cancel: () => {} };
    sceneGraph.getQueryController(this)?.queryStarted(this.#entry);
  }

  public completeQuery() {
    this.setState({ data: { state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() } });
    if (this.#entry) {
      sceneGraph.getQueryController(this)?.queryCompleted(this.#entry);
    }
  }

  public getResultsStream() {
    return of<SceneDataProviderResult>({ origin: this, data: this.state.data! });
  }
}

/**
 * Builds a profiled DashboardScene with a single panel that repeats by the given variable.
 * The variable and the panel query are both under manual test control:
 * `variable.signalUpdateCompleted()` finishes the default variable's update, and
 * `sourceDataProvider.startQuery()` / `completeQuery()` simulate the panel query lifecycle.
 */
function buildRepeatDashboard<T extends SceneVariable = TestVariable>(variable?: T) {
  // Default: a real repeat variable that registers a 'variable' entry with the
  // controller while loading, completing only when signalUpdateCompleted() is called.
  const repeatVariable =
    variable ??
    new TestVariable({
      name: 'metric',
      query: '',
      optionsToReturn: [
        { label: 'a', value: 'a' },
        { label: 'b', value: 'b' },
      ],
      isMulti: true,
      includeAll: true,
      value: ['$__all'],
      text: ['All'],
    });

  const sourceDataProvider = new FakePanelDataProvider();
  const panel = new VizPanel({ key: 'panel-1', pluginId: 'timeseries', $data: sourceDataProvider });
  const gridItem = new DashboardGridItem({ variableName: 'metric', body: panel, x: 0, y: 0, width: 24, height: 8 });

  const profiler = new performanceUtils.SceneRenderProfiler();
  const queryController = new behaviors.SceneQueryController({ enableProfiling: true }, profiler);

  const dashboard = new DashboardScene({
    $variables: new SceneVariableSet({ variables: [repeatVariable] }),
    $behaviors: [queryController],
    body: new DefaultGridLayoutManager({ grid: new SceneGridLayout({ children: [gridItem] }) }),
  });

  return { dashboard, gridItem, variable: repeatVariable, sourceDataProvider, queryController };
}

/**
 * Builds a profiled DashboardScene using the rows layout: a single RowItem repeating by
 * the default variable, containing one panel. Unlike DashboardGridItem, whose repeats run
 * from an activation handler, RowItem repeats run from its React renderer (RowItemRepeater) —
 * tests simulate that render by calling `performRowRepeats(variable, row, false)` manually.
 *
 * Pass `repeatByVariable` / `variables` to cover missing-target cases (renderer never
 * mounts RowItemRepeater unless lookup finds a MultiValueVariable).
 */
function buildRowRepeatDashboard(options?: { repeatByVariable?: string; variables?: SceneVariable[] }) {
  // A real repeat variable that registers a 'variable' entry with the controller
  // while loading, completing only when signalUpdateCompleted() is called.
  const repeatVariable = new TestVariable({
    name: 'metric',
    query: '',
    optionsToReturn: [
      { label: 'a', value: 'a' },
      { label: 'b', value: 'b' },
    ],
    isMulti: true,
    includeAll: true,
    value: ['$__all'],
    text: ['All'],
  });

  const sourceDataProvider = new FakePanelDataProvider();
  const panel = new VizPanel({ key: 'panel-1', pluginId: 'timeseries', $data: sourceDataProvider });
  const row = new RowItem({
    key: 'row-1',
    title: 'Row $metric',
    repeatByVariable: options?.repeatByVariable ?? 'metric',
    layout: new AutoGridLayoutManager({
      layout: new AutoGridLayout({ children: [new AutoGridItem({ body: panel })] }),
    }),
  });

  const profiler = new performanceUtils.SceneRenderProfiler();
  const queryController = new behaviors.SceneQueryController({ enableProfiling: true }, profiler);

  const dashboard = new DashboardScene({
    $variables: new SceneVariableSet({ variables: options?.variables ?? [repeatVariable] }),
    $behaviors: [queryController],
    body: new RowsLayoutManager({ rows: [row] }),
  });

  return { dashboard, row, variable: repeatVariable, sourceDataProvider, queryController };
}

/**
 * Builds a profiled DashboardScene using the default grid: a SceneGridRow with
 * RowRepeaterBehavior (the V1 / report-route path). Unlike RowItem, clones are inserted
 * into the SceneGridLayout as siblings with `repeatSourceKey` when the variable completes.
 */
function buildDefaultGridRowRepeatDashboard() {
  const repeatVariable = new TestVariable({
    name: 'metric',
    query: '',
    optionsToReturn: [
      { label: 'a', value: 'a' },
      { label: 'b', value: 'b' },
    ],
    isMulti: true,
    includeAll: true,
    value: ['$__all'],
    text: ['All'],
  });

  const sourceDataProvider = new FakePanelDataProvider();
  const panel = new VizPanel({ key: 'panel-1', pluginId: 'timeseries', $data: sourceDataProvider });
  const gridItem = new DashboardGridItem({ body: panel, x: 0, y: 1, width: 24, height: 8 });
  const row = new SceneGridRow({
    key: 'row-1',
    title: 'Row $metric',
    children: [gridItem],
    $behaviors: [new RowRepeaterBehavior({ variableName: 'metric' })],
  });

  const profiler = new performanceUtils.SceneRenderProfiler();
  const queryController = new behaviors.SceneQueryController({ enableProfiling: true }, profiler);

  const dashboard = new DashboardScene({
    $variables: new SceneVariableSet({ variables: [repeatVariable] }),
    $behaviors: [queryController],
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({ children: [row] }),
    }),
  });

  return { dashboard, row, variable: repeatVariable, sourceDataProvider, queryController };
}

/**
 * Builds a profiled DashboardScene using the tabs layout: a single TabItem repeating by
 * the default variable, containing one panel. Like RowItem, TabItem repeats run from its
 * React renderer (TabItemRepeater) — tests simulate that render by calling
 * `performTabRepeats(variable, tab, false)` manually.
 */
function buildTabRepeatDashboard() {
  // A real repeat variable that registers a 'variable' entry with the controller
  // while loading, completing only when signalUpdateCompleted() is called.
  const repeatVariable = new TestVariable({
    name: 'metric',
    query: '',
    optionsToReturn: [
      { label: 'a', value: 'a' },
      { label: 'b', value: 'b' },
    ],
    isMulti: true,
    includeAll: true,
    value: ['$__all'],
    text: ['All'],
  });

  const sourceDataProvider = new FakePanelDataProvider();
  const panel = new VizPanel({ key: 'panel-1', pluginId: 'timeseries', $data: sourceDataProvider });
  const tab = new TabItem({
    key: 'tab-1',
    title: 'Tab $metric',
    repeatByVariable: 'metric',
    layout: new AutoGridLayoutManager({
      layout: new AutoGridLayout({ children: [new AutoGridItem({ body: panel })] }),
    }),
  });

  const profiler = new performanceUtils.SceneRenderProfiler();
  const queryController = new behaviors.SceneQueryController({ enableProfiling: true }, profiler);

  const dashboard = new DashboardScene({
    $variables: new SceneVariableSet({ variables: [repeatVariable] }),
    $behaviors: [queryController],
    body: new TabsLayoutManager({ tabs: [tab] }),
  });

  return { dashboard, tab, variable: repeatVariable, sourceDataProvider, queryController };
}

describe('ReportRenderReadinessObserver — integration with a repeat dashboard', () => {
  let imageRendererMessageChannel: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    // jest's fake performance lacks resource-timing APIs the profiler uses on completion
    const perf = performance as unknown as Record<string, unknown>;
    perf.getEntriesByType = () => [];
    perf.clearResourceTimings = () => {};
    imageRendererMessageChannel = jest.fn();
    window.__grafanaImageRendererMessageChannel = imageRendererMessageChannel;
    window.__grafanaRunningQueryCount = 0;
  });

  afterEach(() => {
    performanceUtils.getScenePerformanceTracker().clearObservers();
    delete (window as Record<string, unknown>).__grafanaImageRendererMessageChannel;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('repeated panels', () => {
    test('withholds REPORT_RENDER_COMPLETE until the repeat panels have real data', () => {
      const { dashboard, gridItem, variable, sourceDataProvider, queryController } = buildRepeatDashboard();

      const observer = new ReportRenderReadinessObserver();
      observer.setScene(dashboard);
      performanceUtils.getScenePerformanceTracker().addObserver(observer);

      // Activation kicks off the variable update; performRepeat early-returns (variable loading).
      activateFullSceneTree(dashboard);
      queryController.startProfile('dashboard_view');
      expect(queryController.runningQueriesCount()).toBe(1); // the variable
      expect(gridItem.state.repeatedPanels).toBeUndefined();

      // The variable completes → count hits 0 → performRepeat creates clones, but nothing
      // has "mounted" them: no panel queries registered. This is the race window, held open.
      variable.signalUpdateCompleted();
      expect(queryController.runningQueriesCount()).toBe(0);
      expect(gridItem.state.repeatedPanels).toHaveLength(1); // 'a' reuses body, 'b' is the clone

      // Profiler tail elapses and dashboard_view completes prematurely…
      jest.advanceTimersByTime(POST_STORM_WINDOW + 500);

      // Observer withholds REPORT_RENDER_COMPLETE: the source panel has no data yet
      expect(imageRendererMessageChannel).not.toHaveBeenCalled();

      // "React mounts the source panel": its query registers and completes.
      sourceDataProvider.startQuery();
      expect(window.__grafanaRunningQueryCount).toBe(1);
      sourceDataProvider.completeQuery();

      // The clone still has no data — settlement must keep being withheld.
      jest.advanceTimersByTime(SETTLE_POLL_INTERVAL_MS + 50);
      expect(imageRendererMessageChannel).not.toHaveBeenCalled();

      // The clone mounts too: its own (cloned) provider completes.
      const clonePanel = gridItem.state.repeatedPanels![0];
      const cloneDataProvider = sceneGraph.getData(clonePanel) as FakePanelDataProvider;
      cloneDataProvider.startQuery();
      cloneDataProvider.completeQuery();

      // Next settlement poll sends the message exactly once.
      jest.advanceTimersByTime(SETTLE_POLL_INTERVAL_MS + 50);
      expect(imageRendererMessageChannel).toHaveBeenCalledTimes(1);
      expect(imageRendererMessageChannel).toHaveBeenCalledWith(
        JSON.stringify({ type: 'REPORT_RENDER_COMPLETE', data: { success: true } })
      );
    });

    test('sends a best-effort REPORT_RENDER_COMPLETE at the deadline when a repeat clone never settles', () => {
      const { dashboard, gridItem, variable, sourceDataProvider, queryController } = buildRepeatDashboard();

      const observer = new ReportRenderReadinessObserver();
      observer.setScene(dashboard);
      performanceUtils.getScenePerformanceTracker().addObserver(observer);

      activateFullSceneTree(dashboard);
      queryController.startProfile('dashboard_view');

      // Variable completes and the source panel loads, but the clone is stuck:
      // it never "mounts", so its data provider never produces data.
      variable.signalUpdateCompleted();
      sourceDataProvider.startQuery();
      sourceDataProvider.completeQuery();

      // dashboard_view completes after the profiler tail; the deadline countdown
      // starts here. Settlement is withheld because the clone has no data.
      jest.advanceTimersByTime(POST_STORM_WINDOW + 500);
      expect(imageRendererMessageChannel).not.toHaveBeenCalled();

      // Polling keeps withholding the message for (almost) the full deadline window.
      // Stay 1s short of SETTLE_MAX_WAIT: the countdown started up to 500ms into the
      // previous advance, so anywhere in its last second the deadline may already fire.
      jest.advanceTimersByTime(SETTLE_MAX_WAIT_MS - 1000);
      expect(imageRendererMessageChannel).not.toHaveBeenCalled();

      // The deadline elapses → best-effort send: the report captures whatever has
      // loaded instead of stalling until the renderer's own (fatal) readiness timeout.
      jest.advanceTimersByTime(1500 + SETTLE_POLL_INTERVAL_MS + 50); // remaining window + poll
      expect(imageRendererMessageChannel).toHaveBeenCalledTimes(1);
      expect(imageRendererMessageChannel).toHaveBeenCalledWith(
        JSON.stringify({ type: 'REPORT_RENDER_COMPLETE', data: { success: true } })
      );

      // The clone is still unsettled — the send was the deadline safety valve, and
      // polling stopped with it: nothing fires again afterwards.
      const clonePanel = gridItem.state.repeatedPanels![0];
      expect(sceneGraph.getData(clonePanel).state.data).toBeUndefined();
      jest.advanceTimersByTime(1000);
      expect(imageRendererMessageChannel).toHaveBeenCalledTimes(1);
    });

    test('does not wait for panels that never mount (solo panel render)', () => {
      const { dashboard, gridItem, variable, sourceDataProvider, queryController } = buildRepeatDashboard();

      const observer = new ReportRenderReadinessObserver();
      observer.setScene(dashboard);
      performanceUtils.getScenePerformanceTracker().addObserver(observer);

      // Only the dashboard root activates ($variables, behaviors). The body layout is
      // never mounted — the d-solo page renders a single panel outside the dashboard body,
      // so the grid item stays inactive and never creates its repeat clones.
      dashboard.activate();
      const soloPanel = gridItem.state.body;
      soloPanel.activate();

      queryController.startProfile('dashboard_view');
      sourceDataProvider.startQuery();
      sourceDataProvider.completeQuery();
      variable.signalUpdateCompleted();
      expect(queryController.runningQueriesCount()).toBe(0);
      expect(gridItem.isActive).toBe(false);
      expect(gridItem.state.repeatedPanels).toBeUndefined();

      // dashboard_view completes after the profiler tail. The inactive repeater and its
      // unmounted panel must not block settlement: the message goes out on the first
      // check instead of stalling until the 20s deadline.
      jest.advanceTimersByTime(POST_STORM_WINDOW + 500);
      expect(imageRendererMessageChannel).toHaveBeenCalledTimes(1);
      expect(imageRendererMessageChannel).toHaveBeenCalledWith(
        JSON.stringify({ type: 'REPORT_RENDER_COMPLETE', data: { success: true } })
      );
    });

    test('does not wait for a repeater whose variable can never repeat (non-multi-value)', () => {
      // performRepeat() refuses non-multi-value variables with a console.error and an
      // early return, so repeatedPanels stays undefined forever.
      jest.spyOn(console, 'error').mockImplementation(() => {});

      const { dashboard, gridItem, sourceDataProvider, queryController } = buildRepeatDashboard(
        new ConstantVariable({ name: 'metric', value: 'a' })
      );

      const observer = new ReportRenderReadinessObserver();
      observer.setScene(dashboard);
      performanceUtils.getScenePerformanceTracker().addObserver(observer);

      activateFullSceneTree(dashboard);
      queryController.startProfile('dashboard_view');
      sourceDataProvider.startQuery();
      sourceDataProvider.completeQuery();

      // The repeater is active but permanently refuses to create clones.
      expect(gridItem.isActive).toBe(true);
      expect(gridItem.state.repeatedPanels).toBeUndefined();

      // dashboard_view completes after the profiler tail. The unrepeatable repeater must
      // not block settlement: the message goes out on the first check, not at the deadline.
      jest.advanceTimersByTime(POST_STORM_WINDOW + 500);
      expect(imageRendererMessageChannel).toHaveBeenCalledTimes(1);
      expect(imageRendererMessageChannel).toHaveBeenCalledWith(
        JSON.stringify({ type: 'REPORT_RENDER_COMPLETE', data: { success: true } })
      );
    });
  });

  describe('repeated rows', () => {
    test('does not wait when repeatByVariable target is missing', () => {
      // RowsLayoutManagerRenderer only mounts RowItemRepeater for a MultiValueVariable.
      // A missing target leaves repeatedRows undefined forever — must not stall 20s.
      const { dashboard, row, sourceDataProvider, queryController } = buildRowRepeatDashboard({
        repeatByVariable: 'does-not-exist',
        variables: [],
      });

      const observer = new ReportRenderReadinessObserver();
      observer.setScene(dashboard);
      performanceUtils.getScenePerformanceTracker().addObserver(observer);

      activateFullSceneTree(dashboard);
      queryController.startProfile('dashboard_view');
      sourceDataProvider.startQuery();
      sourceDataProvider.completeQuery();

      expect(row.isActive).toBe(true);
      expect(row.state.repeatByVariable).toBe('does-not-exist');
      expect(sceneGraph.lookupVariable('does-not-exist', row)).toBeNull();
      expect(row.state.repeatedRows).toBeUndefined();

      // dashboard_view completes after the profiler tail. Settlement must succeed on the
      // first check instead of waiting until SETTLE_MAX_WAIT_MS.
      jest.advanceTimersByTime(POST_STORM_WINDOW + 500);
      expect(imageRendererMessageChannel).toHaveBeenCalledTimes(1);
      expect(imageRendererMessageChannel).toHaveBeenCalledWith(
        JSON.stringify({ type: 'REPORT_RENDER_COMPLETE', data: { success: true } })
      );
    });

    test('withholds REPORT_RENDER_COMPLETE until repeated rows exist and their panels have data', () => {
      const { dashboard, row, variable, sourceDataProvider, queryController } = buildRowRepeatDashboard();

      const observer = new ReportRenderReadinessObserver();
      observer.setScene(dashboard);
      performanceUtils.getScenePerformanceTracker().addObserver(observer);

      activateFullSceneTree(dashboard);
      queryController.startProfile('dashboard_view');

      // The variable completes and the source panel loads, but RowItem repeats only run
      // from its React renderer — nothing has rendered the row yet, so repeatedRows stays
      // undefined. This is the pending-repeat window (#hasPendingRepeat's repeatByVariable branch).
      variable.signalUpdateCompleted();
      sourceDataProvider.startQuery();
      sourceDataProvider.completeQuery();
      expect(row.state.repeatedRows).toBeUndefined();

      // dashboard_view completes after the profiler tail. The observer sees the active
      // row repeater with no clones yet and withholds the message.
      jest.advanceTimersByTime(POST_STORM_WINDOW + 500);
      expect(imageRendererMessageChannel).not.toHaveBeenCalled();

      // "React renders the repeater": clones are created ('a' reuses the source row,
      // 'b' is the clone) but React has NOT mounted them yet — repeatedRows is set
      // while the clone row is still inactive.
      performRowRepeats(variable as unknown as MultiValueVariable, row, false);
      expect(row.state.repeatedRows).toHaveLength(1);
      const cloneRow = row.state.repeatedRows![0];
      expect(cloneRow.isActive).toBe(false);

      // A settlement poll fires inside this window. WITHOUT the fix the clone panel
      // is filtered out of the per-panel check (inactive parent grid item) and the
      // message is sent prematurely — this assertion FAILS. WITH the fix, the
      // not-yet-active clone keeps the repeater pending.
      jest.advanceTimersByTime(SETTLE_POLL_INTERVAL_MS + 50);
      expect(imageRendererMessageChannel).not.toHaveBeenCalled();

      // The clone row mounts, but its cloned panel provider has produced no data
      // yet, so the per-panel check keeps withholding settlement.
      activateFullSceneTree(cloneRow);
      jest.advanceTimersByTime(SETTLE_POLL_INTERVAL_MS + 50);
      expect(imageRendererMessageChannel).not.toHaveBeenCalled();

      // The clone panel's own (cloned) provider completes.
      const clonePanel = sceneGraph.findAllObjects(cloneRow, (obj) => obj instanceof VizPanel)[0];
      const cloneDataProvider = sceneGraph.getData(clonePanel) as FakePanelDataProvider;
      cloneDataProvider.startQuery();
      cloneDataProvider.completeQuery();

      // Next settlement poll sends the message exactly once.
      jest.advanceTimersByTime(SETTLE_POLL_INTERVAL_MS + 50);
      expect(imageRendererMessageChannel).toHaveBeenCalledTimes(1);
      expect(imageRendererMessageChannel).toHaveBeenCalledWith(
        JSON.stringify({ type: 'REPORT_RENDER_COMPLETE', data: { success: true } })
      );
    });
  });

  describe('repeated rows (default grid / RowRepeaterBehavior)', () => {
    test('withholds REPORT_RENDER_COMPLETE until clone rows mount and their panels have data', () => {
      const { dashboard, row, variable, sourceDataProvider, queryController } = buildDefaultGridRowRepeatDashboard();

      const observer = new ReportRenderReadinessObserver();
      observer.setScene(dashboard);
      performanceUtils.getScenePerformanceTracker().addObserver(observer);

      // Activation kicks off the variable update; performRepeat early-returns (variable loading).
      activateFullSceneTree(dashboard);
      queryController.startProfile('dashboard_view');

      // The variable completes → RowRepeaterBehavior.performRepeat inserts clone rows into
      // the layout (with repeatSourceKey). React has NOT mounted them yet — clones stay
      // inactive. This is the race window the report path hits (reports force V1 layout).
      variable.signalUpdateCompleted();
      sourceDataProvider.startQuery();
      sourceDataProvider.completeQuery();

      const layout = row.parent as SceneGridLayout;
      const cloneRow = layout.state.children.find(
        (child): child is SceneGridRow => child instanceof SceneGridRow && child.state.repeatSourceKey === row.state.key
      );
      expect(cloneRow).toBeDefined();
      expect(cloneRow!.isActive).toBe(false);

      // dashboard_view completes after the profiler tail. WITHOUT the fix the inactive
      // clone panels are filtered out of the per-panel check and the message is sent
      // prematurely — this assertion FAILS. WITH the fix, the not-yet-active clone row
      // (repeatSourceKey under an active layout) keeps settlement pending.
      jest.advanceTimersByTime(POST_STORM_WINDOW + 500);
      expect(imageRendererMessageChannel).not.toHaveBeenCalled();

      // The clone row mounts, but its cloned panel provider has produced no data
      // yet, so the per-panel check keeps withholding settlement.
      activateFullSceneTree(cloneRow!);
      jest.advanceTimersByTime(SETTLE_POLL_INTERVAL_MS + 50);
      expect(imageRendererMessageChannel).not.toHaveBeenCalled();

      // The clone panel's own (cloned) provider completes.
      const clonePanel = sceneGraph.findAllObjects(cloneRow!, (obj) => obj instanceof VizPanel)[0];
      const cloneDataProvider = sceneGraph.getData(clonePanel) as FakePanelDataProvider;
      cloneDataProvider.startQuery();
      cloneDataProvider.completeQuery();

      // Next settlement poll sends the message exactly once.
      jest.advanceTimersByTime(SETTLE_POLL_INTERVAL_MS + 50);
      expect(imageRendererMessageChannel).toHaveBeenCalledTimes(1);
      expect(imageRendererMessageChannel).toHaveBeenCalledWith(
        JSON.stringify({ type: 'REPORT_RENDER_COMPLETE', data: { success: true } })
      );
    });
  });

  describe('repeated tabs', () => {
    test('withholds REPORT_RENDER_COMPLETE until repeated tabs exist and their panels have data', () => {
      const { dashboard, tab, variable, sourceDataProvider, queryController } = buildTabRepeatDashboard();

      const observer = new ReportRenderReadinessObserver();
      observer.setScene(dashboard);
      performanceUtils.getScenePerformanceTracker().addObserver(observer);

      activateFullSceneTree(dashboard);
      queryController.startProfile('dashboard_view');

      // The variable completes and the source panel loads, but TabItem repeats only run
      // from its React renderer — nothing has rendered the tab yet, so repeatedTabs stays
      // undefined. This is the pending-repeat window (#hasPendingRepeat's repeatByVariable branch).
      variable.signalUpdateCompleted();
      sourceDataProvider.startQuery();
      sourceDataProvider.completeQuery();
      expect(tab.state.repeatedTabs).toBeUndefined();

      // dashboard_view completes after the profiler tail. The observer sees the active
      // tab repeater with no clones yet and withholds the message.
      jest.advanceTimersByTime(POST_STORM_WINDOW + 500);
      expect(imageRendererMessageChannel).not.toHaveBeenCalled();

      // "React renders the repeater": clones are created ('a' reuses the source tab,
      // 'b' is the clone) but React has NOT mounted them yet — repeatedTabs is set
      // while the clone tab is still inactive.
      performTabRepeats(variable as unknown as MultiValueVariable, tab, false);
      expect(tab.state.repeatedTabs).toHaveLength(1);
      const cloneTab = tab.state.repeatedTabs![0];
      expect(cloneTab.isActive).toBe(false);

      // A settlement poll fires inside this window. WITHOUT the fix the clone panel
      // is filtered out of the per-panel check (inactive parent grid item) and the
      // message is sent prematurely — this assertion FAILS. WITH the fix, the
      // not-yet-active clone keeps the repeater pending.
      jest.advanceTimersByTime(SETTLE_POLL_INTERVAL_MS + 50);
      expect(imageRendererMessageChannel).not.toHaveBeenCalled();

      // The clone tab mounts, but its cloned panel provider has produced no data
      // yet, so the per-panel check keeps withholding settlement.
      activateFullSceneTree(cloneTab);
      jest.advanceTimersByTime(SETTLE_POLL_INTERVAL_MS + 50);
      expect(imageRendererMessageChannel).not.toHaveBeenCalled();

      // The clone panel's own (cloned) provider completes.
      const clonePanel = sceneGraph.findAllObjects(cloneTab, (obj) => obj instanceof VizPanel)[0];
      const cloneDataProvider = sceneGraph.getData(clonePanel) as FakePanelDataProvider;
      cloneDataProvider.startQuery();
      cloneDataProvider.completeQuery();

      // Next settlement poll sends the message exactly once.
      jest.advanceTimersByTime(SETTLE_POLL_INTERVAL_MS + 50);
      expect(imageRendererMessageChannel).toHaveBeenCalledTimes(1);
      expect(imageRendererMessageChannel).toHaveBeenCalledWith(
        JSON.stringify({ type: 'REPORT_RENDER_COMPLETE', data: { success: true } })
      );
    });
  });
});
