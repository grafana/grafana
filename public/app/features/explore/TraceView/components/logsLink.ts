import {
  type InterpolateFunction,
  type ScopedVars,
  type DataQuery,
  type DataSourceInstanceSettings,
  type DataSourceJsonData,
} from '@grafana/data';
import { type TraceToLogsTag, type TraceToLogsOptionsV2 } from '@grafana/o11y-ds-frontend';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { type LokiQuery } from 'app/features/loki-helpers/types';

import {
  getDefaultLogsTags,
  getFilteredTags,
  getFormattedTags,
  getSpanTags,
  toLokiLabelName,
} from '../crossSignalConfig';

import { type Trace, type TraceSpan } from './types/trace';

export function getTraceToLogsSpanQuery(
  span: TraceSpan,
  logsDataSourceSettings: DataSourceInstanceSettings<DataSourceJsonData>,
  traceToLogsOptions: TraceToLogsOptionsV2
) {
  const allTags = getSpanTags(span);
  const serviceNames = getServiceNames(allTags, span.process.serviceName);
  return getTraceToLogsQuery(
    allTags,
    logsDataSourceSettings,
    traceToLogsOptions,
    span.traceID,
    span.spanID,
    serviceNames
  );
}

/**
 * Builds a trace-to-logs query for the whole trace (no span id filter).
 * Uses the root span for tag mapping and collects service names across the trace for Loki job variants.
 */
export function getTraceToLogsTraceQuery(
  trace: Trace,
  logsDataSourceSettings: DataSourceInstanceSettings<DataSourceJsonData>,
  traceToLogsOptions: TraceToLogsOptionsV2
) {
  const rootSpan = getRootSpan(trace.spans) ?? trace.spans[0];
  if (!rootSpan) {
    return { query: undefined, tags: '' };
  }

  const allTags = getSpanTags(rootSpan);
  const serviceNames = getTraceServiceNames(trace);
  return getTraceToLogsQuery(
    allTags,
    logsDataSourceSettings,
    traceToLogsOptions,
    trace.traceID,
    undefined,
    serviceNames
  );
}

function getRootSpan(spans: TraceSpan[]): TraceSpan | undefined {
  const allIDs = new Set(spans.map(({ spanID }) => spanID));
  let candidateSpan: TraceSpan | undefined;

  for (const span of spans) {
    const hasInternalRef = span.references?.some(
      ({ traceID, spanID }) => traceID === span.traceID && allIDs.has(spanID)
    );
    if (hasInternalRef) {
      continue;
    }

    if (!candidateSpan) {
      candidateSpan = span;
      continue;
    }

    const thisRefLength = span.references?.length || 0;
    const candidateRefLength = candidateSpan.references?.length || 0;
    if (
      thisRefLength < candidateRefLength ||
      (thisRefLength === candidateRefLength && span.startTime < candidateSpan.startTime)
    ) {
      candidateSpan = span;
    }
  }

  return candidateSpan;
}

function getTraceServiceNames(trace: Trace): string[] {
  const names: string[] = [];
  for (const span of trace.spans) {
    names.push(...getServiceNames(getSpanTags(span), span.process.serviceName));
  }
  return [...new Set(names)];
}

export function getTraceToLogsQuery(
  allTags: TraceToLogsTag[],
  logsDataSourceSettings: DataSourceInstanceSettings<DataSourceJsonData>,
  traceToLogsOptions: TraceToLogsOptionsV2,
  traceID: string,
  spanID?: string,
  serviceNames: string[] = []
) {
  const customQuery = traceToLogsOptions.customQuery ? traceToLogsOptions.query : undefined;
  const tagsToUse =
    traceToLogsOptions.tags && traceToLogsOptions.tags.length > 0 ? traceToLogsOptions.tags : getDefaultLogsTags();

  let query: DataQuery | DataQuery[] | undefined;
  let tags = '';
  switch (logsDataSourceSettings?.type) {
    case 'loki':
      // Trace/OTel attributes use dots; Loki label names require underscores.
      tags = getFormattedTags(allTags, tagsToUse, { normalizeLabelName: toLokiLabelName });
      const tagMatchers = getFilteredTags(allTags, tagsToUse, { normalizeLabelName: toLokiLabelName });
      query = getQueryForLoki(
        traceID,
        spanID,
        tagMatchers,
        traceToLogsOptions,
        customQuery,
        serviceNames.length > 0 ? serviceNames : getServiceNames(allTags)
      );
      break;
    case 'grafana-splunk-datasource':
      tags = getFormattedTags(allTags, tagsToUse, { joinBy: ' ' });
      query = getQueryForSplunk(traceID, spanID, traceToLogsOptions, tags, customQuery);
      break;
    case 'elasticsearch':
    case 'grafana-opensearch-datasource':
      tags = getFormattedTags(allTags, tagsToUse, { labelValueSign: ':', joinBy: ' AND ' });
      query = getQueryForElasticsearchOrOpensearch(traceID, spanID, traceToLogsOptions, tags, customQuery);
      break;
    case 'grafana-falconlogscale-datasource':
      tags = getFormattedTags(allTags, tagsToUse, { joinBy: ' OR ' });
      query = getQueryForFalconLogScale(traceID, spanID, traceToLogsOptions, tags, customQuery);
      break;
    case 'googlecloud-logging-datasource':
      tags = getFormattedTags(allTags, tagsToUse, { joinBy: ' AND ' });
      query = getQueryForGoogleCloudLogging(traceID, spanID, traceToLogsOptions, tags, customQuery);
      break;
    case 'victoriametrics-logs-datasource':
      // Build tag selector using strict equality (":=") required by LogsQL
      // See https://docs.victoriametrics.com/victorialogs/logsql/#exact-filter
      tags = getFormattedTags(allTags, tagsToUse, { labelValueSign: ':=', joinBy: ' AND ' });
      query = getQueryForVictoriaLogs(traceID, spanID, traceToLogsOptions, tags, customQuery);
      break;
  }

  return { query, tags };
}

