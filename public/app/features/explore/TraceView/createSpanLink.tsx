import { SpanLinks } from '@jaegertracing/jaeger-ui-components/src/types/links';
import React from 'react';

import {
  DataFrame,
  DataLink,
  DataQuery,
  DataSourceInstanceSettings,
  DataSourceJsonData,
  dateTime,
  Field,
  KeyValue,
  LinkModel,
  mapInternalLinkToExplore,
  rangeUtil,
  ScopedVars,
  SplitOpen,
  TimeRange,
} from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { Icon } from '@grafana/ui';
import { SpanLinkFunc, Trace, TraceSpan } from '@jaegertracing/jaeger-ui-components';
import { TraceToLogsOptionsV2 } from 'app/core/components/TraceToLogs/TraceToLogsSettings';
import { TraceToMetricQuery, TraceToMetricsOptions } from 'app/core/components/TraceToMetrics/TraceToMetricsSettings';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { PromQuery } from 'app/plugins/datasource/prometheus/types';

import { LokiQuery } from '../../../plugins/datasource/loki/types';
import { getFieldLinksForExplore } from '../utils/links';

/**
 * This is a factory for the link creator. It returns the function mainly so it can return undefined in which case
 * the trace view won't create any links and to capture the datasource and split function making it easier to memoize
 * with useMemo.
 */
export function createSpanLinkFactory({
  splitOpenFn,
  traceToLogsOptions,
  traceToMetricsOptions,
  dataFrame,
  createFocusSpanLink,
  trace,
}: {
  splitOpenFn: SplitOpen;
  traceToLogsOptions?: TraceToLogsOptionsV2;
  traceToMetricsOptions?: TraceToMetricsOptions;
  dataFrame?: DataFrame;
  createFocusSpanLink?: (traceId: string, spanId: string) => LinkModel<Field>;
  trace: Trace;
}): SpanLinkFunc | undefined {
  let scopedVars = scopedVarsFromTrace(trace);

  if (!dataFrame || dataFrame.fields.length === 1 || !dataFrame.fields.some((f) => Boolean(f.config.links?.length))) {
    // if the dataframe contains just a single blob of data (legacy format) or does not have any links configured,
    // let's try to use the old legacy path.
    // TODO: This was mainly a backward compatibility thing but at this point can probably be removed.
    return legacyCreateSpanLinkFactory(
      splitOpenFn,
      traceToLogsOptions,
      traceToMetricsOptions,
      createFocusSpanLink,
      scopedVars
    );
  } else {
    return function SpanLink(span: TraceSpan): SpanLinks | undefined {
      scopedVars = {
        ...scopedVars,
        ...scopedVarsFromSpan(span),
      };
      // We should be here only if there are some links in the dataframe
      const field = dataFrame.fields.find((f) => Boolean(f.config.links?.length))!;
      try {
        const links = getFieldLinksForExplore({
          field,
          rowIndex: span.dataFrameRowIndex!,
          splitOpenFn,
          range: getTimeRangeFromSpan(span),
          dataFrame,
          vars: scopedVars,
        });

        return {
          logLinks: [
            {
              href: links[0].href,
              onClick: links[0].onClick,
              content: <Icon name="gf-logs" title="Explore the logs for this in split view" />,
            },
          ],
        };
      } catch (error) {
        // It's fairly easy to crash here for example if data source defines wrong interpolation in the data link
        console.error(error);
        return undefined;
      }
    };
  }
}

/**
 * Default keys to use when there are no configured tags.
 */
const defaultKeys = ['cluster', 'hostname', 'namespace', 'pod'].map((k) => ({ key: k }));

