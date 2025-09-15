import { getScenePerformanceTracker } from '@grafana/scenes';

import { getDashboardAnalyticsAggregator } from '../../dashboard/services/DashboardAnalyticsAggregator';
import { DashboardScene } from '../scene/DashboardScene';

/**
 * Scene behavior function that manages the initialization and lifecycle of
 * DashboardAnalyticsAggregator for each dashboard session.
 *
 * Initializes the aggregator with dashboard metadata and registers it as a
 * performance observer. Returns a cleanup function for deactivation.
 */
export function dashboardAnalyticsInitializer(dashboard: DashboardScene) {
  const { uid, title } = dashboard.state;

  if (!uid) {
    console.warn('dashboardAnalyticsInitializer: Dashboard UID is missing');
    return;
  }

  // Initialize analytics aggregator
  const aggregator = getDashboardAnalyticsAggregator();
  aggregator.initialize(uid, title || 'Untitled Dashboard');

  // Register as performance observer
  const tracker = getScenePerformanceTracker();
  const unsubscribe = tracker.addObserver(aggregator);

  console.log('DashboardAnalyticsAggregator initialized:', { uid, title });

  // Return cleanup function
  return () => {
    // Unsubscribe from performance tracker
    if (unsubscribe) {
      unsubscribe();
    }

    // Clean up aggregator state
    aggregator.destroy();

    console.log('DashboardAnalyticsAggregator cleaned up');
  };
}
