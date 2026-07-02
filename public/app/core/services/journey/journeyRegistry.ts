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
];
