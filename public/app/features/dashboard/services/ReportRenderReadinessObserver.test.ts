import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { type MultiValueVariable, performanceUtils, SceneVariableSet, TestVariable, VizPanel } from '@grafana/scenes';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { AutoGridLayoutManager } from 'app/features/dashboard-scene/scene/layout-auto-grid/AutoGridLayoutManager';
import { DefaultGridLayoutManager } from 'app/features/dashboard-scene/scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from 'app/features/dashboard-scene/scene/layout-rows/RowItem';
import { performRowRepeats } from 'app/features/dashboard-scene/scene/layout-rows/RowItemRepeater';
import { RowsLayoutManager } from 'app/features/dashboard-scene/scene/layout-rows/RowsLayoutManager';
import { activateFullSceneTree } from 'app/features/dashboard-scene/utils/test-utils';

import {
  ReportRenderReadinessObserver,
  initializeReportRenderReadinessObserver,
} from './ReportRenderReadinessObserver';

const attachProfilerToPanel = jest.fn();

jest.mock('./DashboardProfiler', () => ({
  getDashboardSceneProfiler: () => ({ attachProfilerToPanel }),
}));

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

const dashboardViewComplete = {
  operationId: 'dashboard-view',
  interactionType: 'dashboard_view',
  timestamp: 1,
  duration: 1234,
} as performanceUtils.DashboardInteractionCompleteData;

function panelOperation(
  operationId: string,
  operation: performanceUtils.PanelPerformanceData['operation'],
  panelKey = 'panel-1'
): performanceUtils.PanelPerformanceData {
  return {
    operationId,
    operation,
    panelId: '1',
    panelKey,
    pluginId: 'text',
    timestamp: performance.now(),
    duration: 1,
    metadata: {},
  } as performanceUtils.PanelPerformanceData;
}

