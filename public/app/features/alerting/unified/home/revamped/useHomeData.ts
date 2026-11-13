import { useEffect, useMemo, useState } from 'react';
import { useAsync } from 'react-use';

import { useCreateNotificationqueryMutation } from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';
import { generatedAPI as notificationsAPI } from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';
import { type TimeRange } from '@grafana/data';
import { getDataSourceInstanceSettings } from '@grafana/runtime';
import { SilenceState } from 'app/plugins/datasource/alertmanager/types';

import { alertSilencesApi } from '../../api/alertSilencesApi';
import { prometheusApi } from '../../api/prometheusApi';
import { stateHistoryApi } from '../../api/stateHistoryApi';
import { isNotificationHistoryEnabled } from '../../featureToggles';
import { StateHistoryImplementation, useStateHistoryImplementation } from '../../utils/config';
import { GRAFANA_RULES_SOURCE_NAME, getExternalRulesSources } from '../../utils/datasource';
import { INSTANCE_ID } from '../Insights';

import { queryDataSource } from './dataSourceQuery';
import {
  type DeliverySummary,
  summarizeDelivery,
  summarizeDeliveryOverTime,
  summarizeDeliveryTrend,
} from './deliverySummary';
import { type GrafanaRulesSummary, HOME_RULE_LIMIT, summarizeGrafanaRules } from './grafanaRulesSummary';
import {
  type MostFiredRule,
  STATE_HISTORY_DATA_SOURCE,
  buildFiringTrendQuery,
  buildMostFiredQuery,
  combineMostFired,
  countFiringFromHistory,
  fillSteps,
} from './mostFiredRules';
import { countNotificationPolicies } from './notificationConfigCounts';
import {
  type MissedEvaluationsRule,
  USAGE_DATA_SOURCE,
  USAGE_SERIES_KEYS,
  type UsageHistory,
  type UsageSeriesKey,
  buildMissedEvaluationQueries,
  buildUsageQueries,
  getUsageStepSeconds,
  summarizeMissedEvaluations,
  summarizeUsageHistory,
} from './usageHistory';

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
  // A second request for the delivered share over time; the tile works without it.
  const [queryTrend, { data: trendData }] = useCreateNotificationqueryMutation();

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const timeWindow = { from: range.from.toISOString(), to: range.to.toISOString() };
    const groupBy = {
      integration: true,
      outcome: true,
      error: false,
      integrationIndex: false,
      receiver: false,
      ruleUID: false,
      status: false,
    };
    queryCounts({ createNotificationqueryRequestBody: { type: 'counts', ...timeWindow, groupBy } });
    queryTrend({
      createNotificationqueryRequestBody: {
        type: 'range_counts',
        ...timeWindow,
        step: getUsageStepSeconds(range),
        groupBy: { ...groupBy, integration: false },
      },
    });
  }, [enabled, queryCounts, queryTrend, range]);

  const value = useMemo(
    () =>
      data
        ? {
            ...summarizeDelivery(data.counts),
            trend: trendData ? summarizeDeliveryTrend(trendData.counts) : undefined,
            overTime: trendData ? summarizeDeliveryOverTime(trendData.counts) : undefined,
          }
        : undefined,
    [data, trendData]
  );

  return { enabled, loading: enabled && (isLoading || (!data && !error)), error, value };
}

/** Tile history from the Grafana Cloud usage metrics, for the selected range. */
export function useUsageHistory(range: TimeRange, enabled: boolean): AsyncResult<UsageHistory> {
  const { loading, error, value } = useAsync(async () => {
    if (!enabled) {
      return undefined;
    }
    const stepSeconds = getUsageStepSeconds(range);
    const queries = Object.entries(buildUsageQueries(INSTANCE_ID)).map(([refId, expr]) => ({
      refId,
      expr,
      range: true,
      instant: false,
      intervalMs: stepSeconds * 1000,
      maxDataPoints: 1000,
    }));
    const results = await queryDataSource(USAGE_DATA_SOURCE, queries, range);
    const series: Partial<Record<UsageSeriesKey, number[]>> = {};
    for (const key of USAGE_SERIES_KEYS) {
      series[key] = results[key]?.[0]?.values ?? [];
    }
    return summarizeUsageHistory(series, stepSeconds);
  }, [enabled, range]);

  return { loading, error, value };
}

/**
 * Where to read how often rules fired: the Loki data source Grafana Cloud writes state history to,
 * or else the state history API when the stack keeps its history in Loki. Undefined when neither is
 * there, or while the data source check runs.
 */
