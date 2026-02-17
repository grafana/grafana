import { performanceUtils } from '@grafana/scenes';

import { registerPerformanceObserver } from './performanceUtils';

declare global {
  interface Window {
    __grafana_report_render_complete?: boolean;
    __grafana_report_render_duration?: number;
  }
}

/**
 * Performance observer that signals to the grafana-image-renderer when a dashboard
 * has finished rendering all panels for report capture.
 *
 * Sets `window.__grafana_report_render_complete` to `true` when a `dashboard_view`
 * interaction completes, meaning all panels have gone through the full lifecycle
 * (queries, transforms, field config, rendering).
 *
 * This observer is only registered for report routes to avoid any overhead on
 * normal dashboard usage.
 */
export class ReportRenderReadinessObserver implements performanceUtils.ScenePerformanceObserver {
  onDashboardInteractionStart = (): void => {
    window.__grafana_report_render_complete = false;
  };

  onDashboardInteractionComplete = (data: performanceUtils.DashboardInteractionCompleteData): void => {
    if (data.interactionType === 'dashboard_view') {
      window.__grafana_report_render_complete = true;
      window.__grafana_report_render_duration = data.duration;
    }
  };
}

let instance: ReportRenderReadinessObserver | null = null;

export function initializeReportRenderReadinessObserver(): void {
  if (!instance) {
    instance = new ReportRenderReadinessObserver();
    registerPerformanceObserver(instance, 'RRO');
  }
}
