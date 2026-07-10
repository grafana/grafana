import type { JourneyMeta } from '@grafana/runtime';

/**
 * Static registry of all known Critical User Journeys.
 *
 * Each entry describes metadata only - no runtime wiring.
 * Trigger wiring lives in public/app/core/journeys/.
 */
export const JOURNEY_REGISTRY: JourneyMeta[] = [
  {
    type: 'search_to_resource',
    description: 'User searches for and navigates to a resource (dashboard, folder, alert, etc.)',
    owner: 'grafana-dashboards',
    timeoutMs: 60_000,
  },
  {
    type: 'browse_to_resource',
    description: 'User navigates to the browse dashboards page, finds a resource, and opens it',
    owner: 'grafana-dashboards',
    timeoutMs: 60_000,
  },
  {
    type: 'dashboard_edit',
    description: 'User edits and saves a dashboard',
    owner: 'grafana-dashboards',
    timeoutMs: 30 * 60_000,
  },
  {
    type: 'panel_edit',
    description: 'User edits a panel - configures queries, transformations, and visualization',
    owner: 'grafana-dashboards',
    timeoutMs: 30 * 60_000,
    // When dashboard_edit is active, panel_edit nests under it in the same trace.
    parents: ['dashboard_edit'],
  },
  {
    type: 'datasource_configure',
    description: 'User adds and configures a new datasource until successful test',
    owner: 'grafana-connections',
    timeoutMs: 60 * 60_000, // 1 hour - generous for idle gaps (user reads docs, comes back)
  },
  {
    type: 'explore_to_dashboard',
    description: 'User adds a panel from Explore to a dashboard',
    owner: 'grafana-dashboards',
    timeoutMs: 60_000,
  },
  {
    type: 'home_to_alert_insight',
    description:
      'User clicks the homepage Firing alerts card and reaches the destination value moment (alert detail, alert list, rule list, or new-rule editor)',
    owner: 'grafana-frontend-navigation',
    timeoutMs: 60_000,
  },
];
