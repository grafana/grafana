import { useInhibitedAlerts } from './useInhibitedAlerts';

/**
 * Checks whether any firing instances of a given Grafana-managed alert rule
 * are currently being inhibited by the Grafana Alertmanager.
 *
 * The request is already scoped to the rule by its __alert_rule_uid__ label, which the backend
 * unconditionally stamps on every Grafana-managed alert instance. The same label is checked here
 * too, so a matcher an Alertmanager implementation happens to ignore can't turn another rule's
 * inhibition into this rule's.
 */
export function useHasInhibitedInstances(ruleUid: string | undefined): {
  hasInhibitedInstances: boolean;
  isLoading: boolean;
  isFetching: boolean;
} {
  const { inhibitedAlerts, isLoading, isFetching } = useInhibitedAlerts(ruleUid);

  const hasInhibitedInstances =
    ruleUid !== undefined && inhibitedAlerts.some((alert) => alert.labels.__alert_rule_uid__ === ruleUid);

  return { hasInhibitedInstances, isLoading, isFetching };
}
