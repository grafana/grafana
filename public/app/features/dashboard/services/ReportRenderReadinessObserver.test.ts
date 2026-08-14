import { performanceUtils } from '@grafana/scenes';

import {
  ReportRenderReadinessObserver,
  initializeReportRenderReadinessObserver,
} from './ReportRenderReadinessObserver';

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