function legacyCreateSpanLinkFactory(
  splitOpenFn: SplitOpen,
  traceToLogsOptions?: TraceToLogsOptionsV2,
  traceToMetricsOptions?: TraceToMetricsOptions,
  createFocusSpanLink?: (traceId: string, spanId: string) => LinkModel<Field>,
  scopedVars?: ScopedVars
) {
  let logsDataSourceSettings: DataSourceInstanceSettings<DataSourceJsonData> | undefined;
  if (traceToLogsOptions?.datasourceUid) {
    logsDataSourceSettings = getDatasourceSrv().getInstanceSettings(traceToLogsOptions.datasourceUid);
  }
  const isSplunkDS = logsDataSourceSettings?.type === 'grafana-splunk-datasource';

  let metricsDataSourceSettings: DataSourceInstanceSettings<DataSourceJsonData> | undefined;
  if (traceToMetricsOptions?.datasourceUid) {
    metricsDataSourceSettings = getDatasourceSrv().getInstanceSettings(traceToMetricsOptions.datasourceUid);
  }

  return function SpanLink(span: TraceSpan): SpanLinks {
    scopedVars = {
      ...scopedVars,
      ...scopedVarsFromSpan(span),
    };
    const links: SpanLinks = { traceLinks: [] };
    let query: DataQuery | undefined;
    let tags = '';

    // TODO: This should eventually move into specific data sources and added to the data frame as we no longer use the
    //  deprecated blob format and we can map the link easily in data frame.
    if (logsDataSourceSettings && traceToLogsOptions) {
      const customQuery = traceToLogsOptions.customQuery ? traceToLogsOptions.query : undefined;
      switch (logsDataSourceSettings?.type) {
        case 'loki':
          tags = getFormattedTags(span, traceToLogsOptions.tags || defaultKeys);
          query = getQueryForLoki(span, traceToLogsOptions, tags, customQuery);
          break;
        case 'grafana-splunk-datasource':
          tags = getFormattedTags(span, traceToLogsOptions.tags || defaultKeys, { joinBy: ' ' });
          query = getQueryForSplunk(span, traceToLogsOptions, tags, customQuery);
          break;
        case 'elasticsearch':
        case 'grafana-opensearch-datasource':
          tags = getFormattedTags(span, traceToLogsOptions.tags || [], { labelValueSign: ':', joinBy: ' AND ' });
          query = getQueryForElasticsearchOrOpensearch(span, traceToLogsOptions, tags, customQuery);
          break;
      }

      if (query) {
        const dataLink: DataLink = {
          title: logsDataSourceSettings.name,
          url: '',
          internal: {
            datasourceUid: logsDataSourceSettings.uid,
            datasourceName: logsDataSourceSettings.name,
            query,
          },
        };

        scopedVars = {
          ...scopedVars,
          __tags: {
            text: 'Tags',
            value: tags,
          },
        };

        const link = mapInternalLinkToExplore({
          link: dataLink,
          internalLink: dataLink.internal!,
          scopedVars: scopedVars,
          range: getTimeRangeFromSpan(
            span,
            {
              startMs: traceToLogsOptions.spanStartTimeShift
                ? rangeUtil.intervalToMs(traceToLogsOptions.spanStartTimeShift)
                : 0,
              endMs: traceToLogsOptions.spanEndTimeShift
                ? rangeUtil.intervalToMs(traceToLogsOptions.spanEndTimeShift)
                : 0,
            },
            isSplunkDS
          ),
          field: {} as Field,
          onClickFn: splitOpenFn,
          replaceVariables: getTemplateSrv().replace.bind(getTemplateSrv()),
        });

        links.logLinks = [
          {
            href: link.href,
            onClick: link.onClick,
            content: <Icon name="gf-logs" title="Explore the logs for this in split view" />,
          },
        ];
      }
    }

    // Get metrics links
    if (metricsDataSourceSettings && traceToMetricsOptions?.queries) {
      links.metricLinks = [];
      for (const query of traceToMetricsOptions.queries) {
        const expr = buildMetricsQuery(query, traceToMetricsOptions?.tags, span);
        const dataLink: DataLink<PromQuery> = {
          title: metricsDataSourceSettings.name,
          url: '',
          internal: {
            datasourceUid: metricsDataSourceSettings.uid,
            datasourceName: metricsDataSourceSettings.name,
            query: {
              expr,
              refId: 'A',
            },
          },
        };

        const link = mapInternalLinkToExplore({
          link: dataLink,
          internalLink: dataLink.internal!,
          scopedVars: {},
          range: getTimeRangeFromSpan(span, {
            startMs: traceToMetricsOptions.spanStartTimeShift
              ? rangeUtil.intervalToMs(traceToMetricsOptions.spanStartTimeShift)
              : 0,
            endMs: traceToMetricsOptions.spanEndTimeShift
              ? rangeUtil.intervalToMs(traceToMetricsOptions.spanEndTimeShift)
              : 0,
          }),
          field: {} as Field,
          onClickFn: splitOpenFn,
          replaceVariables: getTemplateSrv().replace.bind(getTemplateSrv()),
        });

        links.metricLinks.push({
          title: query?.name,
          href: link.href,
          onClick: link.onClick,
          content: <Icon name="chart-line" title="Explore metrics for this span" />,
        });
      }
    }

    // Get trace links
    if (span.references && createFocusSpanLink) {
      for (const reference of span.references) {
        // Ignore parent-child links
        if (reference.refType === 'CHILD_OF') {
          continue;
        }

        const link = createFocusSpanLink(reference.traceID, reference.spanID);

        links.traceLinks!.push({
          href: link.href,
          title: reference.span ? reference.span.operationName : 'View linked span',
          content: <Icon name="link" title="View linked span" />,
          onClick: link.onClick,
        });
      }
    }

    if (span.subsidiarilyReferencedBy && createFocusSpanLink) {
      for (const reference of span.subsidiarilyReferencedBy) {
        const link = createFocusSpanLink(reference.traceID, reference.spanID);

        links.traceLinks!.push({
          href: link.href,
          title: reference.span ? reference.span.operationName : 'View linked span',
          content: <Icon name="link" title="View linked span" />,
          onClick: link.onClick,
        });
      }
    }

    return links;
  };
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

  let expr = `{$__tags}`;
  if (filterByTraceID && span.traceID) {
    expr += ` |="$__span.traceId"`;
  }
  if (filterBySpanID && span.spanID) {
    expr += ` |="$__span.id"`;
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

  let query = '';
  if (tags) {
    query += `$__tags`;
  }
  if (filterByTraceID && span.traceID) {
    query = `"$__span.traceId" AND ` + query;
  }
  if (filterBySpanID && span.spanID) {
    query = `"$__span.id" AND ` + query;
  }

  return {
    query: query,
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
    query += `$__tags`;
  }
  if (filterByTraceID && span.traceID) {
    query += ` "$__span.traceId"`;
  }
  if (filterBySpanID && span.spanID) {
    query += ` "$__span.id"`;
  }

  return {
    query: query,
    refId: '',
  };
}

/**
 * Creates a string representing all the tags already formatted for use in the query. The tags are filtered so that
 * only intersection of tags that exist in a span and tags that you want are serialized into the string.
 */
function getFormattedTags(
  span: TraceSpan,
  tags: Array<KeyValue<string>>,
  { labelValueSign = '=', joinBy = ', ' }: { labelValueSign?: string; joinBy?: string } = {}
) {
  // In order, try to use mapped tags -> tags -> default tags
  // Build tag portion of query
  return [...span.process.tags, ...span.tags]
    .map((tag) => {
      const keyValue = tags.find((keyValue: KeyValue) => keyValue.key === tag.key);
      if (keyValue) {
        return `${keyValue.value ? keyValue.value : keyValue.key}${labelValueSign}"${tag.value}"`;
      }
      return undefined;
    })
    .filter((v) => Boolean(v))
    .join(joinBy);
}

/**
 * Gets a time range from the span.
 */
function getTimeRangeFromSpan(
  span: TraceSpan,
  timeShift: { startMs: number; endMs: number } = { startMs: 0, endMs: 0 },
  isSplunkDS = false
): TimeRange {
  const adjustedStartTime = Math.floor(span.startTime / 1000 + timeShift.startMs);
  const from = dateTime(adjustedStartTime);
  const spanEndMs = (span.startTime + span.duration) / 1000;
  let adjustedEndTime = Math.floor(spanEndMs + timeShift.endMs);

  // Splunk requires a time interval of >= 1s, rather than >=1ms like Loki timerange in below elseif block
  if (isSplunkDS && adjustedEndTime - adjustedStartTime < 1000) {
    adjustedEndTime = adjustedStartTime + 1000;
  } else if (adjustedStartTime === adjustedEndTime) {
    // Because we can only pass milliseconds in the url we need to check if they equal.
    // We need end time to be later than start time
    adjustedEndTime++;
  }

  const to = dateTime(adjustedEndTime);

  // Beware that public/app/features/explore/state/main.ts SplitOpen fn uses the range from here. No matter what is in the url.
  return {
    from,
    to,
    raw: {
      from,
      to,
    },
  };
}

// Interpolates span attributes into trace to metric query, or returns default query
function buildMetricsQuery(query: TraceToMetricQuery, tags: Array<KeyValue<string>> = [], span: TraceSpan): string {
  if (!query.query) {
    return `histogram_quantile(0.5, sum(rate(tempo_spanmetrics_latency_bucket{operation="${span.operationName}"}[5m])) by (le))`;
  }

  let expr = query.query;
  if (tags.length && expr.indexOf('$__tags') !== -1) {
    const spanTags = [...span.process.tags, ...span.tags];
    const labels = tags.reduce<string[]>((acc, tag) => {
      const tagValue = spanTags.find((t) => t.key === tag.key)?.value;
      if (tagValue) {
        acc.push(`${tag.value ? tag.value : tag.key}="${tagValue}"`);
      }
      return acc;
    }, []);

    const labelsQuery = labels?.join(', ');
    expr = expr.replace(/\$__tags/g, labelsQuery);
  }

  return expr;
}

function scopedVarsFromTrace(trace: Trace): ScopedVars {
  return {
    __trace: {
      text: 'Trace',
      value: {
        duration: trace.duration,
        name: trace.traceName,
        id: trace.traceID,
      },
    },
  };
}

function scopedVarsFromSpan(span: TraceSpan): ScopedVars {
  const tags: ScopedVars = {};
  for (const tag of span.tags) {
    tags[tag.key] = tag.value;
  }
  return {
    __span: {
      text: 'Span',
      value: {
        id: span.spanID,
        duration: span.duration,
        name: span.operationName,
        tags: tags,
      },
    },
  };
}