describe('ReportRenderReadinessObserver', () => {
  let observer: ReportRenderReadinessObserver;
  let messageChannelMock: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    attachProfilerToPanel.mockClear();
    observer = new ReportRenderReadinessObserver();
    messageChannelMock = jest.fn();
    window.__grafanaImageRendererMessageChannel = messageChannelMock;
  });

  afterEach(() => {
    observer.setDashboard(undefined);
    jest.useRealTimers();
    delete (window as Record<string, unknown>).__grafanaImageRendererMessageChannel;
  });

  it('does not signal without an associated render-target dashboard', () => {
    observer.onDashboardInteractionComplete!(dashboardViewComplete);
    jest.runAllTimers();

    expect(messageChannelMock).not.toHaveBeenCalled();
  });

  it('signals once when a dashboard without panels is ready', () => {
    const scene = new DashboardScene({ body: new RowsLayoutManager({ rows: [] }) });
    observer.setDashboard(scene);
    activateFullSceneTree(scene);

    observer.onDashboardInteractionComplete!(dashboardViewComplete);
    jest.runAllTimers();
    expect(messageChannelMock).toHaveBeenCalledTimes(1);

    scene.setState({ title: 'state change after completion' });
    jest.runAllTimers();
    expect(messageChannelMock).toHaveBeenCalledTimes(1);
  });

  it('waits for current repeated rows to mount', () => {
    const variable = new TestVariable({
      name: 'server',
      query: 'A.*',
      value: ['A1'],
      text: ['A'],
      isMulti: true,
      optionsToReturn: [{ label: 'A', value: 'A1' }],
    });
    const row = new RowItem({
      key: 'row-1',
      repeatByVariable: 'server',
      layout: AutoGridLayoutManager.createEmpty(),
    });
    const scene = new DashboardScene({
      $variables: new SceneVariableSet({ variables: [variable] }),
      body: new RowsLayoutManager({ rows: [row] }),
    });
    observer.setDashboard(scene);
    activateFullSceneTree(scene);
    variable.setState({ loading: false });

    observer.onDashboardInteractionComplete!(dashboardViewComplete);
    jest.runAllTimers();
    expect(messageChannelMock).not.toHaveBeenCalled();

    performRowRepeats(variable as unknown as MultiValueVariable, row, false);
    jest.runAllTimers();

    expect(messageChannelMock).toHaveBeenCalledTimes(1);
  });

  it('waits for every active panel to complete rendering', () => {
    const panel = new VizPanel({ key: 'panel-1', pluginId: 'text' });
    const scene = new DashboardScene({ body: DefaultGridLayoutManager.fromVizPanels([panel]) });
    observer.setDashboard(scene);
    activateFullSceneTree(scene);

    expect(attachProfilerToPanel).toHaveBeenCalledWith(panel);

    observer.onDashboardInteractionComplete!(dashboardViewComplete);
    jest.runAllTimers();
    expect(messageChannelMock).not.toHaveBeenCalled();

    observer.onPanelOperationStart!(panelOperation('render-1', 'render'));
    observer.onPanelOperationComplete!(panelOperation('render-1', 'render'));
    jest.runAllTimers();

    expect(messageChannelMock).toHaveBeenCalledTimes(1);
  });

  it('requires a new render after later panel work', () => {
    const panel = new VizPanel({ key: 'panel-1', pluginId: 'text' });
    const scene = new DashboardScene({ body: DefaultGridLayoutManager.fromVizPanels([panel]) });
    observer.setDashboard(scene);
    activateFullSceneTree(scene);

    observer.onPanelOperationStart!(panelOperation('render-1', 'render'));
    observer.onPanelOperationComplete!(panelOperation('render-1', 'render'));
    observer.onPanelOperationStart!(panelOperation('query-1', 'query'));
    observer.onDashboardInteractionComplete!(dashboardViewComplete);
    observer.onPanelOperationComplete!(panelOperation('query-1', 'query'));
    jest.runAllTimers();
    expect(messageChannelMock).not.toHaveBeenCalled();

    observer.onPanelOperationStart!(panelOperation('render-2', 'render'));
    observer.onPanelOperationComplete!(panelOperation('render-2', 'render'));
    jest.runAllTimers();

    expect(messageChannelMock).toHaveBeenCalledTimes(1);
  });

  it('does not retain operations from panels removed by a repeat update', () => {
    const panel = new VizPanel({ key: 'panel-1', pluginId: 'text' });
    const scene = new DashboardScene({ body: DefaultGridLayoutManager.fromVizPanels([panel]) });
    observer.setDashboard(scene);
    activateFullSceneTree(scene);

    observer.onPanelOperationStart!(panelOperation('query-1', 'query'));
    scene.setState({ body: new RowsLayoutManager({ rows: [] }) });
    observer.onDashboardInteractionComplete!(dashboardViewComplete);
    jest.runAllTimers();

    expect(messageChannelMock).toHaveBeenCalledTimes(1);
  });

  it('clears pending state and subscriptions when the dashboard is detached', () => {
    const scene = new DashboardScene({ body: new RowsLayoutManager({ rows: [] }) });
    observer.setDashboard(scene);
    activateFullSceneTree(scene);
    observer.onDashboardInteractionComplete!(dashboardViewComplete);

    observer.setDashboard(undefined);
    jest.runAllTimers();

    expect(messageChannelMock).not.toHaveBeenCalled();
  });

  it('ignores non-dashboard-view interactions', () => {
    const scene = new DashboardScene({ body: new RowsLayoutManager({ rows: [] }) });
    observer.setDashboard(scene);
    activateFullSceneTree(scene);

    observer.onDashboardInteractionComplete!({
      ...dashboardViewComplete,
      interactionType: 'refresh',
    });
    jest.runAllTimers();

    expect(messageChannelMock).not.toHaveBeenCalled();
  });

  describe('initializeReportRenderReadinessObserver', () => {
    it('registers the observer with the performance tracker', () => {
      const tracker = performanceUtils.getScenePerformanceTracker();
      const addObserverSpy = jest.spyOn(tracker, 'addObserver');

      initializeReportRenderReadinessObserver();

      expect(addObserverSpy).toHaveBeenCalledWith(expect.any(ReportRenderReadinessObserver));
      addObserverSpy.mockRestore();
    });
  });
});
