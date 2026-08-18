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
import { FlagKeys, getFeatureFlagClient, useFlagGrafanaDynamicTraceToLogs } from '@grafana/runtime/internal';
import {
  getDataSourceInstance,
  useDataSourceInstanceList,
  useDataSourceInstanceSettings,
} from '@grafana/runtime/unstable';
import { useStyles2, DataLinkButton, Menu } from '@grafana/ui';
import { getNextRequestId } from 'app/features/query/state/PanelQueryRunner';

/** Persists which Loki query variation found logs for a given trace + logs datasource pair. */
const LOKI_QUERY_MATCH_STORAGE_KEY_PREFIX = 'grafana.explore.traceToLogs.lokiQueryMatch';

/** Persists which Loki datasource last returned related logs for a given trace datasource. */
export const LOKI_DATASOURCE_MATCH_STORAGE_KEY_PREFIX = 'grafana.explore.traceToLogs.lokiDatasourceMatch';

export function lokiQueryMatchStorageKey(traceDatasourceUid: string, logsDatasourceUid: string): string {
  return `${LOKI_QUERY_MATCH_STORAGE_KEY_PREFIX}.${traceDatasourceUid}.${logsDatasourceUid}`;
}

function lokiDatasourceMatchStorageKey(traceDatasourceUid: string): string {
  return `${LOKI_DATASOURCE_MATCH_STORAGE_KEY_PREFIX}.${traceDatasourceUid}`;
}

const MAX_FALLBACK_LOKI_DATASOURCES = 2;

interface Props {
  linkModel: LinkModel;
  traceDatasourceUid?: string;
  /** When true, tooltip copy refers to the whole trace rather than a span. */
  forTrace?: boolean;
}

