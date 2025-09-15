import { SceneRenderProfiler } from '@grafana/scenes';

import { initializeScenePerformanceService } from './ScenePerformanceService';

let dashboardSceneProfiler: SceneRenderProfiler | undefined;

export function getDashboardSceneProfiler() {
  if (!dashboardSceneProfiler) {
    dashboardSceneProfiler = new SceneRenderProfiler();

    // Initialize the Scene performance service to start listening to events
    initializeScenePerformanceService();
  }
  return dashboardSceneProfiler;
}

// Enhanced function to create profiler with dashboard metadata
export function getDashboardSceneProfilerWithMetadata(uid: string, title: string, panelCount: number) {
  const profiler = getDashboardSceneProfiler();

  // Set dashboard metadata for observer notifications
  profiler.setDashboardMetadata(uid, title, panelCount);

  // Note: Analytics aggregator initialization and observer registration
  // is now handled by DashboardAnalyticsInitializerBehavior

  return profiler;
}
