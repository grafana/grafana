import { getScenePerformanceTracker, writePerformanceLog } from '@grafana/scenes';

import { getDashboardAnalyticsAggregator } from '../../dashboard/services/DashboardAnalyticsAggregator';
import { getScenePerformanceLogger } from '../../dashboard/services/ScenePerformanceLogger';
import { DashboardScene } from '../scene/DashboardScene';

/**
 * Scene behavior function that manages the initialization and lifecycle of
 * dashboard performance services for each dashboard session.
 *
 * Initializes both the analytics aggregator and performance logger, registering
 * them as performance observers. Returns a cleanup function for deactivation.
 */
export function dashboardPerformanceInitializer(dashboard: DashboardScene) {
  const { uid, title } = dashboard.state;

  if (!uid) {
    console.warn('dashboardPerformanceInitializer: Dashboard UID is missing');
    return;
  }

  writePerformanceLog('DAI', 'Initializing dashboard performance services');

  // Initialize analytics aggregator
  const aggregator = getDashboardAnalyticsAggregator();
  aggregator.initialize(uid, title || 'Untitled Dashboard');

  // Initialize performance logger
  const logger = getScenePerformanceLogger();
  logger.initialize();

  // Register both as performance observers
  const tracker = getScenePerformanceTracker();
  const unsubscribeAggregator = tracker.addObserver(aggregator);
  const unsubscribeLogger = tracker.addObserver(logger);

  writePerformanceLog('DAI', 'Dashboard performance services initialized:', { uid, title });

  // Return cleanup function
  return () => {
    // Unsubscribe from performance tracker
    if (unsubscribeAggregator) {
      unsubscribeAggregator();
    }
    if (unsubscribeLogger) {
      unsubscribeLogger();
    }

    // Clean up service states
    aggregator.destroy();
    logger.destroy();

    writePerformanceLog('DAI', 'Dashboard performance services cleaned up');
  };
}
