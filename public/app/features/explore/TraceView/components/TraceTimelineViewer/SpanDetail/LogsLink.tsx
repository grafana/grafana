import { css } from '@emotion/css';
import { useEffect, useMemo, useState } from 'react';
import { catchError, concatMap, defaultIfEmpty, filter, from, map, type Observable, of, switchMap, take, tap } from 'rxjs';

import {
  CoreApp,
  type DataFrame,
  type DataQuery,
  type DataSourceApi,
  type DataSourceInstanceSettings,
  type DataSourceJsonData,
  getDefaultTimeRange,
  type GrafanaTheme2,
  type LinkModel,
  store,
  type TimeRange,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import { getTraceToLogsOptions } from '@grafana/o11y-ds-frontend';
import { reportInteraction } from '@grafana/runtime';
import { useFlagGrafanaDynamicTraceToLogs } from '@grafana/runtime/internal';
import { getDataSourceInstance, useDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { useStyles2, DataLinkButton, Menu } from '@grafana/ui';
import { getNextRequestId } from 'app/features/query/state/PanelQueryRunner';

/** Persists which Loki query variation found logs for a given logs datasource. */
export const LOKI_QUERY_MATCH_STORAGE_KEY_PREFIX = 'grafana.explore.traceToLogs.lokiQueryMatch';

interface Props {
  linkModel: LinkModel;
  traceDatasourceUid?: string;
  /** When true, tooltip copy refers to the whole trace rather than a span. */
  forTrace?: boolean;
}

export const LogsLinkButton = ({ linkModel, traceDatasourceUid, forTrace }: Props) => {
  const styles = useStyles2(getStyles);
  const presence = useHasLogs(linkModel);

  const { settings } = useDataSourceInstanceSettings(traceDatasourceUid);

  const tooltip = useMemo(
    () => getLogsButtonTooltip(settings, presence, forTrace ? 'trace' : 'span'),
    [forTrace, presence, settings]
  );

  const isLoading = presence === 'loading';

  return (
    <span className={styles}>
      <DataLinkButton
        link={linkModel}
        buttonProps={{
          icon: isLoading ? 'spinner' : 'gf-logs',
          disabled: presence === 'absent',
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
  const presence = useHasLogs(linkModel);

  const { settings } = useDataSourceInstanceSettings(traceDatasourceUid);

  const tooltip = useMemo(() => getLogsButtonTooltip(settings, presence), [presence, settings]);

  const isLoading = presence === 'loading';

  return (
    <Menu.Item
      label={linkModel.title}
      icon={isLoading ? 'spinner' : 'gf-logs'}
      ariaLabel={tooltip}
      disabled={presence === 'absent'}
      onClick={(event: React.MouseEvent) => linkModel.onClick?.(event)}
    />
  );
};

type LogsPresence = 'loading' | 'present' | 'absent';

/**
 * Runs the link's query against its datasource to determine whether
 * any logs exist for the span, so the button can be disabled when there is nothing to link to.
 *
 * For Loki, the link may carry an array of query variations. We probe each until one
 * returns logs and persist that match (by refId) so later spans can skip the full probe.
 */
function useHasLogs(linkModel: LinkModel): LogsPresence {
  const dynamicTraceToLogsEnabled = useFlagGrafanaDynamicTraceToLogs();
  const [presence, setPresence] = useState<LogsPresence>('loading');

  const { query, timeRange } = linkModel.interpolatedParams ?? {};

  const queryKey = query ? JSON.stringify(query) : undefined;
  const timeRangeKey = timeRange ? `${timeRange.from.valueOf()}-${timeRange.to.valueOf()}` : undefined;

  useEffect(() => {
    // Without an interpolated query we can't check, so assume logs may exist and leave the link enabled.
    if (!query || !dynamicTraceToLogsEnabled) {
      setPresence('present');
      return;
    }

    const effectiveTimeRange = timeRange ?? getDefaultTimeRange();
    const queries = Array.isArray(query) ? query : [query];

    setPresence('loading');
    const subscription = checkForLogsInQueries(queries, effectiveTimeRange).subscribe({
      next: (hasLogs) => setPresence(hasLogs ? 'present' : 'absent'),
      // If the check fails we don't want to hide a potentially valid link, so keep it enabled.
      error: () => setPresence('present'),
    });

    // Unsubscribing cancels the in-flight datasource request when the component
    // unmounts or the query changes before the check resolves.
    return () => {
      subscription.unsubscribe();
    };
    // The trace view re-renders a lot on every event, including mouse over.
    // `query`/`timeRange` are intentionally omitted; their content is captured by the serialized keys.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, timeRangeKey]);

  useEffect(() => {
    if (presence === 'loading' || !dynamicTraceToLogsEnabled) {
      return;
    }
    reportInteraction('grafana_traces_trace_view_span_logs_checked', {
      logs: presence === 'present',
    });
  }, [dynamicTraceToLogsEnabled, presence]);

  return presence;
}

function getStoredLokiQueryMatch(datasourceUid: string): string | undefined {
  return store.get(`${LOKI_QUERY_MATCH_STORAGE_KEY_PREFIX}.${datasourceUid}`) ?? undefined;
}

function setStoredLokiQueryMatch(datasourceUid: string, refId: string): void {
  store.set(`${LOKI_QUERY_MATCH_STORAGE_KEY_PREFIX}.${datasourceUid}`, refId);
}

/**
 * Checks whether logs exist for any of the given queries.
 * When a prior successful Loki variation is stored for the datasource, that query is used immediately.
 * Otherwise each variation is probed in order; the first match is stored for future checks.
 */
function checkForLogsInQueries(queries: DataQuery[], timeRange: TimeRange): Observable<boolean> {
  if (queries.length === 0) {
    return of(false);
  }

  if (queries.length === 1) {
    return checkForLogs(queries[0], timeRange);
  }

  const datasourceUid = queries.find((q) => q.datasource?.uid)?.datasource?.uid;
  const storedRefId = datasourceUid ? getStoredLokiQueryMatch(datasourceUid) : undefined;
  const storedQuery = storedRefId ? queries.find((q) => q.refId === storedRefId) : undefined;

  // A known-good naming convention for this datasource: skip probing the rest.
  if (storedQuery) {
    return checkForLogs(storedQuery, timeRange);
  }

  return from(queries).pipe(
    concatMap((query) =>
      checkForLogs(query, timeRange).pipe(
        map((hasLogs) => (hasLogs ? query : undefined)),
        // Skip variants that error so later naming conventions can still be tried.
        catchError(() => of(undefined))
      )
    ),
    filter((match): match is DataQuery => match != null),
    take(1),
    tap((match) => {
      if (datasourceUid && match.refId) {
        setStoredLokiQueryMatch(datasourceUid, match.refId);
      }
    }),
    map(() => true),
    defaultIfEmpty(false)
  );
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
