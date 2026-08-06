import { useMemo } from 'react';

import { type AlertmanagerAlert } from 'app/plugins/datasource/alertmanager/types';

import { alertmanagerApi } from '../api/alertmanagerApi';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

/**
 * Fetches the full list of currently inhibited alerts from the Grafana Alertmanager.
 *
 * The request is intentionally not scoped to a single rule, so the result is shared via
 * RTK Query's cache across all consumers, avoiding per-rule network requests.
 *
 * Only runs for the Grafana-managed alertmanager.
 */
export function useInhibitedAlerts(): {
  inhibitedAlerts: AlertmanagerAlert[];
  isLoading: boolean;
  isFetching: boolean;
} {
  const { data, isLoading, isFetching } = alertmanagerApi.useGetAlertmanagerAlertsQuery(
    {
      amSourceName: GRAFANA_RULES_SOURCE_NAME,
      // `silenced` is deliberately left out: an alert can be both silenced and inhibited, and
      // passing `silenced: false` would make the API drop it before we see it.
      filter: { inhibited: true, active: false },
      showErrorAlert: false,
    },
    { skip: false }
  );

  // The state params above only bound the response, they don't select inhibited alerts (see
  // AlertmanagerAlertsFilter): unprocessed alerts come back too, so a non-empty inhibitedBy is
  // what actually decides.
  const inhibitedAlerts = useMemo(() => (data ?? []).filter((alert) => alert.status.inhibitedBy.length > 0), [data]);

  return {
    inhibitedAlerts,
    isLoading,
    isFetching,
  };
}
