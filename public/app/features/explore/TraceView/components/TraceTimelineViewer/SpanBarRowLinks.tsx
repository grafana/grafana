import { memo, useEffect, useMemo, useState } from 'react';
import { isObservable, lastValueFrom } from 'rxjs';

import { CoreApp, type DataQuery, type DataQueryRequest, type TimeRange } from '@grafana/data';
import { getDataSourceInstance } from '@grafana/runtime/unstable';
import { type TimeZone } from '@grafana/schema';

import { type SpanLinkDef, SpanLinkType, type SpanLinkFunc } from '../types/links';
import { type TraceSpan } from '../types/trace';

import { SpanLinksMenu } from './SpanLinks';

interface Props {
  color: string;
  createSpanLink: SpanLinkFunc;
  datasourceType: string;
  span: TraceSpan;
  timeZone: TimeZone;
}

export const SpanBarRowLinks = memo(({ color, createSpanLink, datasourceType, span }: Props) => {
  const [displayedLinks, setDisplayedLinks] = useState<SpanLinkDef[]>([]);

  const links = useMemo(() => createSpanLink(span), [createSpanLink, span]);

  useEffect(() => {
    if (!links) {
      return;
    }

    setDisplayedLinks(links.filter((link) => link.type !== SpanLinkType.Logs));

    let cancelled = false;

    const resolveDisplayedLinks = async () => {
      const resolved = await Promise.all(
        links.map(async (link) => {
          const query = link.linkModel?.interpolatedParams?.query;
          const timeRange = link.linkModel?.interpolatedParams?.timeRange;
          const isLogsLink = link.type === SpanLinkType.Logs;

          // Non-logs links are always displayed.
          if (!isLogsLink || !query || !timeRange) {
            return link;
          }

          const exists = await logsExist(query, timeRange);
          return exists ? link : undefined;
        })
      );

      if (!cancelled) {
        setDisplayedLinks(resolved.filter((link): link is SpanLinkDef => Boolean(link)));
      }
    };

    resolveDisplayedLinks();

    return () => {
      cancelled = true;
    };
  }, [links]);

  if (!displayedLinks.length) {
    return null;
  }

  if (displayedLinks.length > 1) {
    return <SpanLinksMenu links={displayedLinks} datasourceType={datasourceType} color={color} />;
  }

  return (
    <a
      href={displayedLinks[0].href}
      // Needs to have target otherwise preventDefault would not work due to angularRouter.
      target={'_blank'}
      style={{
        borderBottom: `2px solid ${color}CF`,
        paddingInline: '4px',
      }}
      rel="noopener noreferrer"
      onClick={
        displayedLinks[0].onClick
          ? (event) => {
              if (!(event.ctrlKey || event.metaKey || event.shiftKey) && displayedLinks[0].onClick) {
                event.preventDefault();
                displayedLinks[0].onClick(event);
              }
            }
          : undefined
      }
    >
      {displayedLinks[0].content}
    </a>
  );
});

SpanBarRowLinks.displayName = 'SpanBarRowLinks';

const lokiLogsExistenceCache = new Map<string, Promise<boolean>>();

function getCacheKey(query: DataQuery, timeRange: TimeRange): string {
  return `${query.datasource?.uid}|${JSON.stringify(query)}|${timeRange.from.valueOf()}-${timeRange.to.valueOf()}`;
}

async function queryLogs(query: DataQuery, timeRange: TimeRange): Promise<boolean> {
  const uid = query.datasource?.uid;
  // Show the link by default
  if (!uid) {
    return true;
  }

  const datasource = await getDataSourceInstance(uid);
  const request: DataQueryRequest = {
    requestId: 'traces-view-related-logs-' + Math.random(),
    interval: '',
    intervalMs: 0,
    maxDataPoints: 1,
    range: timeRange,
    scopedVars: {},
    app: CoreApp.Unknown,
    timezone: 'browser',
    startTime: Date.now(),
    targets: [{ ...query, refId: query.refId || 'A' }],
  };
  const executedQuery = datasource.query(request);

  const response = isObservable(executedQuery) ? await lastValueFrom(executedQuery) : await executedQuery;
  return response.data?.some((frame) => frame.length > 0) ?? false;
}

function logsExist(query: DataQuery, timeRange: TimeRange): Promise<boolean> {
  const key = getCacheKey(query, timeRange);
  let existence = lokiLogsExistenceCache.get(key);
  if (existence === undefined) {
    existence = queryLogs(query, timeRange).catch(() => false);
    lokiLogsExistenceCache.set(key, existence);
  }
  return existence;
}
