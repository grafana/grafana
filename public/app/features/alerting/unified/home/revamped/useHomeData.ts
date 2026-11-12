import { useEffect, useMemo, useState } from 'react';
import { useAsync } from 'react-use';

import { useCreateNotificationqueryMutation } from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';
import { generatedAPI as notificationsAPI } from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';
import { type TimeRange } from '@grafana/data';
import { SilenceState } from 'app/plugins/datasource/alertmanager/types';

import { alertSilencesApi } from '../../api/alertSilencesApi';
import { prometheusApi } from '../../api/prometheusApi';
import { isNotificationHistoryEnabled } from '../../featureToggles';
import { GRAFANA_RULES_SOURCE_NAME, getExternalRulesSources } from '../../utils/datasource';

import { type DeliverySummary, summarizeDelivery } from './deliverySummary';
import { type GrafanaRulesSummary, HOME_RULE_LIMIT, summarizeGrafanaRules } from './grafanaRulesSummary';
import { countNotificationPolicies } from './notificationConfigCounts';

// The page refreshes by remounting its content, so these queries refetch when they mount.
const REFETCH_ON_MOUNT = { refetchOnMountOrArgChange: true } as const;

interface AsyncResult<T> {
  loading: boolean;
  error?: unknown;
  value?: T;
}

export function useGrafanaRulesSummary(): AsyncResult<GrafanaRulesSummary> {
  const { data, isLoading, error } = prometheusApi.useGetGrafanaGroupsQuery(
    { ruleLimit: HOME_RULE_LIMIT, limitAlerts: 0 },
    REFETCH_ON_MOUNT
  );

  const value = useMemo(
    () => (data ? summarizeGrafanaRules(data.data.groups, Boolean(data.data.groupNextToken)) : undefined),
    [data]
  );

  return { loading: isLoading, error, value };
}

/**
 * Whether any data source in the stack holds at least one data source-managed rule. Asks each rule
 * capable data source for a single group, stops at the first hit, and treats failing data sources
 * as having none so one broken data source cannot block the answer.
 */
export function useHasDataSourceManagedRules(): AsyncResult<boolean> {
  const [getGroups] = prometheusApi.useLazyGetGroupsQuery();
  const sources = useMemo(() => getExternalRulesSources(), []);

  const { loading, value } = useAsync(async () => {
    for (const ruleSource of sources) {
      try {
        const response = await getGroups(
          { ruleSource, groupLimit: 1, excludeAlerts: true, notificationOptions: { showErrorAlert: false } },
          true
        ).unwrap();
        if (response.data.groups.length > 0) {
          return true;
        }
      } catch {
        // An unreachable data source should not decide the answer for the others.
      }
    }
    return false;
  }, [sources, getGroups]);

  // useAsync flips `loading` in an effect, so the first render reports a settled state with no value.
  return { loading: loading || value === undefined, value };
}

export interface SilencesSummary {
  active: number;
  expiringSoon: number;
}

const EXPIRING_SOON_MS = 24 * 60 * 60 * 1000;

export function useSilencesSummary(): AsyncResult<SilencesSummary> {
  const { data, isLoading, error } = alertSilencesApi.useGetSilencesQuery(
    { datasourceUid: GRAFANA_RULES_SOURCE_NAME },
    REFETCH_ON_MOUNT
  );
  // Fixed at mount: "expiring soon" is relative to when the page was opened.
  const [now] = useState(Date.now);

  const value = useMemo(() => {
    if (!data) {
      return undefined;
    }
    const active = data.filter((silence) => silence.status.state === SilenceState.Active);
    const expiringSoon = active.filter((silence) => new Date(silence.endsAt).getTime() - now < EXPIRING_SOON_MS);
    return { active: active.length, expiringSoon: expiringSoon.length };
  }, [data, now]);

  return { loading: isLoading, error, value };
}

/**
 * Notification delivery for the selected range, from notification history. Returns `enabled: false`
 * when notification history is switched off, which is the default on self-hosted stacks.
 */
export function useDeliverySummary(range: TimeRange): AsyncResult<DeliverySummary> & { enabled: boolean } {
  const enabled = isNotificationHistoryEnabled();
  const [queryCounts, { data, isLoading, error }] = useCreateNotificationqueryMutation();

  useEffect(() => {
    if (!enabled) {
      return;
    }
    queryCounts({
      createNotificationqueryRequestBody: {
        type: 'counts',
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        groupBy: {
          integration: true,
          outcome: true,
          error: false,
          integrationIndex: false,
          receiver: false,
          ruleUID: false,
          status: false,
        },
      },
    });
  }, [enabled, queryCounts, range]);

  const value = useMemo(() => (data ? summarizeDelivery(data.counts) : undefined), [data]);

  return { enabled, loading: enabled && (isLoading || (!data && !error)), error, value };
}

/** How many contact points and notification policies the Grafana Alertmanager has; undefined without access. */
export function useNotificationConfigCounts(): { contactPoints?: number; notificationPolicies?: number } {
  const receivers = notificationsAPI.useListReceiverQuery({}, REFETCH_ON_MOUNT);
  const routingTrees = notificationsAPI.useListRoutingTreeQuery({}, REFETCH_ON_MOUNT);

  return {
    contactPoints: receivers.data?.items.length,
    notificationPolicies: routingTrees.data ? countNotificationPolicies(routingTrees.data.items) : undefined,
  };
}
