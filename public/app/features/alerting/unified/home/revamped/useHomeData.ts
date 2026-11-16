import { useEffect, useMemo } from 'react';
import { useAsync } from 'react-use';

import { getAPIBaseURL } from '@grafana/api-clients';
import { useCreateNotificationqueryMutation } from '@grafana/api-clients/rtkq/historian.alerting/v0alpha1';
import { generatedAPI as notificationsAPI } from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';
import { type TimeRange } from '@grafana/data';
import { getBackendSrv, getDataSourceInstanceSettings } from '@grafana/runtime';
import { type GrafanaPromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { isNotificationHistoryEnabled } from '../../featureToggles';
import { StateHistoryImplementation, useStateHistoryImplementation } from '../../utils/config';
import { getExternalRulesSources } from '../../utils/datasource';
import { INSTANCE_ID } from '../Insights';

import { queryDataSource } from './dataSourceQuery';
import {
  type DeliverySummary,
  summarizeDelivery,
  summarizeDeliveryOverTime,
  summarizeDeliveryTrend,
} from './deliverySummary';
import { type GrafanaRulesSummary, summarizeGrafanaRules } from './grafanaRulesSummary';
import { getDefaultHomeRange } from './homeRange';
import { homeRuleSearchAPI } from './homeRuleSearch';
import {
  type HistoryFrame,
  type MostFiredRule,
  STATE_HISTORY_DATA_SOURCE,
  buildFiringTrendQuery,
  buildMostFiredQuery,
  combineMostFired,
  countFiringFromHistory,
  fillSteps,
} from './mostFiredRules';
import { countNotificationPolicies } from './notificationConfigCounts';
import { alertHitToRule, hasRuleStatus, recordingHitToRule } from './ruleSearchAdapter';
import {
  type MissedEvaluationsRule,
  USAGE_DATA_SOURCE,
  USAGE_SERIES_KEYS,
  type UsageHistory,
  type UsageSeriesKey,
  buildAlertmanagerQueries,
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
  const { data, isLoading, error } = homeRuleSearchAPI.useGetHomeRuleHitsQuery(undefined, REFETCH_ON_MOUNT);

  const value = useMemo(() => {
    if (!data) {
      return undefined;
    }
    const rules = [...data.alert.map(alertHitToRule), ...data.recording.map(recordingHitToRule)];
    const group: GrafanaPromRuleGroupDTO = { name: '', file: '', interval: 0, folderUid: '', rules };
    return { ...summarizeGrafanaRules([group], data.hasMore), statusAvailable: hasRuleStatus(data.alert) };
  }, [data]);

  return { loading: isLoading, error, value };
}

/**
 * Whether the stack has a data source that can hold alert rules. Nothing in the non-deprecated APIs says
 * whether such a data source holds any, so this can be true for a stack with none; the banner and the empty
 * state that depend on it then point to a place that has nothing in it yet.
 */
export function useHasRuleCapableDataSource(): AsyncResult<boolean> {
  const sources = useMemo(() => getExternalRulesSources(), []);
  return { loading: false, value: sources.length > 0 };
}

/**
 * How many silences are active, from the Grafana Cloud usage metrics. Silences have no non-deprecated API,
 * so a stack without these metrics has no count to show. Undefined until the count arrives or when it fails.
 */
export function useActiveSilences(enabled: boolean): AsyncResult<number> {
  const { loading, error, value } = useAsync(async () => {
    if (!enabled) {
      return undefined;
    }
    const { silences = [] } = await queryDataSource(
      USAGE_DATA_SOURCE,
      [{ refId: 'silences', expr: buildAlertmanagerQueries(INSTANCE_ID).silences, instant: true, range: false }],
      getDefaultHomeRange()
    );
    const active = silences.find((series) => series.labels.state === 'active');
    return active ? Math.round(active.values.at(-1) ?? 0) : undefined;
  }, [enabled]);

  return { loading, error, value };
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

/**
 * Self-hosted stacks: the transitions into Alerting, from the historian API's alert state history. It takes
 * the same parameters as the legacy history call. A stack whose backend does not serve it answers with an
 * error, and the caller then shows the rules firing now instead.
 */
function useMostFiredFromHistory(range: TimeRange, enabled: boolean): AsyncResult<MostFiredResult> {
  const { loading, error, value } = useAsync(async () => {
    if (!enabled) {
      return undefined;
    }
    const frame = await getBackendSrv().get<HistoryFrame>(
      `${getAPIBaseURL('historian.alerting.grafana.app', 'v0alpha1')}/alertstate/history`,
      { from: range.from.unix(), to: range.to.unix(), limit: HISTORY_LIMIT, current: 'Alerting' },
      undefined,
      { showErrorAlert: false }
    );
    return countFiringFromHistory(frame, {
      fromMs: range.from.valueOf(),
      toMs: range.to.valueOf(),
      stepMs: getUsageStepSeconds(range) * 1000,
      limit: HISTORY_LIMIT,
    });
  }, [enabled, range]);

  return { loading, error, value };
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
