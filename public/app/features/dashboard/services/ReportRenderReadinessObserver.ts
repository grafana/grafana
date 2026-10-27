import { type performanceUtils } from '@grafana/scenes';

import { registerPerformanceObserver } from './performanceUtils';
import { sendRenderComplete } from './sendRenderComplete';

/**
 * Performance observer that signals to the grafana-image-renderer when a dashboard
 * has finished rendering all panels for report capture.
 *
 * Sends a `REPORT_RENDER_COMPLETE` message via the `window.__grafanaImageRendererMessageChannel`
 * chromedp binding when a `dashboard_view` interaction completes, meaning all panels have gone
 * through the full lifecycle (queries, transforms, field config, rendering).
 *
 * This observer is only registered for report routes to avoid any overhead on
 * normal dashboard usage.
 */
export class ReportRenderReadinessObserver implements performanceUtils.ScenePerformanceObserver {
  onDashboardInteractionComplete = (data: performanceUtils.DashboardInteractionCompleteData): void => {
    if (data.interactionType === 'dashboard_view') {
      sendRenderComplete(true);
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
