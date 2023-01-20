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
  SplitOpen,
  TimeRange,
} from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { Icon } from '@grafana/ui';
import { SpanLinkFunc, TraceSpan } from '@jaegertracing/jaeger-ui-components';
import { TraceToLogsOptions } from 'app/core/components/TraceToLogs/TraceToLogsSettings';
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
}: {
  splitOpenFn: SplitOpen;
  traceToLogsOptions?: TraceToLogsOptions;
  traceToMetricsOptions?: TraceToMetricsOptions;
  dataFrame?: DataFrame;
  createFocusSpanLink?: (traceId: string, spanId: string) => LinkModel<Field>;
}): SpanLinkFunc | undefined {
  if (!dataFrame || dataFrame.fields.length === 1 || !dataFrame.fields.some((f) => Boolean(f.config.links?.length))) {
    // if the dataframe contains just a single blob of data (legacy format) or does not have any links configured,
    // let's try to use the old legacy path.
    return legacyCreateSpanLinkFactory(splitOpenFn, traceToLogsOptions, traceToMetricsOptions, createFocusSpanLink);
  } else {
    return function SpanLink(span: TraceSpan): SpanLinks | undefined {
      // We should be here only if there are some links in the dataframe
      const field = dataFrame.fields.find((f) => Boolean(f.config.links?.length))!;
      try {
        const links = getFieldLinksForExplore({
          field,
          rowIndex: span.dataFrameRowIndex!,
          splitOpenFn,
          range: getTimeRangeFromSpan(span),
          dataFrame,
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

function legacyCreateSpanLinkFactory(
  splitOpenFn: SplitOpen,
  traceToLogsOptions?: TraceToLogsOptions,
  traceToMetricsOptions?: TraceToMetricsOptions,
  createFocusSpanLink?: (traceId: string, spanId: string) => LinkModel<Field>
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
    const links: SpanLinks = { traceLinks: [] };
    // This is reusing existing code from derived fields which may not be ideal match so some data is a bit faked at
    // the moment. Issue is that the trace itself isn't clearly mapped to dataFrame (right now it's just a json blob
    // inside a single field) so the dataLinks as config of that dataFrame abstraction breaks down a bit and we do
    // it manually here instead of leaving it for the data source to supply the config.
    let dataLink: DataLink | undefined;

    // Get logs link
    if (logsDataSourceSettings && traceToLogsOptions) {
      switch (logsDataSourceSettings?.type) {
        case 'loki':
          dataLink = getLinkForLoki(span, traceToLogsOptions, logsDataSourceSettings);
          break;
        case 'grafana-splunk-datasource':
          dataLink = getLinkForSplunk(span, traceToLogsOptions, logsDataSourceSettings);
          break;
        case 'elasticsearch':
          dataLink = getLinkForElasticsearchOrOpensearch(span, traceToLogsOptions, logsDataSourceSettings);
          break;
        case 'grafana-opensearch-datasource':
          dataLink = getLinkForElasticsearchOrOpensearch(span, traceToLogsOptions, logsDataSourceSettings);
          break;
      }

      if (dataLink) {
        const link = mapInternalLinkToExplore({
          link: dataLink,
          internalLink: dataLink.internal!,
          scopedVars: {},
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

/**
 * Default keys to use when there are no configured tags.
 */
const defaultKeys = ['cluster', 'hostname', 'namespace', 'pod'];
function getLinkForLoki(span: TraceSpan, options: TraceToLogsOptions, dataSourceSettings: DataSourceInstanceSettings) {
  const { tags: keys, filterByTraceID, filterBySpanID, mapTagNamesEnabled, mappedTags } = options;

  // In order, try to use mapped tags -> tags -> default tags
  const keysToCheck = mapTagNamesEnabled && mappedTags?.length ? mappedTags : keys?.length ? keys : defaultKeys;
  // Build tag portion of query
  const tags = [...span.process.tags, ...span.tags].reduce((acc, tag) => {
    if (mapTagNamesEnabled) {
      const keyValue = (keysToCheck as KeyValue[]).find((keyValue: KeyValue) => keyValue.key === tag.key);
      if (keyValue) {
        acc.push(`${keyValue.value ? keyValue.value : keyValue.key}="${tag.value}"`);
      }
    } else {
      if ((keysToCheck as string[]).includes(tag.key)) {
        acc.push(`${tag.key}="${tag.value}"`);
      }
    }
    return acc;
  }, [] as string[]);

  // If no tags found, return undefined to prevent an invalid Loki query
  if (!tags.length) {
    return undefined;
  }
  let expr = `{${tags.join(', ')}}`;
  if (filterByTraceID && span.traceID) {
    expr += ` |="${span.traceID}"`;
  }
  if (filterBySpanID && span.spanID) {
    expr += ` |="${span.spanID}"`;
  }

  const dataLink: DataLink<LokiQuery> = {
    title: dataSourceSettings.name,
    url: '',
    internal: {
      datasourceUid: dataSourceSettings.uid,
      datasourceName: dataSourceSettings.name,
      query: {
        expr: expr,
        refId: '',
      },
    },
  };

  return dataLink;
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

function getLinkForElasticsearchOrOpensearch(
  span: TraceSpan,
  options: TraceToLogsOptions,
  dataSourceSettings: DataSourceInstanceSettings
) {
  const { tags: keys, filterByTraceID, filterBySpanID, mapTagNamesEnabled, mappedTags } = options;
  const tags = [...span.process.tags, ...span.tags].reduce((acc: string[], tag) => {
    if (mapTagNamesEnabled && mappedTags?.length) {
      const keysToCheck = mappedTags;
      const keyValue = keysToCheck.find((keyValue) => keyValue.key === tag.key);
      if (keyValue) {
        acc.push(`${keyValue.value ? keyValue.value : keyValue.key}:"${tag.value}"`);
      }
    } else {
      const keysToCheck = keys?.length ? keys : defaultKeys;
      if (keysToCheck.includes(tag.key)) {
        acc.push(`${tag.key}:"${tag.value}"`);
      }
    }
    return acc;
  }, []);

  let queryArr = [];
  if (filterBySpanID && span.spanID) {
    queryArr.push(`"${span.spanID}"`);
  }

  if (filterByTraceID && span.traceID) {
    queryArr.push(`"${span.traceID}"`);
  }

  if (tags.length > 0) {
    for (const tag of tags) {
      queryArr.push(tag);
    }
  }

  const dataLink: DataLink<ElasticsearchOrOpensearchQuery> = {
    title: dataSourceSettings.name,
    url: '',
    internal: {
      datasourceUid: dataSourceSettings.uid,
      datasourceName: dataSourceSettings.name,
      query: {
        query: queryArr.join(' AND '),
        refId: '',
        metrics: [
          {
            id: '1',
            type: 'logs',
          },
        ],
      },
    },
  };

  return dataLink;
}

function getLinkForSplunk(
  span: TraceSpan,
  options: TraceToLogsOptions,
  dataSourceSettings: DataSourceInstanceSettings
) {
  const { tags: keys, filterByTraceID, filterBySpanID, mapTagNamesEnabled, mappedTags } = options;

  // In order, try to use mapped tags -> tags -> default tags
  const keysToCheck = mapTagNamesEnabled && mappedTags?.length ? mappedTags : keys?.length ? keys : defaultKeys;
  // Build tag portion of query
  const tags = [...span.process.tags, ...span.tags].reduce((acc, tag) => {
    if (mapTagNamesEnabled) {
      const keyValue = (keysToCheck as KeyValue[]).find((keyValue: KeyValue) => keyValue.key === tag.key);
      if (keyValue) {
        acc.push(`${keyValue.value ? keyValue.value : keyValue.key}="${tag.value}"`);
      }
    } else {
      if ((keysToCheck as string[]).includes(tag.key)) {
        acc.push(`${tag.key}="${tag.value}"`);
      }
    }
    return acc;
  }, [] as string[]);

  let query = '';
  if (tags.length > 0) {
    query += `${tags.join(' ')}`;
  }
  if (filterByTraceID && span.traceID) {
    query += ` "${span.traceID}"`;
  }
  if (filterBySpanID && span.spanID) {
    query += ` "${span.spanID}"`;
  }

  const dataLink: DataLink<DataQuery> = {
    title: dataSourceSettings.name,
    url: '',
    internal: {
      datasourceUid: dataSourceSettings.uid,
      datasourceName: dataSourceSettings.name,
      query: {
        query: query,
        refId: '',
      },
    },
  } as DataLink<DataQuery>;

  return dataLink;
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
    const labels = tags.reduce((acc, tag) => {
      const tagValue = spanTags.find((t) => t.key === tag.key)?.value;
      if (tagValue) {
        acc.push(`${tag.value ? tag.value : tag.key}="${tagValue}"`);
      }
      return acc;
    }, [] as string[]);

    const labelsQuery = labels?.join(', ');
    expr = expr.replace(/\$__tags/g, labelsQuery);
  }

  return expr;
}
