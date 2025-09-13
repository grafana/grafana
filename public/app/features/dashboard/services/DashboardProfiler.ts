import { logMeasurement, reportInteraction } from '@grafana/runtime';
import { SceneInteractionProfileEvent, SceneRenderProfiler } from '@grafana/scenes';
import { InteractionProfileResult } from '@grafana/scenes/src/behaviors';

let dashboardSceneProfiler: SceneRenderProfiler | undefined;

export function getDashboardSceneProfiler() {
  if (!dashboardSceneProfiler) {
    dashboardSceneProfiler = new SceneRenderProfiler();
  }
  return dashboardSceneProfiler;
}

export function getDashboardComponentInteractionCallback(uid: string, title: string) {
  return (e: InteractionProfileResult) => {
    const payload = {
      duration: e.interactionDuration,
      networkDuration: e.networkDuration,
      startTs: e.startTs,
      endTs: e.endTs,
      timeSinceBoot: performance.measure('time_since_boot', 'frontend_boot_js_done_time_seconds').duration,
    };

    reportInteraction('dashboard_interaction', {
      interactionType: e.interaction,
      uid,
      ...payload,
    });

    logMeasurement(`dashboard_interaction`, payload, { interactionType: e.interaction, dashboard: uid, title: title });
  };
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

    reportInteraction('dashboard_render', {
      interactionType: e.origin,
      uid,
      ...payload,
    });

    logMeasurement(`dashboard_render`, payload, { interactionType: e.origin, dashboard: uid, title: title });
  };
}
