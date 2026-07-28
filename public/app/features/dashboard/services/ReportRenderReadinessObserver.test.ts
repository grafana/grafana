import { getDefaultTimeRange, LoadingState } from '@grafana/data';
import { getPanelPlugin } from '@grafana/data/test';
import { setPluginImportUtils } from '@grafana/runtime';
import { performanceUtils, SceneDataNode, SceneFlexItem, SceneFlexLayout, VizPanel } from '@grafana/scenes';

import {
  ReportRenderReadinessObserver,
  initializeReportRenderReadinessObserver,
  getReadinessTimeoutMs,
  READINESS_POLL_INTERVAL_MS,
  READINESS_TIMEOUT_MS,
  RENDERER_BUDGET_MARGIN_MS,
} from './ReportRenderReadinessObserver';

setPluginImportUtils({
  importPanelPlugin: () => Promise.resolve(getPanelPlugin({})),
  getPanelPluginFromCache: () => undefined,
});

const EXPECTED_MESSAGE = JSON.stringify({ type: 'REPORT_RENDER_COMPLETE', data: { success: true } });

function buildSceneWithPanel(dataState: LoadingState) {
  const dataNode = new SceneDataNode({
    data: { state: dataState, series: [], timeRange: getDefaultTimeRange() },
  });
  const panel = new VizPanel({ key: 'panel-1', pluginId: 'text', $data: dataNode });
  const scene = new SceneFlexLayout({ children: [new SceneFlexItem({ body: panel })] });
  return { scene, panel, dataNode };
}

