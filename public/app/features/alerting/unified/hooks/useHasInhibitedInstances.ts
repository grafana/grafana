import { useInhibitedAlerts } from './useInhibitedAlerts';

/**
 * Checks whether any firing instances of a given Grafana-managed alert rule
 * are currently being inhibited by the Grafana Alertmanager.
 *
 * Uses the shared useInhibitedAlerts cache (one request for the full inhibited list)
 * and matches client-side via the __alert_rule_uid__ label, which the backend
 * unconditionally stamps on every Grafana-managed alert instance.
 */
export function useHasInhibitedInstances(ruleUid: string | undefined): {
  hasInhibitedInstances: boolean;
  isLoading: boolean;
} {
  const { inhibitedAlerts, isLoading } = useInhibitedAlerts();

  const hasInhibitedInstances =
    ruleUid !== undefined && inhibitedAlerts.some((alert) => alert.labels.__alert_rule_uid__ === ruleUid);

  return { hasInhibitedInstances, isLoading };
}
