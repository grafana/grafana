import { css } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';
import {
  catchError,
  concatMap,
  defaultIfEmpty,
  filter,
  from,
  map,
  type Observable,
  of,
  switchMap,
  take,
  tap,
} from 'rxjs';

import {
  CoreApp,
  type DataFrame,
  type DataQuery,
  type DataSourceApi,
  type DataSourceInstanceListItem,
  type DataSourceInstanceSettings,
  type DataSourceJsonData,
  getDefaultTimeRange,
  type GrafanaTheme2,
  type LinkModel,
  locationUtil,
  serializeStateToUrlParam,
  store,
  type TimeRange,
  toURLRange,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { getTraceToLogsOptions } from '@grafana/o11y-ds-frontend';
import { locationService, reportInteraction } from '@grafana/runtime';
import { useFlagGrafanaDynamicTraceToLogs } from '@grafana/runtime/internal';
import {
  getDataSourceInstance,
  useDataSourceInstanceList,
  useDataSourceInstanceSettings,
} from '@grafana/runtime/unstable';
import { useStyles2, DataLinkButton, Menu } from '@grafana/ui';
import { getNextRequestId } from 'app/features/query/state/PanelQueryRunner';

/** Persists which Loki query variation found logs for a given logs datasource. */
export const LOKI_QUERY_MATCH_STORAGE_KEY_PREFIX = 'grafana.explore.traceToLogs.lokiQueryMatch';

/** Persists which Loki datasource last returned related logs. */
export const LOKI_DATASOURCE_MATCH_STORAGE_KEY = 'grafana.explore.traceToLogs.lokiDatasourceMatch';

const MAX_FALLBACK_LOKI_DATASOURCES = 2;

interface Props {
  linkModel: LinkModel;
  traceDatasourceUid?: string;
  /** When true, tooltip copy refers to the whole trace rather than a span. */
  forTrace?: boolean;
}

export const LogsLinkButton = ({ linkModel, traceDatasourceUid, forTrace }: Props) => {
  const styles = useStyles2(getStyles);
  const { presence, resolvedLinkModel } = useHasLogs(linkModel);

  const { settings } = useDataSourceInstanceSettings(traceDatasourceUid);

  const tooltip = useMemo(
    () => getLogsButtonTooltip(settings, presence, forTrace ? 'trace' : 'span'),
    [forTrace, presence, settings]
  );

  const isLoading = presence === 'loading';

  return (
    <span className={styles}>
      <DataLinkButton
        link={resolvedLinkModel}
        buttonProps={{
          icon: isLoading ? 'spinner' : 'gf-logs',
          // Only enable once a probe has resolved a working query (or when checks are skipped).
          disabled: presence !== 'present',
          variant: presence === 'absent' ? 'secondary' : 'primary',
          fill: forTrace ? 'outline' : undefined,
          tooltip,
        }}
      ></DataLinkButton>
    </span>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return css({
    [theme.breakpoints.down('sm')]: {
      span: { display: 'none' },
    },
  });
}

export const LogsLinkMenuItem = ({ linkModel, traceDatasourceUid }: Props) => {
  const { presence, resolvedLinkModel } = useHasLogs(linkModel);

  const { settings } = useDataSourceInstanceSettings(traceDatasourceUid);

  const tooltip = useMemo(() => getLogsButtonTooltip(settings, presence), [presence, settings]);

  const isLoading = presence === 'loading';

  return (
    <Menu.Item
      label={resolvedLinkModel.title}
      icon={isLoading ? 'spinner' : 'gf-logs'}
      ariaLabel={tooltip}
      disabled={presence !== 'present'}
      onClick={(event: React.MouseEvent) => resolvedLinkModel.onClick?.(event)}
    />
  );
};

type LogsPresence = 'loading' | 'present' | 'absent';

type LogsCheckMatch = {
  datasourceUid: string;
  query: DataQuery;
};

type LogsCheckResult = {
  hasLogs: boolean;
  match?: LogsCheckMatch;
};

/**
 * Runs the link's query against its datasource to determine whether
 * any logs exist for the span, so the button can be disabled when there is nothing to link to.
 *
 * For Loki, the link may carry an array of query variations. We probe each until one
 * returns logs and persist that match (by refId) so later spans can skip the full probe.
 * If the configured datasource has no logs, we try other Loki datasources.
 * The Explore link is only enabled after a probe resolves a working query.
 */
function useHasLogs(linkModel: LinkModel): { presence: LogsPresence; resolvedLinkModel: LinkModel } {
  const dynamicTraceToLogsEnabled = useFlagGrafanaDynamicTraceToLogs();
  const [presence, setPresence] = useState<LogsPresence>('loading');
  const [resolvedLinkModel, setResolvedLinkModel] = useState(linkModel);

  const { query, timeRange } = linkModel.interpolatedParams ?? {};

  const queryKey = query ? JSON.stringify(query) : undefined;
  const timeRangeKey = timeRange ? `${timeRange.from.valueOf()}-${timeRange.to.valueOf()}` : undefined;
  const { isLoading: isLoadingDsList, items: dsList } = useDataSourceInstanceList({ type: 'loki' });

  useEffect(() => {
    setResolvedLinkModel(linkModel);
  }, [linkModel, queryKey, timeRangeKey]);

  useEffect(() => {
    // Without an interpolated query we can't check, so assume logs may exist and leave the link enabled.
    // Same when the feature flag is off — skip probing and keep the configured link.
    if (!query || !dynamicTraceToLogsEnabled) {
      setPresence('present');
      return;
    }

    // Wait for the Loki datasource list before probing fallbacks.
    if (isLoadingDsList) {
      return;
    }

    const effectiveTimeRange = timeRange ?? getDefaultTimeRange();
    const queries = Array.isArray(query) ? query : [query];

    setPresence('loading');
    const subscription = checkForLogsInQueries(queries, effectiveTimeRange, dsList).subscribe({
      next: (result) => {
        // Only enable navigation once we know which query (and datasource) works.
        if (result.hasLogs && result.match) {
          setResolvedLinkModel(rewriteLinkForMatch(linkModel, result.match));
          setPresence('present');
          return;
        }
        setPresence('absent');
      },
      // No resolved match — keep the link disabled rather than opening an unverified query.
      error: () => setPresence('absent'),
    });

    // Unsubscribing cancels the in-flight datasource request when the component
    // unmounts or the query changes before the check resolves.
    return () => {
      subscription.unsubscribe();
    };
    // The trace view re-renders a lot on every event, including mouse over.
    // `query`/`timeRange` are intentionally omitted; their content is captured by the serialized keys.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, timeRangeKey, isLoadingDsList, dsList]);

  useEffect(() => {
    if (presence === 'loading' || !dynamicTraceToLogsEnabled) {
      return;
    }
    reportInteraction('grafana_traces_trace_view_span_logs_checked', {
      logs: presence === 'present',
    });
  }, [dynamicTraceToLogsEnabled, presence]);

  return { presence, resolvedLinkModel };
}

function getStoredLokiQueryMatch(datasourceUid: string): string | undefined {
  return store.get(`${LOKI_QUERY_MATCH_STORAGE_KEY_PREFIX}.${datasourceUid}`) ?? undefined;
}

function setStoredLokiQueryMatch(datasourceUid: string, refId: string): void {
  store.set(`${LOKI_QUERY_MATCH_STORAGE_KEY_PREFIX}.${datasourceUid}`, refId);
}

function getStoredLokiDatasourceMatch(): string | undefined {
  return store.get(LOKI_DATASOURCE_MATCH_STORAGE_KEY) ?? undefined;
}

function setStoredLokiDatasourceMatch(datasourceUid: string): void {
  store.set(LOKI_DATASOURCE_MATCH_STORAGE_KEY, datasourceUid);
}

function remapQueriesToDatasource(queries: DataQuery[], datasourceUid: string): DataQuery[] {
  return queries.map((q) => ({
    ...q,
    datasource: {
      ...(typeof q.datasource === 'object' ? q.datasource : {}),
      uid: datasourceUid,
      type: 'loki',
    },
  }));
}

/**
 * Datasources to probe for Loki multi-query links:
 * 1. previously successful Loki datasource (if still available)
 * 2. the link's configured datasource
 * 3. up to MAX_FALLBACK_LOKI_DATASOURCES other Loki datasources
 */
function getLokiDatasourcesToTry(primaryUid: string | undefined, dsList: DataSourceInstanceListItem[]): string[] {
  const otherUids = dsList
    .map((ds) => ds.uid)
    .filter((uid) => uid !== primaryUid)
    .slice(0, MAX_FALLBACK_LOKI_DATASOURCES);

  const storedUid = getStoredLokiDatasourceMatch();
  const uids: string[] = [];

  if (storedUid && (storedUid === primaryUid || otherUids.includes(storedUid))) {
    uids.push(storedUid);
  }
  if (primaryUid && !uids.includes(primaryUid)) {
    uids.push(primaryUid);
  }
  for (const uid of otherUids) {
    if (!uids.includes(uid)) {
      uids.push(uid);
    }
  }

  return uids;
}

/**
 * Checks whether logs exist for any of the given queries.
 * When a prior successful Loki variation is stored for the datasource, that query is used immediately.
 * Otherwise each variation is probed in order; the first match is stored for future checks.
 * If the configured Loki datasource has no logs, other Loki datasources are tried.
 */
function checkForLogsInQueries(
  queries: DataQuery[],
  timeRange: TimeRange,
  dsList: DataSourceInstanceListItem[]
): Observable<LogsCheckResult> {
  if (queries.length === 0) {
    return of({ hasLogs: false });
  }

  // Single-query links (non-Loki variants / custom) keep the original single-datasource check.
  if (queries.length === 1) {
    const query = queries[0];
    return checkForLogs(query, timeRange).pipe(
      map((hasLogs) => {
        if (!hasLogs || !query.datasource?.uid) {
          return { hasLogs: false };
        }
        return {
          hasLogs: true,
          match: { datasourceUid: query.datasource.uid, query },
        };
      })
    );
  }

  const primaryUid = queries.find((q) => q.datasource?.uid)?.datasource?.uid;
  const datasourcesToTry = getLokiDatasourcesToTry(primaryUid, dsList);

  return from(datasourcesToTry).pipe(
    concatMap((datasourceUid) => {
      const dsQueries = remapQueriesToDatasource(queries, datasourceUid);
      return probeForMatchingQuery(dsQueries, timeRange, datasourceUid).pipe(
        map((match) => (match ? { datasourceUid, query: match } : undefined)),
        catchError(() => of(undefined))
      );
    }),
    filter((match): match is LogsCheckMatch => match != null),
    take(1),
    tap((match) => {
      if (match.query.refId) {
        setStoredLokiQueryMatch(match.datasourceUid, match.query.refId);
      }
      setStoredLokiDatasourceMatch(match.datasourceUid);
    }),
    map((match) => ({ hasLogs: true, match })),
    defaultIfEmpty({ hasLogs: false })
  );
}

/**
 * Probes query variations against a single datasource.
 * Uses a stored refId for that datasource immediately when available.
 */
function probeForMatchingQuery(
  queries: DataQuery[],
  timeRange: TimeRange,
  datasourceUid: string
): Observable<DataQuery | undefined> {
  const storedRefId = getStoredLokiQueryMatch(datasourceUid);
  const storedQuery = storedRefId ? queries.find((q) => q.refId === storedRefId) : undefined;
  const orderedQueries = storedQuery ? [storedQuery, ...queries.filter((q) => q.refId !== storedQuery.refId)] : queries;

  return from(orderedQueries).pipe(
    concatMap((query) =>
      checkForLogs(query, timeRange).pipe(
        map((hasLogs) => (hasLogs ? query : undefined)),
        // Skip variants that error so later naming conventions can still be tried.
        catchError(() => of(undefined))
      )
    ),
    filter((match): match is DataQuery => match != null),
    take(1),
    defaultIfEmpty(undefined)
  );
}

function rewriteLinkForMatch(linkModel: LinkModel, match: LogsCheckMatch): LinkModel {
  // Narrow Explore to the successful query variation (and datasource, when it differs from config).
  const matchedQueries = remapQueriesToDatasource([match.query], match.datasourceUid);
  const href = rebuildExploreHref(linkModel, matchedQueries, match.datasourceUid);

  return {
    ...linkModel,
    href,
    interpolatedParams: {
      ...linkModel.interpolatedParams,
      query: matchedQueries[0],
    },
    // Original onClick closes over the configured datasource/queries; replace it so navigation
    // uses the matched datasource and successful query variation.
    onClick: linkModel.onClick
      ? (event) => {
          if (event?.preventDefault) {
            event.preventDefault();
          }
          locationService.push(href);
        }
      : undefined,
  };
}

function rebuildExploreHref(linkModel: LinkModel, queries: DataQuery[], datasourceUid: string): string {
  const timeRange = linkModel.interpolatedParams?.timeRange;
  try {
    return locationUtil.assureBaseUrl(
      `/explore?left=${encodeURIComponent(
        serializeStateToUrlParam({
          ...(timeRange?.raw ? { range: toURLRange(timeRange.raw) } : {}),
          datasource: datasourceUid,
          queries,
        })
      )}`
    );
  } catch {
    return linkModel.href;
  }
}

function checkForLogs(query: DataQuery, timeRange: TimeRange): Observable<boolean> {
  if (!query.datasource) {
    return of(false);
  }

  // Resolving the datasource is async, and `query` can return either an Observable
  // or a Promise, so normalize both with `from`. Returning an Observable lets the
  // caller unsubscribe to cancel the request while it's still in flight.
  return from(getDataSourceInstance(query.datasource)).pipe(
    switchMap((datasource) => from(datasource.query(getRequest(query, timeRange, datasource)))),
    map((response) => {
      const series: DataFrame[] = response.data ?? [];
      return series.some((frame) => frame.length > 0);
    })
  );
}

export function getLogsButtonCTA(settings: DataSourceInstanceSettings<DataSourceJsonData> | undefined) {
  const defaultCTA = t('explore.span-detail-link-buttons.related-logs', 'Related logs');
  if (!settings) {
    return defaultCTA;
  }

  // The trace-to-logs config lives on jsonData; getTraceToLogsOptions also
  // migrates the legacy `tracesToLogs` shape to the v2 shape.
  const options = getTraceToLogsOptions(settings.jsonData);
  if (options?.filterBySpanID) {
    return t('explore.span-detail-link-buttons.logs-for-this-span.button', 'Logs for this span');
  }
  if (options?.filterByTraceID) {
    return t('explore.span-detail-link-buttons.logs-for-this-trace.button', 'Logs for this trace');
  }

  return defaultCTA;
}

export function getLogsButtonTooltip(
  settings: DataSourceInstanceSettings<DataSourceJsonData> | undefined,
  presence: LogsPresence,
  level: 'span' | 'trace' = 'span'
) {
  const defaultCTA = t(
    'explore.span-detail-link-buttons.related-logs-tooltip',
    'View related logs using the trace data source configuration.'
  );
  if (!settings) {
    return defaultCTA;
  }
  const options = getTraceToLogsOptions(settings.jsonData);

  if (presence === 'absent') {
    if (level === 'trace') {
      return t(
        'explore.span-detail-link-buttons.logs-for-this-trace.no-logs-tooltip',
        'No logs found for this trace using the trace data source configuration.'
      );
    }
    if (options?.filterBySpanID) {
      return t(
        'explore.span-detail-link-buttons.logs-for-this-span.no-logs-tooltip',
        'No logs found for this span using the trace data source configuration.'
      );
    }
    if (options?.filterByTraceID) {
      return t(
        'explore.span-detail-link-buttons.logs-for-this-trace.no-logs-tooltip',
        'No logs found for this trace using the trace data source configuration.'
      );
    }
    return t(
      'explore.span-detail-link-buttons.related-logs-no-logs-tooltip',
      'No related logs found using the trace data source configuration.'
    );
  }

  if (level === 'trace') {
    return t(
      'explore.span-detail-link-buttons.logs-for-this-trace.tooltip',
      'See logs related to this trace using the trace data source configuration.'
    );
  }
  if (options?.filterBySpanID) {
    return t(
      'explore.span-detail-link-buttons.logs-for-this-span.tooltip',
      'See logs related to this span using the trace data source configuration.'
    );
  }
  if (options?.filterByTraceID) {
    return t(
      'explore.span-detail-link-buttons.logs-for-this-trace.tooltip',
      'See logs related to this trace using the trace data source configuration.'
    );
  }

  return defaultCTA;
}

function getRequest(query: DataQuery, timeRange: TimeRange, datasource: DataSourceApi) {
  const request = {
    requestId: getNextRequestId(),
    app: CoreApp.Explore,
    targets: [query],
    range: timeRange,
    timezone: 'browser',
    interval: '1m',
    intervalMs: 60000,
    maxDataPoints: 1,
    scopedVars: {},
    startTime: Date.now(),
  };

  if (datasource.type === 'loki') {
    const target = { ...query, maxLines: 1 };
    request.targets = [target];
  }

  return request;
}
