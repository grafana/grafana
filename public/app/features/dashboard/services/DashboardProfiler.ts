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
      longFramesCount: e.longFramesCount,
      longFramesTotalTime: e.longFramesTotalTime,
      timeSinceBoot: performance.measure('time_since_boot', 'frontend_boot_js_done_time_seconds').duration,
    };

    reportInteraction('dashboard_render', {
      interactionType: e.origin,
      uid,
      ...payload,
    });

    logMeasurement(`dashboard_render`, payload, { interactionType: e.origin, dashboard: uid, title: title });
  };
}
