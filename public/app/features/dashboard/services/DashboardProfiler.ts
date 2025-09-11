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

      // Performance insights (S5.0: Calculate totals from hybrid structure)
      const totalPanelTime = e.panelMetrics.reduce((sum, panel) => {
        const panelTotal =
          (panel.totalQueryTime || 0) +
          (panel.totalFieldConfigTime || 0) +
          (panel.totalTransformationTime || 0) +
          (panel.totalRenderTime || 0) +
          (panel.pluginLoadTime || 0);
        return sum + panelTotal;
      }, 0);

      const avgPanelTime = totalPanelTime / e.panelMetrics.length;

      const slowestPanel = e.panelMetrics.reduce((slowest, panel) => {
        const panelTotal =
          (panel.totalQueryTime || 0) +
          (panel.totalFieldConfigTime || 0) +
          (panel.totalTransformationTime || 0) +
          (panel.totalRenderTime || 0) +
          (panel.pluginLoadTime || 0);
        const slowestTotal =
          (slowest.totalQueryTime || 0) +
          (slowest.totalFieldConfigTime || 0) +
          (slowest.totalTransformationTime || 0) +
          (slowest.totalRenderTime || 0) +
          (slowest.pluginLoadTime || 0);
        return panelTotal > slowestTotal ? panel : slowest;
      });

      const slowestPanelTotal =
        (slowestPanel.totalQueryTime || 0) +
        (slowestPanel.totalFieldConfigTime || 0) +
        (slowestPanel.totalTransformationTime || 0) +
        (slowestPanel.totalRenderTime || 0) +
        (slowestPanel.pluginLoadTime || 0);

      console.log('Performance Summary (S5.0 Hybrid):', {
        totalPanels: e.panelMetrics.length,
        totalPanelTime: `${totalPanelTime.toFixed(1)}ms`,
        avgPanelTime: `${avgPanelTime.toFixed(1)}ms`,
        slowestPanel: {
          id: slowestPanel.panelId,
          plugin: slowestPanel.pluginId,
          time: `${slowestPanelTotal.toFixed(1)}ms`,
          breakdown: {
            query: `${slowestPanel.totalQueryTime || 0}ms`,
            fieldConfig: `${slowestPanel.totalFieldConfigTime || 0}ms`,
            transformation: `${slowestPanel.totalTransformationTime || 0}ms`,
            render: `${slowestPanel.totalRenderTime || 0}ms`,
            plugin: `${slowestPanel.pluginLoadTime || 0}ms`,
          },
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
