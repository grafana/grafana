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
    reportInteraction('dashboard_render', {
      interactionType: e.origin,
      uid,
      duration: e.duration,
      networkDuration: e.networkDuration,
      totalJSHeapSize: e.totalJSHeapSize,
      usedJSHeapSize: e.usedJSHeapSize,
      jsHeapSizeLimit: e.jsHeapSizeLimit,
    });

    logMeasurement(
      `dashboard_render`,
      {
        duration: e.duration,
        networkDuration: e.networkDuration,
        totalJSHeapSize: e.totalJSHeapSize,
        usedJSHeapSize: e.usedJSHeapSize,
        jsHeapSizeLimit: e.jsHeapSizeLimit,
        timeSinceBoot: performance.measure('time_since_boot', 'frontend_boot_js_done_time_seconds').duration,
      },
      { interactionType: e.origin, dashboard: uid, title: title }
    );
  };
}
