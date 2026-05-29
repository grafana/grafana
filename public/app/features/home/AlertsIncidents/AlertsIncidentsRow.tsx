import { Stack } from '@grafana/ui';

import { ActiveIncidentsCard } from './ActiveIncidentsCard';
import { FiringAlertsCard } from './FiringAlertsCard';

/**
 * Renders the firing-alerts and active-incidents cards side by side.
 * Each card independently returns null when its data source is unavailable,
 * and flex layout causes the remaining card to stretch.
 */
export function AlertsIncidentsRow() {
  return (
    <Stack direction="row" wrap="wrap" gap={2}>
      <FiringAlertsCard />
      <ActiveIncidentsCard />
    </Stack>
  );
}
