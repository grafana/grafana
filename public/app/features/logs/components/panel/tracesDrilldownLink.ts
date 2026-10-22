import {
  type DataQuery,
  type LinkModel,
  locationUtil,
  type PluginExtensionLink,
  type RawTimeRange,
  textUtil,
} from '@grafana/data';
import { t } from '@grafana/i18n';

import { getTraceIdFromTempoQuery } from './links';

const TRACES_DRILLDOWN_APP_ID = 'grafana-exploretraces-app';

export function isExploreTempoTraceLink(link: LinkModel): boolean {
  const query = link.interpolatedParams?.query;
  const traceQuery = query ? getTempoQueryText(query) : undefined;
  if (!query || !traceQuery || !isExploreHref(link.href) || query.queryType !== 'traceql') {
    return false;
  }
  return getTraceIdFromTempoQuery(traceQuery) !== undefined && Boolean(getDatasourceUid(query));
}

export function buildTracesDrilldownContext(
  link: LinkModel
): { targets: DataQuery[]; timeRange?: RawTimeRange } | undefined {
  const query = link.interpolatedParams?.query;
  if (!query || !isExploreTempoTraceLink(link)) {
    return undefined;
  }
  const uid = getDatasourceUid(query);
  if (!uid) {
    return undefined;
  }
  const rawRange = link.interpolatedParams?.timeRange?.raw;
  return {
    targets: [
      {
        ...query,
        datasource: {
          uid,
          type: 'tempo',
        },
      },
    ],
    ...(rawRange ? { timeRange: rawRange } : {}),
  };
}

export function resolveTracesDrilldownLinks<T extends LinkModel>(
  links: readonly T[],
  extensionLinks: PluginExtensionLink[]
): readonly T[] {
  const extension = extensionLinks.find((item) => item.pluginId === TRACES_DRILLDOWN_APP_ID && item.path);
  const path = extension?.path;
  if (!extension || !path) {
    return links;
  }

  const sourceUid = getDatasourceUid(links.find(isExploreTempoTraceLink)?.interpolatedParams?.query);
  if (!sourceUid) {
    return links;
  }

  return links.map((link) => (isExploreTempoTraceLink(link) ? rewriteExploreTraceLink(link, path, sourceUid) : link));
}

function rewriteExploreTraceLink<T extends LinkModel>(link: T, path: string, datasourceUid: string): T {
  const query = link.interpolatedParams?.query;
  const traceQuery = query ? getTempoQueryText(query) : undefined;
  const traceId = traceQuery ? getTraceIdFromTempoQuery(traceQuery) : undefined;
  if (!traceId || getDatasourceUid(query) !== datasourceUid) {
    return link;
  }

  // The toolbar extension opens the exploration. traceId opens that specific trace instead of Explore.
  const href = textUtil.sanitizeUrl(locationUtil.assureBaseUrl(appendTraceId(path, traceId)));
  if (!href) {
    return link;
  }

  return {
    ...link,
    href,
    title: t('logs.log-line-details.view-in-traces-drilldown', 'View in Traces Drilldown'),
    target: '_blank',
    onClick: undefined,
  };
}

export function appendTraceId(path: string, traceId: string): string {
  const url = new URL(path, window.location.origin);
  url.searchParams.set('traceId', traceId);
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return url.toString();
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

function isExploreHref(href: string): boolean {
  try {
    const path = new URL(href, window.location.origin).pathname.replace(/\/+$/, '');
    return path === '/explore' || path.endsWith('/explore');
  } catch {
    return false;
  }
}

function getTempoQueryText(query: DataQuery): string | undefined {
  if (!hasTempoQuery(query)) {
    return undefined;
  }
  return query.query;
}

function hasTempoQuery(query: object): query is { query: string; queryType: unknown } {
  return 'query' in query && typeof query.query === 'string' && 'queryType' in query;
}

function getDatasourceUid(query: DataQuery | undefined): string | undefined {
  return query?.datasource?.uid;
}
