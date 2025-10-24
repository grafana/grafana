import { store } from '@grafana/data';
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

/**
 * Check if performance logging is enabled via localStorage
 */
function isPerformanceLoggingEnabled(): boolean {
  if (typeof window !== 'undefined') {
    return store.get('grafana.debug.sceneProfiling') === 'true';
  }
  return false;
}

/**
 * Write a collapsible performance log group (follows writePerformanceLog pattern)
 */
export function writePerformanceGroupStart(logger: string, message: string): void {
  if (isPerformanceLoggingEnabled()) {
    // eslint-disable-next-line no-console
    console.groupCollapsed(`${logger}: ${message}`);
  }
}

/**
 * Write a performance log within a group (follows writePerformanceLog pattern)
 */
export function writePerformanceGroupLog(logger: string, message: string, data?: unknown): void {
  if (isPerformanceLoggingEnabled()) {
    if (data) {
      // eslint-disable-next-line no-console
      console.log(message, data);
    } else {
      // eslint-disable-next-line no-console
      console.log(message);
    }
  }
}

/**
 * End a performance log group (follows writePerformanceLog pattern)
 */
export function writePerformanceGroupEnd(): void {
  if (isPerformanceLoggingEnabled()) {
    // eslint-disable-next-line no-console
    console.groupEnd();
  }
}

/**
 * Safely creates a performance mark, ignoring errors if the Performance API is not available.
 */
export function createPerformanceMark(name: string, timestamp?: number): void {
  try {
    if (typeof performance !== 'undefined' && performance.mark) {
      if (timestamp !== undefined) {
        performance.mark(name, { startTime: timestamp });
      } else {
        performance.mark(name);
      }
    }
  } catch (error) {
    console.error(`❌ Failed to create performance mark: ${name}`, { timestamp, error });
  }
}

/**
 * Safely creates a performance measure, ignoring errors if the Performance API is not available.
 */
export function createPerformanceMeasure(name: string, startMark: string, endMark?: string): void {
  try {
    if (typeof performance !== 'undefined' && performance.measure) {
      if (endMark) {
        performance.measure(name, startMark, endMark);
      } else {
        performance.measure(name, startMark);
      }
    }
  } catch (error) {
    console.error(`❌ Failed to create performance measure: ${name}`, { startMark, endMark, error });
  }
}
