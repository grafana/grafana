import { Stack } from '@grafana/ui';

import { FiringAlertsCard } from './FiringAlertsCard';

/**
 * Renders the firing-alerts card.
 * Incidents card removed for now — IRM data cannot be effectively controlled from the home page.
 */
export function AlertsIncidentsRow() {
  return (
    <Stack direction="row" wrap="wrap" gap={2}>
      <FiringAlertsCard />
    </Stack>
  );
}