function getServiceNames(allTags: TraceToLogsTag[], processServiceName?: string): string[] {
  const names = allTags
    .filter((tag) => tag.key === 'service.name')
    .map((tag) => String(tag.value))
    .filter((name) => name.length > 0);

  if (processServiceName) {
    names.push(processServiceName);
  }

  return [...new Set(names)];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Field-name pairs used when probing which structured id labels exist in logs. */
const TRACE_SPAN_ID_FIELD_VARIANTS = [
  { trace: 'traceID', span: 'spanID' },
  { trace: 'trace_id', span: 'span_id' },
  { trace: 'traceId', span: 'spanId' },
  { trace: 'TraceID', span: 'SpanID' },
  { trace: 'TraceId', span: 'SpanId' },
  { trace: 'otel_trace_id', span: 'otel_span_id' },
] as const;

/**
 * Builds alternative Loki queries for trace-to-logs when no custom query is configured:
 * - default / job: structured id filters, one query per trace/span field-name variant
 * - line-contains: tag selector + line filter for the trace/span id values
 *
 * Each query gets a stable refId encoding the strategy and field names so a successful
 * probe can persist which naming convention worked.
 */
function getQueryForLoki(
  traceID: string,
  spanID: string | undefined,
  tags: string[],
  options: TraceToLogsOptionsV2,
  customQuery?: string,
  serviceNames: string[] = []
): LokiQuery | LokiQuery[] | undefined {
  // If the user configured a custom query, respect it
  if (customQuery) {
    return [{ expr: customQuery, refId: 't2l:custom' }];
  }

  if (!tags.length) {
    return undefined;
  }

  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaDynamicTraceToLogs, false)) {
    return getLegacyQueryForLoki(traceID, spanID, options);
  }

  const tagSelector = `{${tags.join(', ')}}`;
  const jobSelector =
    serviceNames.length > 0 ? `{job=~"(.*/)?(${serviceNames.map(escapeRegExp).join('|')})"}` : undefined;

  const queries: LokiQuery[] = [];

  for (const { trace: traceField, span: spanField } of TRACE_SPAN_ID_FIELD_VARIANTS) {
    const structuredIdFilters = [`${traceField}="${traceID}"`];
    if (spanID) {
      structuredIdFilters.push(`${spanField}="${spanID}"`);
    }
    const structuredPipeline = `| logfmt | json | drop __error__ | ${structuredIdFilters.join(' | ')}`;
    const fieldRef = traceField;

    queries.push({
      expr: `${tagSelector} ${structuredPipeline}`,
      refId: `t2l:default:${fieldRef}`,
    });

    if (jobSelector) {
      queries.push({
        expr: `${jobSelector} ${structuredPipeline}`,
        refId: `t2l:job:${fieldRef}`,
      });
    }
  }

  const lineContainsFilters = [`|= "${traceID}"`];
  if (spanID) {
    lineContainsFilters.push(`|= "${spanID}"`);
  }
  queries.push({
    expr: `${tagSelector} ${lineContainsFilters.join(' ')}`,
    refId: 't2l:line-contains',
  });

  return queries;
}

/**
 * Legacy function to use if the dynamic traces to logs feature flag is disabled.
 */
function getLegacyQueryForLoki(traceID: string, spanID: string | undefined, options: TraceToLogsOptionsV2): LokiQuery {
  const { filterByTraceID, filterBySpanID } = options;

  const scopedVar = spanID ? '__span' : '__trace';

  let expr = '{${__tags}}';
  if (filterByTraceID && traceID) {
    expr +=
      ' | label_format log_line_contains_trace_id=`{{ contains "${' +
      scopedVar +
      '.traceId}" __line__  }}` | log_line_contains_trace_id="true" or trace_id="${' +
      scopedVar +
      '.traceId}"';
  }
  if (filterBySpanID && spanID) {
    expr +=
      ' | label_format log_line_contains_span_id=`{{ contains "${' +
      scopedVar +
      '.spanId}" __line__  }}` | log_line_contains_span_id="true" or span_id="${' +
      scopedVar +
      '.spanId}"';
  }

  return {
    expr: expr,
    refId: '',
  };
}

