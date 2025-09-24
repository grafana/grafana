import { config } from '@grafana/runtime';
import { SceneRenderProfiler, type SceneObject } from '@grafana/scenes';

import { initializeScenePerformanceService } from './ScenePerformanceService';

let dashboardSceneProfiler: SceneRenderProfiler | undefined;

export function getDashboardSceneProfiler() {
  if (!dashboardSceneProfiler) {
    // Create panel profiling configuration
    const panelProfilingConfig = {
      watchStateKey: 'body', // Watch dashboard body changes for panel structure changes
    };

    dashboardSceneProfiler = new SceneRenderProfiler(panelProfilingConfig);

    // Initialize the Scene performance service to start listening to events
    initializeScenePerformanceService();
  }
  return dashboardSceneProfiler;
}

// Enhanced function to create profiler with dashboard metadata
export function getDashboardSceneProfilerWithMetadata(uid: string, title: string, panelCount: number) {
  const profiler = getDashboardSceneProfiler();

  // Set metadata for observer notifications
  profiler.setMetadata({
    dashboardUID: uid,
    dashboardTitle: title,
    panelCount: panelCount,
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
