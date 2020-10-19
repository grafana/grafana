import React from 'react';
import { config, getDataSourceSrv, getTemplateSrv } from '@grafana/runtime';
import { DataLink, dateTime, Field, mapInternalLinkToExplore, TimeRange, TraceSpan } from '@grafana/data';
import { LokiQuery } from '../../../plugins/datasource/loki/types';
import { Icon } from '@grafana/ui';

/**
 * This is a factory for the link creator. It returns the function mainly so it can return undefined in which case
 * the trace view won't create any links and to capture the datasource and split function making it easier to memoize
 * with useMemo.
 */
export function createSpanLinkFactory(splitOpenFn: (options: { datasourceUid: string; query: any }) => void) {
  if (!config.featureToggles.traceToLogs) {
    return undefined;
  }

  // Right now just hardcoded for first loki DS we can find
  const lokiDs = getDataSourceSrv()
    .getExternal()
    .find(ds => ds.meta.id === 'loki');

  if (!lokiDs) {
    return undefined;
  }

  return function(span: TraceSpan): { href: string; onClick?: (event: any) => void; content: React.ReactNode } {
    // This is reusing existing code from derived fields which may not be ideal match so some data is a bit faked at
    // the moment. Issue is that the trace itself isn't clearly mapped to dataFrame (right now it's just a json blob
    // inside a single field) so the dataLinks as config of that dataFrame abstraction breaks down a bit and we do
    // it manually here instead of leaving it for the data source to supply the config.

    const dataLink: DataLink<LokiQuery> = {
      title: lokiDs.name,
      url: '',
      internal: {
        datasourceUid: lokiDs.uid,
        query: {
          expr: getLokiQueryFromSpan(span),
          refId: '',
        },
      },
    };
    const link = mapInternalLinkToExplore(dataLink, {}, getTimeRangeFromSpan(span), {} as Field, {
      onClickFn: splitOpenFn,
      replaceVariables: getTemplateSrv().replace.bind(getTemplateSrv()),
      getDataSourceSettingsByUid: getDataSourceSrv().getDataSourceSettingsByUid.bind(getDataSourceSrv()),
    });
    return {
      href: link.href,
      onClick: link.onClick,
      content: <Icon name="file-alt" title="Show logs" />,
    };
  };
}

/**
 * Right now this is just hardcoded and later will probably be part of some user configuration.
 */
const allowedKeys = ['cluster', 'hostname', 'namespace', 'pod'];

function getLokiQueryFromSpan(span: TraceSpan): string {
  const tags = span.process.tags.reduce((acc, tag) => {
    if (allowedKeys.includes(tag.key)) {
      acc.push(`${tag.key}="${tag.value}"`);
    }
    return acc;
  }, [] as string[]);
  return `{${tags.join(', ')}}`;
}

/**
 * Gets a time range from the span. Naively this could be just start and end time of the span but we also want some
 * buffer around that just so we do not miss some logs which may not have timestamps aligned with the span. Right
 * now the buffers are hardcoded which may be a bit weird for very short spans but at the same time, fractional buffers
 * with very short spans could mean microseconds and that could miss some logs relevant to that spans. In the future
 * something more intelligent should probably be implemented
 */
function getTimeRangeFromSpan(span: TraceSpan): TimeRange {
  const from = dateTime(span.startTime / 1000 - 1000 * 60 * 60);
  const spanEndMs = (span.startTime + span.duration) / 1000;
  const to = dateTime(spanEndMs + 5 * 1000);

  return {
    from,
    to,
    // Weirdly Explore does not handle ISO string which would have been the default stringification if passed as object
    // and we have to use this custom format :( .
    raw: {
      from: from.utc().format('YYYYMMDDTHHmmss'),
      to: to.utc().format('YYYYMMDDTHHmmss'),
    },
  };
}
