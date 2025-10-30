import { logMeasurement, reportInteraction, config } from '@grafana/runtime';
import { performanceUtils, type SceneObject } from '@grafana/scenes';

interface SceneInteractionProfileEvent {
  origin: string;
  duration: number;
  networkDuration: number;
  startTs: number;
  endTs: number;
}

let dashboardSceneProfiler: performanceUtils.SceneRenderProfiler | undefined;

export function getDashboardSceneProfiler() {
  if (!dashboardSceneProfiler) {
    // Create panel profiling configuration
    const panelProfilingConfig = {
      watchStateKey: 'body', // Watch dashboard body changes for panel structure changes
    };

    dashboardSceneProfiler = new performanceUtils.SceneRenderProfiler(panelProfilingConfig);
  }
  return dashboardSceneProfiler;
}

export function getDashboardComponentInteractionCallback(uid: string, title: string) {
  return (e: SceneInteractionProfileEvent) => {
    const payload = {
      duration: e.duration,
      networkDuration: e.networkDuration,
      startTs: e.startTs,
      endTs: e.endTs,
      timeSinceBoot: performance.measure('time_since_boot', 'frontend_boot_js_done_time_seconds').duration,
    };

    reportInteraction('dashboard_interaction', {
      interactionType: e.origin,
      uid,
      ...payload,
    });

    logMeasurement(`dashboard_interaction`, payload, { interactionType: e.origin, dashboard: uid, title: title });
  };
}

// Enhanced function to create profiler with dashboard metadata
export function getDashboardSceneProfilerWithMetadata(uid: string, title: string) {
  const profiler = getDashboardSceneProfiler();

  // Set metadata for observer notifications
  profiler.setMetadata({
    dashboardUID: uid,
    dashboardTitle: title,
  });

  // Note: Analytics aggregator initialization and observer registration
  // is now handled by DashboardAnalyticsInitializerBehavior

  return profiler;
}

// Function to enable panel profiling for a specific dashboard
export function enablePanelProfilingForDashboard(dashboard: SceneObject, uid: string) {
  // Check if panel profiling should be enabled for this dashboard
  const shouldEnablePanelProfiling =
    config.dashboardPerformanceMetrics.findIndex((configUid) => configUid === '*' || configUid === uid) !== -1;

  if (shouldEnablePanelProfiling) {
    const profiler = getDashboardSceneProfiler();
    // Attach panel profiling to this dashboard
    profiler.attachPanelProfiling(dashboard);
  }
}
