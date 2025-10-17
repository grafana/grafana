import { performanceUtils, writePerformanceLog } from '@grafana/scenes';

/**
 * Utility function to register a performance observer with the global tracker
 * Reduces duplication between ScenePerformanceLogger and DashboardAnalyticsAggregator
 */
export function registerPerformanceObserver(
  observer: performanceUtils.ScenePerformanceObserver,
  loggerName: string
): void {
  const tracker = performanceUtils.getScenePerformanceTracker();
  tracker.addObserver(observer);

  writePerformanceLog(loggerName, 'Initialized globally and registered as performance observer');
}

/**
 * Chrome-specific performance.memory interface (non-standard)
 */
export interface PerformanceMemory {
  totalJSHeapSize: number;
  usedJSHeapSize: number;
  jsHeapSizeLimit: number;
}

/**
 * Extended Performance interface with Chrome's memory property
 */
export interface PerformanceWithMemory extends Performance {
  memory?: PerformanceMemory;
}

/**
 * Type guard to check if performance has memory property (Chrome-specific)
 */
function hasPerformanceMemory(perf: Performance): perf is PerformanceWithMemory {
  return 'memory' in perf;
}

/**
 * Safely get performance memory metrics (Chrome-specific, non-standard)
 * Returns zero values for browsers without performance.memory support
 */
export function getPerformanceMemory(): PerformanceMemory {
  if (hasPerformanceMemory(performance)) {
    return {
      totalJSHeapSize: performance.memory?.totalJSHeapSize || 0,
      usedJSHeapSize: performance.memory?.usedJSHeapSize || 0,
      jsHeapSizeLimit: performance.memory?.jsHeapSizeLimit || 0,
    };
  }

  // Fallback for browsers without performance.memory
  return {
    totalJSHeapSize: 0,
    usedJSHeapSize: 0,
    jsHeapSizeLimit: 0,
  };
}
