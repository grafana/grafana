import { performanceUtils } from '@grafana/scenes';

import {
  ReportRenderReadinessObserver,
  initializeReportRenderReadinessObserver,
} from './ReportRenderReadinessObserver';

describe('ReportRenderReadinessObserver', () => {
  let observer: ReportRenderReadinessObserver;

  beforeEach(() => {
    observer = new ReportRenderReadinessObserver();
    delete window.__grafana_report_render_complete;
    delete window.__grafana_report_render_duration;
  });

  describe('onDashboardInteractionStart', () => {
    it('should set __grafana_report_render_complete to false', () => {
      observer.onDashboardInteractionStart!();

      expect(window.__grafana_report_render_complete).toBe(false);
    });
  });

  describe('onDashboardInteractionComplete', () => {
    it('should set __grafana_report_render_complete to true for dashboard_view interactions', () => {
      observer.onDashboardInteractionComplete!({
        interactionType: 'dashboard_view',
        duration: 1234,
      } as performanceUtils.DashboardInteractionCompleteData);

      expect(window.__grafana_report_render_complete).toBe(true);
      expect(window.__grafana_report_render_duration).toBe(1234);
    });

    it('should not set __grafana_report_render_complete for non-dashboard_view interactions', () => {
      observer.onDashboardInteractionComplete!({
        interactionType: 'refresh',
        duration: 500,
      } as performanceUtils.DashboardInteractionCompleteData);

      expect(window.__grafana_report_render_complete).toBeUndefined();
      expect(window.__grafana_report_render_duration).toBeUndefined();
    });

    it('should reset to false on new interaction start then complete on dashboard_view', () => {
      // First interaction completes
      observer.onDashboardInteractionComplete!({
        interactionType: 'dashboard_view',
        duration: 1000,
      } as performanceUtils.DashboardInteractionCompleteData);
      expect(window.__grafana_report_render_complete).toBe(true);

      // New interaction starts
      observer.onDashboardInteractionStart!();
      expect(window.__grafana_report_render_complete).toBe(false);

      // New interaction completes
      observer.onDashboardInteractionComplete!({
        interactionType: 'dashboard_view',
        duration: 2000,
      } as performanceUtils.DashboardInteractionCompleteData);
      expect(window.__grafana_report_render_complete).toBe(true);
      expect(window.__grafana_report_render_duration).toBe(2000);
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