export function useMostFiredSource(): MostFiredSource | undefined {
  const historyInLoki = useStateHistoryImplementation() === StateHistoryImplementation.Loki;
  const { value: cloudDataSource, loading } = useAsync(
    () => getDataSourceInstanceSettings(STATE_HISTORY_DATA_SOURCE.uid),
    []
  );

  if (loading) {
    return undefined;
  }
  if (cloudDataSource) {
    return 'cloud';
  }
  return historyInLoki ? 'history' : undefined;
}

/** The rules with the most missed evaluations in the range, from the Grafana Cloud usage metrics. */
export function useMissedEvaluations(range: TimeRange): AsyncResult<MissedEvaluationsRule[]> {
  const { loading, error, value } = useAsync(async () => {
    const rangeSeconds = Math.max(60, Math.round((range.to.valueOf() - range.from.valueOf()) / 1000));
    const { topMissed, totalMissed } = buildMissedEvaluationQueries(INSTANCE_ID, rangeSeconds);
    const results = await queryDataSource(
      USAGE_DATA_SOURCE,
      [
        { refId: 'topMissed', expr: topMissed, instant: true, range: false },
        { refId: 'totalMissed', expr: totalMissed, instant: true, range: false },
      ],
      range
    );
    return summarizeMissedEvaluations(results.topMissed ?? [], results.totalMissed ?? [], rangeSeconds);
  }, [range]);

  return { loading, error, value };
}

// The state history API returns at most this many events.
const HISTORY_LIMIT = 5000;

/** Where the page reads how often rules fired: the Cloud Loki data source, or the state history API. */
export type MostFiredSource = 'cloud' | 'history';

export interface MostFiredResult {
  rules: MostFiredRule[];
  /** The counts cover only the latest events the state history API returned. */
  capped: boolean;
}

/** The rules that fired most often in the range, with a trend for each. */
export function useMostFiredRules(range: TimeRange, source: MostFiredSource): AsyncResult<MostFiredResult> {
  const cloud = useMostFiredFromCloud(range, source === 'cloud');
  const history = useMostFiredFromHistory(range, source === 'history');
  return source === 'cloud' ? cloud : history;
}

function useMostFiredFromCloud(range: TimeRange, enabled: boolean): AsyncResult<MostFiredResult> {
  const { loading, error, value } = useAsync(async () => {
    if (!enabled) {
      return undefined;
    }
    const rangeSeconds = Math.max(60, Math.round((range.to.valueOf() - range.from.valueOf()) / 1000));
    const { mostFired = [] } = await queryDataSource(
      STATE_HISTORY_DATA_SOURCE,
      [{ refId: 'mostFired', expr: buildMostFiredQuery(rangeSeconds), queryType: 'instant' }],
      range
    );
    const ruleUIDs = mostFired.map((series) => series.labels.ruleUID).filter(Boolean);
    if (ruleUIDs.length === 0) {
      return { rules: [], capped: false };
    }
    const stepSeconds = getUsageStepSeconds(range);
    const { firingTrend = [] } = await queryDataSource(
      STATE_HISTORY_DATA_SOURCE,
      [
        {
          refId: 'firingTrend',
          expr: buildFiringTrendQuery(ruleUIDs, stepSeconds),
          queryType: 'range',
          step: `${stepSeconds}s`,
        },
      ],
      range
    );
    const filled = firingTrend.map((series) => ({
      ...series,
      values: fillSteps(series, range.from.valueOf(), range.to.valueOf(), stepSeconds * 1000),
    }));
    return { rules: combineMostFired(mostFired, filled), capped: false };
  }, [enabled, range]);

  return { loading, error, value };
}

function useMostFiredFromHistory(range: TimeRange, enabled: boolean): AsyncResult<MostFiredResult> {
  const { data, isLoading, error } = stateHistoryApi.useGetRuleHistoryQuery(
    { timeRange: { from: range.from, to: range.to }, limit: HISTORY_LIMIT, current: 'Alerting' },
    { skip: !enabled }
  );

  const value = useMemo(
    () =>
      data
        ? countFiringFromHistory(data, {
            fromMs: range.from.valueOf(),
            toMs: range.to.valueOf(),
            stepMs: getUsageStepSeconds(range) * 1000,
            limit: HISTORY_LIMIT,
          })
        : undefined,
    [data, range]
  );

  return { loading: isLoading, error, value };
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
