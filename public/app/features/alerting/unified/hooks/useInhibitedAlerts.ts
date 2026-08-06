import { useMemo } from 'react';

import { type AlertmanagerAlert } from 'app/plugins/datasource/alertmanager/types';

import { alertmanagerApi } from '../api/alertmanagerApi';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

/**
 * Fetches the alerts of a single Grafana-managed rule that the Grafana Alertmanager is currently
 * inhibiting, matched on the `__alert_rule_uid__` label the backend stamps on every instance.
 *
 * Scoping the request to one rule keeps the response small: without a matcher the Alertmanager
 * returns every suppressed alert in the org, which can be a lot of silenced alerts to download and
 * parse for what callers use as a per-rule signal.
 *
 * Skipped entirely when no rule UID is given.
 */
export function useInhibitedAlerts(ruleUid: string | undefined): {
  inhibitedAlerts: AlertmanagerAlert[];
  isLoading: boolean;
  isFetching: boolean;
} {
  const { data, isLoading, isFetching } = alertmanagerApi.useGetAlertmanagerAlertsQuery(
    {
      amSourceName: GRAFANA_RULES_SOURCE_NAME,
      filter: {
        inhibited: true,
        active: false,
        // `silenced` is deliberately left out: an alert can be both silenced and inhibited, and
        // passing `silenced: false` would make the API drop it before we see it.
        matchers: [{ name: '__alert_rule_uid__', value: ruleUid ?? '', isRegex: false, isEqual: true }],
      },
      showErrorAlert: false,
    },
    { skip: !ruleUid }
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
