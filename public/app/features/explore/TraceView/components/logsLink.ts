import { type DataQuery, type DataSourceInstanceSettings, type DataSourceJsonData } from '@grafana/data';
import { type TraceToLogsTag, type TraceToLogsOptionsV2 } from '@grafana/o11y-ds-frontend';
import { type LokiQuery } from 'app/features/loki-helpers/types';

import { getDefaultLogsTags } from '../crossSignalConfig';

import { type TraceSpan } from './types/trace';

export function getTraceToLogsQuery(
  logsDataSourceSettings: DataSourceInstanceSettings<DataSourceJsonData>,
  traceToLogsOptions: TraceToLogsOptionsV2
) {
  const customQuery = traceToLogsOptions.customQuery ? traceToLogsOptions.query : undefined;
  const tagsToUse =
    traceToLogsOptions.tags && traceToLogsOptions.tags.length > 0 ? traceToLogsOptions.tags : getDefaultLogsTags();

  let query: DataQuery | undefined;
  let tags = '';
  switch (logsDataSourceSettings?.type) {
    case 'loki':
      tags = getFormattedTags(span, tagsToUse);
      query = getQueryForLoki(span, traceToLogsOptions, tags, customQuery);
      break;
    case 'grafana-splunk-datasource':
      tags = getFormattedTags(span, tagsToUse, { joinBy: ' ' });
      query = getQueryForSplunk(span, traceToLogsOptions, tags, customQuery);
      break;
    case 'elasticsearch':
    case 'grafana-opensearch-datasource':
      tags = getFormattedTags(span, tagsToUse, { labelValueSign: ':', joinBy: ' AND ' });
      query = getQueryForElasticsearchOrOpensearch(span, traceToLogsOptions, tags, customQuery);
      break;
    case 'grafana-falconlogscale-datasource':
      tags = getFormattedTags(span, tagsToUse, { joinBy: ' OR ' });
      query = getQueryForFalconLogScale(span, traceToLogsOptions, tags, customQuery);
      break;
    case 'googlecloud-logging-datasource':
      tags = getFormattedTags(span, tagsToUse, { joinBy: ' AND ' });
      query = getQueryForGoogleCloudLogging(span, traceToLogsOptions, tags, customQuery);
      break;
    case 'victoriametrics-logs-datasource':
      // Build tag selector using strict equality (":=") required by LogsQL
      // See https://docs.victoriametrics.com/victorialogs/logsql/#exact-filter
      tags = getFormattedTags(span, tagsToUse, { labelValueSign: ':=', joinBy: ' AND ' });
      query = getQueryForVictoriaLogs(span, traceToLogsOptions, tags, customQuery);
      break;
  }

  return { query, tags };
}

export function getSpanTags(span: TraceSpan) {
  return [
    ...span.process.tags,
    ...span.tags,
    { key: 'spanId', value: span.spanID },
    { key: 'traceId', value: span.traceID },
    { key: 'name', value: span.operationName },
    { key: 'duration', value: span.duration },
  ];
}

/**
 * Creates a string representing all the tags already formatted for use in the query. The tags are filtered so that
 * only intersection of tags that exist in a span and tags that you want are serialized into the string.
 */
export function getFormattedTags(
  allTags: TraceToLogsTag[],
  tagsToUse: TraceToLogsTag[],
  { labelValueSign = '=', joinBy = ', ' }: { labelValueSign?: string; joinBy?: string } = {}
) {
  // In order, try to use mapped tags -> tags -> default tags
  // Build tag portion of query
  return allTags
    .map((tag) => {
      const keyValue = tagsToUse.find((keyValue) => keyValue.key === tag.key);
      if (keyValue) {
        return `${keyValue.value ? keyValue.value : keyValue.key}${labelValueSign}"${tag.value}"`;
      }
      return undefined;
    })
    .filter((v) => Boolean(v))
    .join(joinBy);
}

function getQueryForLoki(
  span: TraceSpan,
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
  if (filterByTraceID && span.traceID) {
    expr +=
      ' | label_format log_line_contains_trace_id=`{{ contains "${__span.traceId}" __line__  }}` | log_line_contains_trace_id="true" or trace_id="${__span.traceId}"';
  }
  if (filterBySpanID && span.spanID) {
    expr +=
      ' | label_format log_line_contains_span_id=`{{ contains "${__span.spanId}" __line__  }}` | log_line_contains_span_id="true" or span_id="${__span.spanId}"';
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
  span: TraceSpan,
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
  if (filterBySpanID && span.spanID) {
    queryArr.push('"${__span.spanId}"');
  }

  if (filterByTraceID && span.traceID) {
    queryArr.push('"${__span.traceId}"');
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

function getQueryForSplunk(span: TraceSpan, options: TraceToLogsOptionsV2, tags: string, customQuery?: string) {
  const { filterByTraceID, filterBySpanID } = options;

  if (customQuery) {
    return { query: customQuery, refId: '' };
  }

  let query = '';
  if (tags) {
    query += '${__tags}';
  }
  if (filterByTraceID && span.traceID) {
    query += ' "${__span.traceId}"';
  }
  if (filterBySpanID && span.spanID) {
    query += ' "${__span.spanId}"';
  }

  return {
    query: query,
    refId: '',
  };
}

function getQueryForGoogleCloudLogging(
  span: TraceSpan,
  options: TraceToLogsOptionsV2,
  tags: string,
  customQuery?: string
) {
  const { filterByTraceID, filterBySpanID } = options;

  if (customQuery) {
    return { query: customQuery, refId: '' };
  }

  let queryArr = [];
  if (filterBySpanID && span.spanID) {
    queryArr.push('"${__span.spanId}"');
  }

  if (filterByTraceID && span.traceID) {
    queryArr.push('"${__span.traceId}"');
  }

  if (tags) {
    queryArr.push('${__tags}');
  }

  return {
    query: queryArr.join(' AND '),
    refId: '',
  };
}

function getQueryForFalconLogScale(span: TraceSpan, options: TraceToLogsOptionsV2, tags: string, customQuery?: string) {
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
  if (filterByTraceID && span.traceID) {
    lsql += ' or "${__span.traceId}"';
  }

  if (filterBySpanID && span.spanID) {
    lsql += ' or "${__span.spanId}"';
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
function getQueryForVictoriaLogs(span: TraceSpan, options: TraceToLogsOptionsV2, tags: string, customQuery?: string) {
  const { filterByTraceID, filterBySpanID } = options;

  // Custom user query has priority
  if (customQuery) {
    return {
      expr: customQuery,
      refId: '',
    };
  }

  const parts: string[] = [];

  if (filterBySpanID && span.spanID) {
    parts.push('span_id:="${__span.spanId}"');
  }
  if (filterByTraceID && span.traceID) {
    parts.push('trace_id:="${__span.traceId}"');
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
