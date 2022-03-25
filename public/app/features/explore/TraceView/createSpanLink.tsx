import {
  DataFrame,
  DataLink,
  DataQuery,
  dateTime,
  Field,
  KeyValue,
  mapInternalLinkToExplore,
  rangeUtil,
  SplitOpen,
  TimeRange,
} from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { Icon } from '@grafana/ui';
import { SpanLinkDef, SpanLinkFunc, TraceSpan } from '@jaegertracing/jaeger-ui-components';
import { TraceToLogsOptions } from 'app/core/components/TraceToLogs/TraceToLogsSettings';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import React from 'react';
import { LokiQuery } from '../../../plugins/datasource/loki/types';
import { getFieldLinksForExplore } from '../utils/links';

const splunkUID = 'PD90232BAD06BE469';
/**
 * This is a factory for the link creator. It returns the function mainly so it can return undefined in which case
 * the trace view won't create any links and to capture the datasource and split function making it easier to memoize
 * with useMemo.
 */
export function createSpanLinkFactory({
  splitOpenFn,
  traceToLogsOptions,
  dataFrame,
}: {
  splitOpenFn: SplitOpen;
  traceToLogsOptions?: TraceToLogsOptions;
  dataFrame?: DataFrame;
}): SpanLinkFunc | undefined {
  const isSplunkDS = !!(traceToLogsOptions?.datasourceUid === splunkUID);

  if (!dataFrame || dataFrame.fields.length === 1 || !dataFrame.fields.some((f) => Boolean(f.config.links?.length))) {
    // if the dataframe contains just a single blob of data (legacy format) or does not have any links configured,
    // let's try to use the old legacy path.
    return legacyCreateSpanLinkFactory(splitOpenFn, isSplunkDS, traceToLogsOptions);
  } else {
    return function SpanLink(span: TraceSpan): SpanLinkDef | undefined {
      // We should be here only if there are some links in the dataframe
      const field = dataFrame.fields.find((f) => Boolean(f.config.links?.length))!;
      try {
        const links = getFieldLinksForExplore({
          field,
          rowIndex: span.dataFrameRowIndex!,
          splitOpenFn,
          range: getTimeRangeFromSpan(span, isSplunkDS),
          dataFrame,
        });

        return {
          href: links[0].href,
          onClick: links[0].onClick,
          content: <Icon name="gf-logs" title="Explore the logs for this in split view" />,
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
  isSplunkDS: boolean,
  traceToLogsOptions?: TraceToLogsOptions
) {
  // We should return if dataSourceUid is undefined otherwise getInstanceSettings would return testDataSource.
  if (!traceToLogsOptions?.datasourceUid) {
    return undefined;
  }

  const dataSourceSettings = getDatasourceSrv().getInstanceSettings(traceToLogsOptions.datasourceUid);
  if (!dataSourceSettings) {
    return undefined;
  }

  return function SpanLink(span: TraceSpan): SpanLinkDef | undefined {
    // This is reusing existing code from derived fields which may not be ideal match so some data is a bit faked at
    // the moment. Issue is that the trace itself isn't clearly mapped to dataFrame (right now it's just a json blob
    // inside a single field) so the dataLinks as config of that dataFrame abstraction breaks down a bit and we do
    // it manually here instead of leaving it for the data source to supply the config.
    const query = getQueryFromSpan(span, isSplunkDS, traceToLogsOptions);
    if (!query && !isSplunkDS) {
      return undefined;
    }

    const dataLink: DataLink<LokiQuery | DataQuery> = {
      title: dataSourceSettings.name,
      url: '',
      internal: {
        datasourceUid: dataSourceSettings.uid,
        datasourceName: dataSourceSettings.name,
        query: {
          [isSplunkDS ? 'query' : 'expr']: query,
          refId: '',
        },
      },
    };

    const link = mapInternalLinkToExplore({
      link: dataLink,
      internalLink: dataLink.internal!,
      scopedVars: {},
      range: getTimeRangeFromSpan(span, isSplunkDS, {
        startMs: traceToLogsOptions.spanStartTimeShift
          ? rangeUtil.intervalToMs(traceToLogsOptions.spanStartTimeShift)
          : 0,
        endMs: traceToLogsOptions.spanEndTimeShift ? rangeUtil.intervalToMs(traceToLogsOptions.spanEndTimeShift) : 0,
      }),
      field: {} as Field,
      onClickFn: splitOpenFn,
      replaceVariables: getTemplateSrv().replace.bind(getTemplateSrv()),
    });

    return {
      href: link.href,
      onClick: link.onClick,
      content: <Icon name="gf-logs" title="Explore the logs for this in split view" />,
    };
  };
}

/**
 * Default keys to use when there are no configured tags.
 */
const defaultKeys = ['cluster', 'hostname', 'namespace', 'pod'];
function getQueryFromSpan(span: TraceSpan, isSplunkDS: boolean, options: TraceToLogsOptions): string | undefined {
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

  /** If no tags are found and it's a Loki query, return undefined to prevent
   * an invalid Loki query. However tags arent required for splunk queries.
   */
  if (!tags.length && !isSplunkDS) {
    return undefined;
  }

  let query = '';
  if (tags.length > 0) {
    if (!isSplunkDS) {
      query += `{${tags.join(', ')}}`;
    } else {
      query += `${tags.join(' ')}`;
    }
  }

  if (filterByTraceID && span.traceID && !isSplunkDS) {
    query += ` |="${span.traceID}"`;
  } else if (filterByTraceID && span.traceID && isSplunkDS) {
    query += ` TraceID=${span.traceID}`;
  }
  if (filterBySpanID && span.spanID && !isSplunkDS) {
    query += ` |="${span.spanID}"`;
  } else if (filterBySpanID && span.spanID && isSplunkDS) {
    query += ` SpanID=${span.spanID}`;
  }

  return query;
}

/**
 * Gets a time range from the span.
 */
function getTimeRangeFromSpan(
  span: TraceSpan,
  isSplunkDS: boolean,
  timeShift: { startMs: number; endMs: number } = { startMs: 0, endMs: 0 }
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