export const LogsLinkButton = ({ linkModel, traceDatasourceUid, forTrace }: Props) => {
  const styles = useStyles2(getStyles);
  const { presence, resolvedLinkModel } = useHasLogs(linkModel, traceDatasourceUid);

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
  const { presence, resolvedLinkModel } = useHasLogs(linkModel, traceDatasourceUid);

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
  refId?: string;
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
function useHasLogs(
  linkModel: LinkModel,
  traceDatasourceUid?: string
): { presence: LogsPresence; resolvedLinkModel: LinkModel } {
  const dynamicTraceToLogsEnabled = useFlagGrafanaDynamicTraceToLogs();
  const [presence, setPresence] = useState<LogsPresence>('loading');
  const [resolvedLinkModel, setResolvedLinkModel] = useState(linkModel);

  const { query, alternativeQueries, timeRange } = linkModel.interpolatedParams ?? {};

  const queryKey = alternativeQueries || query ? JSON.stringify(alternativeQueries || query) : undefined;
  const timeRangeKey = timeRange ? `${timeRange.from.valueOf()}-${timeRange.to.valueOf()}` : undefined;
  const { isLoading: isLoadingDsList, items: dsList } = useDataSourceInstanceList({ type: 'loki' });

  useEffect(() => {
    if (!query || !queryKey || !dynamicTraceToLogsEnabled) {
      setPresence('present');
      return;
    }

    // Wait for the Loki datasource list before probing fallbacks.
    if (isLoadingDsList) {
      return;
    }

    const effectiveTimeRange = timeRange ?? getDefaultTimeRange();
    const queries = Array.isArray(alternativeQueries) ? alternativeQueries : [query];

    setPresence('loading');
    const subscription = checkForLogsInQueries(queries, effectiveTimeRange, dsList, traceDatasourceUid).subscribe({
      next: (result) => {
        if (result.hasLogs && result.match) {
          setResolvedLinkModel(rewriteLinkForMatch(linkModel, result.match));
          setPresence('present');
          reportPresence('present', result.match.refId);
          return;
        }
        setPresence('absent');
      },
      // No resolved match — keep the link disabled
      error: () => setPresence('absent'),
    });

    return () => {
      subscription.unsubscribe();
    };
    // The trace view re-renders a lot on every event, including mouse over.
    // `query`/`timeRange` are intentionally omitted; their content is captured by the serialized keys.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, timeRangeKey, isLoadingDsList, dsList, traceDatasourceUid]);

  useEffect(() => {
    if (presence !== 'absent' || !dynamicTraceToLogsEnabled) {
      return;
    }
    reportPresence('absent');
  }, [dynamicTraceToLogsEnabled, presence]);

  return { presence, resolvedLinkModel };
}

function reportPresence(presence: LogsPresence, refId?: string) {
  reportInteraction('grafana_traces_trace_view_span_logs_checked', {
    logs: presence === 'present',
    refId,
  });
}

function getStoredLokiQueryMatch(
  traceDatasourceUid: string | undefined,
  logsDatasourceUid: string
): string | undefined {
  if (!traceDatasourceUid) {
    return undefined;
  }
  return store.get(lokiQueryMatchStorageKey(traceDatasourceUid, logsDatasourceUid)) ?? undefined;
}

function setStoredLokiQueryMatch(
  traceDatasourceUid: string | undefined,
  logsDatasourceUid: string,
  refId: string
): void {
  if (!traceDatasourceUid) {
    return;
  }
  store.set(lokiQueryMatchStorageKey(traceDatasourceUid, logsDatasourceUid), refId);
}

function getStoredLokiDatasourceMatch(traceDatasourceUid: string | undefined): string | undefined {
  if (!traceDatasourceUid) {
    return undefined;
  }
  return store.get(lokiDatasourceMatchStorageKey(traceDatasourceUid)) ?? undefined;
}

function setStoredLokiDatasourceMatch(traceDatasourceUid: string | undefined, logsDatasourceUid: string): void {
  if (!traceDatasourceUid) {
    return;
  }
  store.set(lokiDatasourceMatchStorageKey(traceDatasourceUid), logsDatasourceUid);
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
 * 1. previously successful Loki datasource alone (discovery already ran — do not rediscover)
 * 2. otherwise the link's configured datasource, then up to MAX_FALLBACK_LOKI_DATASOURCES others
 */
function getLokiDatasourcesToTry(
  primaryUid: string | undefined,
  dsList: DataSourceInstanceListItem[],
  traceDatasourceUid?: string
): string[] {
  const otherUids = dsList
    .filter((ds) => ds.type === 'loki')
    .map((ds) => ds.uid)
    .filter((uid) => uid !== primaryUid)
    .slice(0, MAX_FALLBACK_LOKI_DATASOURCES);

  const storedUid = getStoredLokiDatasourceMatch(traceDatasourceUid);
  // A stored datasource means discovery already found a working Loki; only re-check that one.
  if (storedUid && (storedUid === primaryUid || otherUids.includes(storedUid))) {
    return [storedUid];
  }

  const uids: string[] = [];
  if (primaryUid) {
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
 * When a prior successful Loki variation/datasource is stored, only that option is re-checked —
 * discovery already ran, so empty results mean logs are absent rather than that we should probe again.
 * Otherwise each variation is probed in order; the first match is stored for future checks.
 * If the configured Loki datasource has no logs, other Loki datasources are tried.
 */
function checkForLogsInQueries(
  queries: DataQuery[],
  timeRange: TimeRange,
  dsList: DataSourceInstanceListItem[],
  traceDatasourceUid?: string
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
  const datasourcesToTry = getLokiDatasourcesToTry(primaryUid, dsList, traceDatasourceUid);

  return from(datasourcesToTry).pipe(
    concatMap((datasourceUid) => {
      const dsQueries = remapQueriesToDatasource(queries, datasourceUid);
      return probeForMatchingQuery(dsQueries, timeRange, datasourceUid, traceDatasourceUid).pipe(
        map((match) => (match ? { datasourceUid, query: match, refId: match.refId } : undefined)),
        catchError(() => of(undefined))
      );
    }),
    filter((match) => match != null),
    take(1),
    tap((match) => {
      if (match.query.refId) {
        setStoredLokiQueryMatch(traceDatasourceUid, match.datasourceUid, match.query.refId);
      }
      setStoredLokiDatasourceMatch(traceDatasourceUid, match.datasourceUid);
    }),
    map((match) => ({ hasLogs: true, match })),
    defaultIfEmpty({ hasLogs: false })
  );
}

/**
 * Probes query variations against a single datasource.
 * When a stored refId exists for that datasource, only that variation is checked —
 * discovery already identified the working query, so empty results mean no logs for this span/trace.
 */
function probeForMatchingQuery(
  queries: DataQuery[],
  timeRange: TimeRange,
  logsDatasourceUid: string,
  traceDatasourceUid?: string
): Observable<DataQuery | undefined> {
  const storedRefId = getStoredLokiQueryMatch(traceDatasourceUid, logsDatasourceUid);
  const storedQuery = storedRefId ? queries.find((q) => q.refId === storedRefId) : undefined;
  // Prefer the known match exclusively; do not fall through to other naming conventions.
  const queriesToProbe = storedQuery ? addNoSpanIdFallback(storedQuery) : queries;

  return from(queriesToProbe).pipe(
    concatMap((query) =>
      checkForLogs(query, timeRange).pipe(
        map((hasLogs) => (hasLogs ? query : undefined)),
        // Skip variants that error so later naming conventions can still be tried (discovery only).
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

/**
 * Adds a fallback query for environments where there is a trace_id filter but no span_id filters.
 */
export function addNoSpanIdFallback(query: DataQuery) {
  if ('expr' in query === false || typeof query.expr !== 'string') {
    return [query];
  }
  if (!query.expr.toLowerCase().includes('span')) {
    return [query];
  }
  const spanIdFilter = /\s*\|\s*(?:span_?id|otel_span_id)\b\s*(?:=~|!~|!=|=)\s*(?:"(?:\\.|[^"\\])*"|`[^`]*`|[^\s|]+)/gi;

  // Add fallback without span_id filter
  const fallbackQuery = {
    ...query,
    expr: query.expr.includes('!=')
      ? query.expr.substring(0, query.expr.lastIndexOf('|=') - 1)
      : query.expr.replace(spanIdFilter, ''),
  };

  return [query, fallbackQuery];
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

export function getLogsButtonCTA(
  settings: DataSourceInstanceSettings<DataSourceJsonData> | undefined,
  type: 'trace' | 'span'
) {
  const defaultCTA = t('explore.span-detail-link-buttons.related-logs', 'Related logs');
  if (!settings) {
    return defaultCTA;
  }

  if (getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaDynamicTraceToLogs, false)) {
    return type === 'trace'
      ? t('explore.span-detail-link-buttons.logs-for-this-trace.button', 'Logs for this trace')
      : t('explore.span-detail-link-buttons.logs-for-this-span.button', 'Logs for this span');
  }

  const options = getTraceToLogsOptions(settings.jsonData);
  if (options?.filterBySpanID && type === 'span') {
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
  type: 'span' | 'trace' = 'span'
) {
  const defaultCTA = t(
    'explore.span-detail-link-buttons.related-logs-tooltip',
    'View related logs using the trace data source configuration.'
  );
  if (!settings) {
    return defaultCTA;
  }

  if (getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaDynamicTraceToLogs, false)) {
    if (presence === 'present') {
      return t('explore.span-detail-link-buttons.logs-for-this-trace.logs-found-tooltip', 'See related logs');
    }
    return type === 'trace'
      ? t(
          'explore.span-detail-link-buttons.logs-for-this-trace.no-logs-found-tooltip',
          'No matching logs found for this trace'
        )
      : t(
          'explore.span-detail-link-buttons.logs-for-this-span.no-logs-found-tooltip',
          'No matching logs found for this span'
        );
  }

  const options = getTraceToLogsOptions(settings.jsonData);

  if (presence === 'absent') {
    if (type === 'trace') {
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

  if (type === 'trace') {
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
