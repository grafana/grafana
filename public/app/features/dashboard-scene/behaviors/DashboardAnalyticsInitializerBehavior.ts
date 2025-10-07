import { writePerformanceLog } from '@grafana/scenes';

import { getDashboardAnalyticsAggregator } from '../../dashboard/services/DashboardAnalyticsAggregator';
import { DashboardScene } from '../scene/DashboardScene';

/**
 * Scene behavior function that manages the dashboard-specific initialization
 * of the global analytics aggregator for each dashboard session.
 *
 * Note: Both ScenePerformanceLogger and DashboardAnalyticsAggregator are now
 * initialized globally to avoid timing issues. This behavior only sets
 * dashboard-specific context.
 */
export function dashboardAnalyticsInitializer(dashboard: DashboardScene) {
  const { uid, title } = dashboard.state;

  if (!uid) {
    console.warn('dashboardAnalyticsInitializer: Dashboard UID is missing');
    return;
  }

  writePerformanceLog('DAI', 'Setting dashboard context for analytics aggregator');

  // Set dashboard context on the global aggregator (observer already registered)
  const aggregator = getDashboardAnalyticsAggregator();
  aggregator.initialize(uid, title || 'Untitled Dashboard');

  writePerformanceLog('DAI', 'Dashboard analytics aggregator context set:', { uid, title });

  // Return cleanup function
  return () => {
    // Only clear dashboard state, keep observer registered for next dashboard
    aggregator.destroy();

    writePerformanceLog('DAI', 'Dashboard analytics aggregator context cleared');
  };
}
