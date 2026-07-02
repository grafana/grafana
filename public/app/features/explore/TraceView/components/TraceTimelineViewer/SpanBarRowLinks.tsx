import { useEffect, useMemo, useState } from "react";
import { lastValueFrom } from "rxjs";

import { CoreApp, type DataQuery, type DataQueryRequest, type TimeRange } from "@grafana/data";
import { getDataSourceSrv } from "@grafana/runtime";

import { type SpanLinkDef, SpanLinkType, type SpanLinkFunc } from "../types/links";
import { type TraceSpan } from "../types/trace";

import { SpanLinksMenu } from "./SpanLinks";

interface Props {
  color: string;
  createSpanLink: SpanLinkFunc;
  datasourceType: string;
  span: TraceSpan;
}

// Caches whether logs exist for a given Loki query + time range so the same query is not run twice.
const lokiLogsExistenceCache = new Map<string, Promise<boolean>>();

function getCacheKey(query: DataQuery, timeRange: TimeRange): string {
  return `${query.datasource?.uid}|${JSON.stringify(query)}|${timeRange.from.valueOf()}-${timeRange.to.valueOf()}`;
}

async function queryLokiLogsExist(query: DataQuery, timeRange: TimeRange): Promise<boolean> {
  const uid = query.datasource?.uid;
  if (!uid) {
    return false;
  }

  const datasource = await getDataSourceSrv().get(uid);
  const request: DataQueryRequest = {
    requestId: 'span-bar-row-loki-logs-check',
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

  const response = await lastValueFrom(datasource.query(request));
  return response.data?.some((frame) => frame.length > 0) ?? false;
}

function lokiLogsExist(query: DataQuery, timeRange: TimeRange): Promise<boolean> {
  const key = getCacheKey(query, timeRange);
  let existence = lokiLogsExistenceCache.get(key);
  if (!existence) {
    existence = queryLokiLogsExist(query, timeRange).catch(() => false);
    lokiLogsExistenceCache.set(key, existence);
  }
  return existence;
}

export const SpanBarRowLinks = ({ color, createSpanLink, datasourceType, span }: Props) => {
  const [displayedLinks, setDisplayedLinks] = useState<SpanLinkDef[]>([]);

  const links = useMemo(() => createSpanLink(span), [createSpanLink, span]);

  useEffect(() => {
    if (!links) {
      setDisplayedLinks([]);
      return;
    }

    let cancelled = false;

    const resolveDisplayedLinks = async () => {
      const resolved = await Promise.all(
        links.map(async (link) => {
          const query = link.linkModel?.interpolatedParams?.query;
          const timeRange = link.linkModel?.interpolatedParams?.timeRange;
          const datasourceUid = query?.datasource?.uid;
          const datasourceSettings = datasourceUid
            ? getDataSourceSrv().getInstanceSettings(datasourceUid)
            : undefined;
          const isLoki = link.type === SpanLinkType.Logs && datasourceSettings?.type === 'loki';

          // Non-Loki links are always displayed.
          if (!isLoki || !query || !timeRange) {
            return link;
          }

          // For Loki links, only display the link if the logs actually exist.
          const exists = await lokiLogsExist(query, timeRange);
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
}