describe('ReportRenderReadinessObserver', () => {
  let observer: ReportRenderReadinessObserver;
  let messageChannelMock: jest.Mock;

  beforeEach(() => {
    observer = new ReportRenderReadinessObserver();
    messageChannelMock = jest.fn();
    window.__grafanaImageRendererMessageChannel = messageChannelMock;
  });

  afterEach(() => {
    delete (window as Record<string, unknown>).__grafanaImageRendererMessageChannel;
  });

  describe('onDashboardInteractionComplete', () => {
    it('should send REPORT_RENDER_COMPLETE message for dashboard_view interactions', () => {
      observer.onDashboardInteractionComplete!({
        interactionType: 'dashboard_view',
        duration: 1234,
      } as performanceUtils.DashboardInteractionCompleteData);

      expect(messageChannelMock).toHaveBeenCalledWith(
        JSON.stringify({ type: 'REPORT_RENDER_COMPLETE', data: { success: true } })
      );
    });

    it('should not send a message for non-dashboard_view interactions', () => {
      observer.onDashboardInteractionComplete!({
        interactionType: 'refresh',
        duration: 500,
      } as performanceUtils.DashboardInteractionCompleteData);

      expect(messageChannelMock).not.toHaveBeenCalled();
    });

    it('should not send a message when __grafanaImageRendererMessageChannel is not defined', () => {
      delete (window as Record<string, unknown>).__grafanaImageRendererMessageChannel;

      observer.onDashboardInteractionComplete!({
        interactionType: 'dashboard_view',
        duration: 1234,
      } as performanceUtils.DashboardInteractionCompleteData);

      expect(messageChannelMock).not.toHaveBeenCalled();
    });

    it('should send a message for each dashboard_view completion', () => {
      observer.onDashboardInteractionComplete!({
        interactionType: 'dashboard_view',
        duration: 1000,
      } as performanceUtils.DashboardInteractionCompleteData);
      expect(messageChannelMock).toHaveBeenCalledTimes(1);

      observer.onDashboardInteractionComplete!({
        interactionType: 'dashboard_view',
        duration: 2000,
      } as performanceUtils.DashboardInteractionCompleteData);
      expect(messageChannelMock).toHaveBeenCalledTimes(2);
      expect(messageChannelMock).toHaveBeenLastCalledWith(
        JSON.stringify({ type: 'REPORT_RENDER_COMPLETE', data: { success: true } })
      );
    });
  });

  describe('scene readiness gating', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    function completeDashboardView() {
      observer.onDashboardInteractionComplete!({
        interactionType: 'dashboard_view',
        duration: 1000,
      } as performanceUtils.DashboardInteractionCompleteData);
    }

    it('should defer the message while an active panel is still loading, and send once its data is terminal', () => {
      const { scene, panel, dataNode } = buildSceneWithPanel(LoadingState.Loading);
      panel.activate();
      observer.setScene(scene);

      completeDashboardView();
      expect(messageChannelMock).not.toHaveBeenCalled();

      jest.advanceTimersByTime(READINESS_POLL_INTERVAL_MS * 2);
      expect(messageChannelMock).not.toHaveBeenCalled();

      dataNode.setState({ data: { state: LoadingState.Done, series: [], timeRange: getDefaultTimeRange() } });
      jest.advanceTimersByTime(READINESS_POLL_INTERVAL_MS);

      expect(messageChannelMock).toHaveBeenCalledTimes(1);
      expect(messageChannelMock).toHaveBeenCalledWith(EXPECTED_MESSAGE);
    });

    it('should treat panel errors as terminal instead of deadlocking the report', () => {
      const { scene, panel } = buildSceneWithPanel(LoadingState.Error);
      panel.activate();
      observer.setScene(scene);

      completeDashboardView();

      expect(messageChannelMock).toHaveBeenCalledWith(EXPECTED_MESSAGE);
    });

    it('should ignore inactive panels (collapsed rows, inactive tabs) so they cannot block the report', () => {
      const { scene } = buildSceneWithPanel(LoadingState.Loading);
      observer.setScene(scene);

      completeDashboardView();

      expect(messageChannelMock).toHaveBeenCalledWith(EXPECTED_MESSAGE);
    });

    it('should send the message after the safety timeout even if the scene never becomes ready', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const { scene, panel } = buildSceneWithPanel(LoadingState.Loading);
      panel.activate();
      observer.setScene(scene);

      completeDashboardView();
      expect(messageChannelMock).not.toHaveBeenCalled();

      jest.advanceTimersByTime(READINESS_TIMEOUT_MS + READINESS_POLL_INTERVAL_MS);

      expect(messageChannelMock).toHaveBeenCalledTimes(1);
      expect(messageChannelMock).toHaveBeenCalledWith(EXPECTED_MESSAGE);
      warnSpy.mockRestore();
    });

    it('should stop a pending readiness poll when a new scene is set', () => {
      const { scene, panel } = buildSceneWithPanel(LoadingState.Loading);
      panel.activate();
      observer.setScene(scene);

      completeDashboardView();
      observer.setScene(null);

      jest.advanceTimersByTime(READINESS_TIMEOUT_MS + READINESS_POLL_INTERVAL_MS);
      expect(messageChannelMock).not.toHaveBeenCalled();
    });
  });

  describe('getReadinessTimeoutMs', () => {
    afterEach(() => {
      delete (window as Record<string, unknown>).__grafanaImageRendererReadinessTimeoutMs;
    });

    it('should derive the timeout from the renderer-advertised budget minus the safety margin', () => {
      window.__grafanaImageRendererReadinessTimeoutMs = 60000;

      expect(getReadinessTimeoutMs()).toBe(60000 - RENDERER_BUDGET_MARGIN_MS);
    });

    it('should never shrink below the minimum when the renderer budget is small', () => {
      window.__grafanaImageRendererReadinessTimeoutMs = 6000;

      expect(getReadinessTimeoutMs()).toBe(5000);
    });

    it('should fall back to the hardcoded default when the renderer does not advertise its budget', () => {
      expect(getReadinessTimeoutMs()).toBe(READINESS_TIMEOUT_MS);
    });
  });

  describe('initializeReportRenderReadinessObserver', () => {
    let addObserverSpy: jest.SpyInstance;

    beforeEach(() => {
      const tracker = performanceUtils.getScenePerformanceTracker();
      addObserverSpy = jest.spyOn(tracker, 'addObserver');
    });

    afterEach(() => {
      addObserverSpy.mockRestore();
    });

    it('should register the observer with the performance tracker', () => {
      initializeReportRenderReadinessObserver();

      expect(addObserverSpy).toHaveBeenCalledWith(expect.any(ReportRenderReadinessObserver));
    });
  });
});
