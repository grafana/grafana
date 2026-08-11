import { type DataQuery, type DataSourceInstanceSettings, type DataSourceJsonData } from '@grafana/data';
import { type TraceToLogsTag, type TraceToLogsOptionsV2 } from '@grafana/o11y-ds-frontend';
import { type LokiQuery } from 'app/features/loki-helpers/types';

import { getDefaultLogsTags, getFormattedTags, getSpanTags } from '../crossSignalConfig';

import { type TraceSpan } from './types/trace';

export function getTraceToLogsSpanQuery(
  span: TraceSpan,
  logsDataSourceSettings: DataSourceInstanceSettings<DataSourceJsonData>,
  traceToLogsOptions: TraceToLogsOptionsV2
) {
  return getTraceToLogsQuery(getSpanTags(span), logsDataSourceSettings, traceToLogsOptions, span.traceID, span.spanID);
}

export function getTraceToLogsQuery(
  allTags: TraceToLogsTag[],
  logsDataSourceSettings: DataSourceInstanceSettings<DataSourceJsonData>,
  traceToLogsOptions: TraceToLogsOptionsV2,
  traceID: string,
  spanID?: string
) {
  const customQuery = traceToLogsOptions.customQuery ? traceToLogsOptions.query : undefined;
  const tagsToUse =
    traceToLogsOptions.tags && traceToLogsOptions.tags.length > 0 ? traceToLogsOptions.tags : getDefaultLogsTags();

  let query: DataQuery | undefined;
  let tags = '';
  switch (logsDataSourceSettings?.type) {
    case 'loki':
      tags = getFormattedTags(allTags, tagsToUse);
      query = getQueryForLoki(traceID, spanID, traceToLogsOptions, tags, customQuery);
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

function getQueryForLoki(
  traceID: string,
  spanID: string | undefined,
  options: TraceToLogsOptionsV2,
  tags: string,
  customQuery?: string
): LokiQuery | undefined {
  const { filterByTraceID, filterBySpanID } = options;

  if (customQuery) {
    return { expr: customQuery, refId: '' };
  }

  if (!tags) {
    return undefined;
  }

  let expr = '{${__tags}}';
  if (filterByTraceID) {
    expr +=
      ' | label_format log_line_contains_trace_id=`{{ contains "' +
      traceID +
      '" __line__  }}` | log_line_contains_trace_id="true" or trace_id="' +
      traceID +
      '';
  }
  if (filterBySpanID && spanID) {
    expr +=
      ' | label_format log_line_contains_span_id=`{{ contains "' +
      spanID +
      '" __line__  }}` | log_line_contains_span_id="true" or span_id="' +
      spanID +
      '"';
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
    query += ' "${__span.traceId}"';
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
    lsql += ' or "${__span.traceId}"';
    lsql += ` or "${traceID}"`;
  }

  if (filterBySpanID && spanID) {
    lsql += ' or "${__span.spanId}"';
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
    parts.push('span_id:="${__span.spanId}"');
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
