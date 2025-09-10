import { logMeasurement, reportInteraction } from '@grafana/runtime';
import { SceneInteractionProfileEvent, SceneRenderProfiler } from '@grafana/scenes';

let dashboardSceneProfiler: SceneRenderProfiler | undefined;

export function getDashboardSceneProfiler() {
  if (!dashboardSceneProfiler) {
    dashboardSceneProfiler = new SceneRenderProfiler();
  }
  return dashboardSceneProfiler;
}

export function getDashboardInteractionCallback(uid: string, title: string) {
  return (e: SceneInteractionProfileEvent) => {
    const payload = {
      duration: e.duration,
      networkDuration: e.networkDuration,
      processingTime: e.duration - e.networkDuration,
      startTs: e.startTs,
      endTs: e.endTs,
      totalJSHeapSize: e.totalJSHeapSize,
      usedJSHeapSize: e.usedJSHeapSize,
      jsHeapSizeLimit: e.jsHeapSizeLimit,
      timeSinceBoot: performance.measure('time_since_boot', 'frontend_boot_js_done_time_seconds').duration,
    };

    // S4.0/S5.0: Log complete analytics event including panel metrics
    console.log('🎯 Dashboard Analytics Event - UID:', uid, 'Title:', title);
    console.log('Interaction Type:', e.origin);
    console.log('Dashboard Metrics:', payload);

    if (e.panelMetrics && e.panelMetrics.length > 0) {
      console.log(`Panel Metrics (${e.panelMetrics.length} panels):`, e.panelMetrics);

      // Performance insights
      const totalPanelTime = e.panelMetrics.reduce((sum, panel) => sum + (panel.totalTime || 0), 0);
      const avgPanelTime = totalPanelTime / e.panelMetrics.length;
      const slowestPanel = e.panelMetrics.reduce((slowest, panel) =>
        (panel.totalTime || 0) > (slowest.totalTime || 0) ? panel : slowest
      );

      console.log('Performance Summary:', {
        totalPanels: e.panelMetrics.length,
        totalPanelTime: `${totalPanelTime.toFixed(1)}ms`,
        avgPanelTime: `${avgPanelTime.toFixed(1)}ms`,
        slowestPanel: {
          id: slowestPanel.panelId,
          plugin: slowestPanel.pluginId,
          time: `${(slowestPanel.totalTime || 0).toFixed(1)}ms`,
        },
      });
    } else {
      console.warn('No panel metrics found in analytics event');
    }

    console.log('Complete Event Object:', e);

    reportInteraction('dashboard_render', {
      interactionType: e.origin,
      uid,
      ...payload,
    });

    logMeasurement(`dashboard_render`, payload, { interactionType: e.origin, dashboard: uid, title: title });
  };
}
