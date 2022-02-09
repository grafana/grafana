import {
  DataFrame,
  DataLink,
  dateTime,
  Field,
  mapInternalLinkToExplore,
  rangeUtil,
  SplitOpen,
  TimeRange,
} from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { Icon } from '@grafana/ui';
import { SpanLinkDef, SpanLinkFunc, TraceSpan } from '@jaegertracing/jaeger-ui-components';
import { TraceToLogsOptions } from 'app/core/components/TraceToLogsSettings';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import React from 'react';
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
  dataFrame,
}: {
  splitOpenFn: SplitOpen;
  traceToLogsOptions?: TraceToLogsOptions;
  dataFrame?: DataFrame;
}): SpanLinkFunc | undefined {
  if (!dataFrame || dataFrame.fields.length === 1 || !dataFrame.fields.some((f) => Boolean(f.config.links?.length))) {
    // if the dataframe contains just a single blob of data (legacy format) or does not have any links configured,
    // let's try to use the old legacy path.
    return legacyCreateSpanLinkFactory(splitOpenFn, traceToLogsOptions);
  } else {
    return function SpanLink(span: TraceSpan): SpanLinkDef | undefined {
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

function legacyCreateSpanLinkFactory(splitOpenFn: SplitOpen, traceToLogsOptions?: TraceToLogsOptions) {
  // We should return if dataSourceUid is undefined otherwise getInstanceSettings would return testDataSource.
  if (!traceToLogsOptions?.datasourceUid) {
    return undefined;
  }

  const dataSourceSettings = getDatasourceSrv().getInstanceSettings(traceToLogsOptions.datasourceUid);

  if (!dataSourceSettings) {
    return undefined;
  }

  return function SpanLink(span: TraceSpan): SpanLinkDef {
    // This is reusing existing code from derived fields which may not be ideal match so some data is a bit faked at
    // the moment. Issue is that the trace itself isn't clearly mapped to dataFrame (right now it's just a json blob
    // inside a single field) so the dataLinks as config of that dataFrame abstraction breaks down a bit and we do
    // it manually here instead of leaving it for the data source to supply the config.

    const dataLink: DataLink<LokiQuery> = {
      title: dataSourceSettings.name,
      url: '',
      internal: {
        datasourceUid: dataSourceSettings.uid,
        datasourceName: dataSourceSettings.name,
        query: {
          expr: getLokiQueryFromSpan(span, traceToLogsOptions),
          refId: '',
        },
      },
    };

    const link = mapInternalLinkToExplore({
      link: dataLink,
      internalLink: dataLink.internal!,
      scopedVars: {},
      range: getTimeRangeFromSpan(span, {
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

function getLokiQueryFromSpan(span: TraceSpan, options: TraceToLogsOptions): string {
  const { tags: keys, filterByTraceID, filterBySpanID } = options;
  const keysToCheck = keys?.length ? keys : defaultKeys;
  const tags = [...span.process.tags, ...span.tags].reduce((acc, tag) => {
    if (keysToCheck.includes(tag.key)) {
      acc.push(`${tag.key}="${tag.value}"`);
    }
    return acc;
  }, [] as string[]);

  let query = `{${tags.join(', ')}}`;

  if (filterByTraceID && span.traceID) {
    query += ` |="${span.traceID}"`;
  }
  if (filterBySpanID && span.spanID) {
    query += ` |="${span.spanID}"`;
  }

  return query;
}

/**
 * Gets a time range from the span.
 */
function getTimeRangeFromSpan(
  span: TraceSpan,
  timeShift: { startMs: number; endMs: number } = { startMs: 0, endMs: 0 }
): TimeRange {
  const adjustedStartTime = Math.floor(span.startTime / 1000 + timeShift.startMs);
  const from = dateTime(adjustedStartTime);
  const spanEndMs = (span.startTime + span.duration) / 1000;
  let adjustedEndTime = Math.floor(spanEndMs + timeShift.endMs);

  // Because we can only pass milliseconds in the url we need to check if they equal.
  // We need end time to be later than start time
  if (adjustedStartTime === adjustedEndTime) {
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