// we do not have access to the dataquery type for opensearch,
// so here is a minimal interface that handles both elasticsearch and opensearch.
interface ElasticsearchOrOpensearchQuery extends DataQuery {
  query: string;
  metrics: Array<{
    id: string;
    type: 'logs';
  }>;
}

function getQueryForElasticsearchOrOpensearch(
  traceID: string,
  spanID: string | undefined,
  options: TraceToLogsOptionsV2,
  tags: string,
  customQuery?: string
): ElasticsearchOrOpensearchQuery {
  const { filterByTraceID, filterBySpanID } = options;
  if (customQuery) {
    return {
      query: customQuery,
      refId: '',
      metrics: [{ id: '1', type: 'logs' }],
    };
  }

  let queryArr = [];
  if (filterBySpanID && spanID) {
    queryArr.push(`"${spanID}"`);
  }

  if (filterByTraceID) {
    queryArr.push(`"${traceID}"`);
  }

  if (tags) {
    queryArr.push('${__tags}');
  }

  return {
    query: queryArr.join(' AND '),
    refId: '',
    metrics: [{ id: '1', type: 'logs' }],
  };
}

function getQueryForSplunk(
  traceID: string,
  spanID: string | undefined,
  options: TraceToLogsOptionsV2,
  tags: string,
  customQuery?: string
) {
  const { filterByTraceID, filterBySpanID } = options;

  if (customQuery) {
    return { query: customQuery, refId: '' };
  }

  let query = '';
  if (tags) {
    query += '${__tags}';
  }
  if (filterByTraceID) {
    query += ` "${traceID}"`;
  }
  if (filterBySpanID && spanID) {
    query += ` "${spanID}"`;
  }

  return {
    query: query,
    refId: '',
  };
}

function getQueryForGoogleCloudLogging(
  traceID: string,
  spanID: string | undefined,
  options: TraceToLogsOptionsV2,
  tags: string,
  customQuery?: string
) {
  const { filterByTraceID, filterBySpanID } = options;

  if (customQuery) {
    return { query: customQuery, refId: '' };
  }

  let queryArr = [];
  if (filterBySpanID && spanID) {
    queryArr.push(`"${spanID}"`);
  }

  if (filterByTraceID) {
    queryArr.push(`"${traceID}"`);
  }

  if (tags) {
    queryArr.push('${__tags}');
  }

  return {
    query: queryArr.join(' AND '),
    refId: '',
  };
}

function getQueryForFalconLogScale(
  traceID: string,
  spanID: string | undefined,
  options: TraceToLogsOptionsV2,
  tags: string,
  customQuery?: string
) {
  const { filterByTraceID, filterBySpanID } = options;

  if (customQuery) {
    return {
      lsql: customQuery,
      refId: '',
    };
  }

  if (!tags) {
    return undefined;
  }

  let lsql = '${__tags}';
  if (filterByTraceID) {
    lsql += ` or "${traceID}"`;
  }

  if (filterBySpanID && spanID) {
    lsql += ` or "${spanID}"`;
  }

  return {
    lsql,
    refId: '',
  };
}

/**
 * Builds a LogsQL expression for victoria‑metrics‑logs‑datasource.
 * Uses := for exact‑match filters and joins parts with AND.
 * See https://docs.victoriametrics.com/victorialogs/logsql/#exact-filter
 */
function getQueryForVictoriaLogs(
  traceID: string,
  spanID: string | undefined,
  options: TraceToLogsOptionsV2,
  tags: string,
  customQuery?: string
) {
  const { filterByTraceID, filterBySpanID } = options;

  // Custom user query has priority
  if (customQuery) {
    return {
      expr: customQuery,
      refId: '',
    };
  }

  const parts: string[] = [];

  if (filterBySpanID && spanID) {
    parts.push(`span_id:="${spanID}"`);
  }
  if (filterByTraceID) {
    parts.push(`trace_id:="${traceID}"`);
  }
  if (tags) {
    parts.push('${__tags}');
  }

  // Nothing to match against – do not create the link
  if (!parts.length) {
    return undefined;
  }

  return {
    expr: parts.join(' AND '),
    refId: '',
  };
}

export function interpolateQueries<T>(
  queries: DataQuery[],
  scopedVars: ScopedVars,
  replaceVariables: InterpolateFunction
) {
  return queries.map((query) => {
    const interpolated = { ...query };
    if ('expr' in interpolated && typeof interpolated.expr === 'string') {
      interpolated.expr = replaceVariables(interpolated.expr, scopedVars);
    }
    return interpolated;
  });
}
