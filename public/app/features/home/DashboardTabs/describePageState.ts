import { dateTime, type ExploreUrlState, locationUtil, type NavModelItem, rangeUtil, urlUtil } from '@grafana/data';
import { getDataSourceInstanceSettings } from '@grafana/runtime/unstable';
import { findByUrl } from 'app/core/components/AppChrome/MegaMenu/utils';
import { isRecord } from 'app/core/utils/isRecord';
import { parseURL } from 'app/features/explore/hooks/useStateSync/parseURL';
import { VARIABLE_PREFIX } from 'app/features/variables/constants';

export const SEPARATOR = ' · ';
/** Rendered through the time range (or not meaningful to show) rather than as `key=value`. */
const HIDDEN_PARAMS = ['from', 'to', 'orgId', 'timezone', 'schemaVersion', 'returnTo'];
/** Datasource-specific query text fields, most common first (Prometheus/Loki, Elastic/Tempo, SQL, Graphite, CloudWatch). */
const QUERY_TEXT_FIELDS = ['expr', 'query', 'rawSql', 'target', 'expression'] as const;

interface PageParams {
  range: string;
  /** `name=a, b` per `var-` key, URL order. */
  vars: string[];
  /** `key=a, b` for every other key, URL order. */
  others: string[];
}

function collectParams(search: string): PageParams {
  const params = new URLSearchParams(search);
  const from = params.get('from');
  const to = params.get('to');
  // The URL's own timezone keeps the subtitle consistent with what the restored view shows.
  const timeZone = params.get('timezone') || undefined;
  // Epoch-ms strings must become DateTime first, otherwise describeTimeRange echoes the raw numbers.
  const toRawTime = (value: string) => (/^\d+$/.test(value) ? dateTime(Number(value)) : value);
  const range = from && to ? rangeUtil.describeTimeRange({ from: toRawTime(from), to: toRawTime(to) }, timeZone) : '';

  const vars = new Map<string, string[]>();
  const others = new Map<string, string[]>();
  for (const [key, value] of params) {
    if (!value) {
      continue;
    }
    if (key.startsWith(VARIABLE_PREFIX)) {
      const name = key.slice(VARIABLE_PREFIX.length);
      vars.set(name, [...(vars.get(name) ?? []), value]);
    } else if (!HIDDEN_PARAMS.includes(key)) {
      others.set(key, [...(others.get(key) ?? []), value]);
    }
  }

  const format = (map: Map<string, string[]>) => [...map].map(([key, values]) => `${key}=${values.join(', ')}`);
  return { range, vars: format(vars), others: format(others) };
}

/** Time range and variables, e.g. `Last 90 days · Plugin=finnhub`. */
export function describeDashboardState(search: string): string {
  const { range, vars } = collectParams(search);
  return [range, ...vars].filter(Boolean).join(SEPARATOR);
}

/** Time range, variables and every other filter, e.g. `search=state:firing · view=list`. */
export function describeAppState(search: string): string {
  const { range, vars, others } = collectParams(search);
  return [range, ...vars, ...others].filter(Boolean).join(SEPARATOR);
}

function getQueryText(query: unknown): string {
  if (!isRecord(query)) {
    return '';
  }
  for (const field of QUERY_TEXT_FIELDS) {
    const value = query[field];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return '';
}

async function describePane(pane: ExploreUrlState): Promise<string> {
  const dsName = pane.datasource
    ? ((await getDataSourceInstanceSettings(pane.datasource))?.name ?? pane.datasource)
    : '';
  // The v1 migrator keeps `null` query elements and the v0 parser can keep a non-array `queries`.
  const queries: unknown[] = Array.isArray(pane.queries) ? pane.queries : [];
  const queryText = queries.map(getQueryText).filter(Boolean).join('; ');
  return [dsName, queryText].filter(Boolean).join(SEPARATOR);
}

/** Datasource and query per pane, e.g. `Ops Logs · {service_name="api"}`. Never throws: stored hrefs are runtime input. */
export async function describeExploreState(search: string): Promise<string> {
  try {
    const [url] = parseURL(urlUtil.parseKeyValue(search.replace(/^\?/, '')));
    const panes = await Promise.all(Object.values(url.panes).map(describePane));
    return panes.filter(Boolean).join(' | ');
  } catch {
    // parseURL indexes migrators by schemaVersion unchecked; an unknown version is a TypeError.
    return '';
  }
}

/** Nav label for an exact nav-tree url match; deep links return undefined. */
export function getNavTitle(navTree: NavModelItem[], pathname: string): string | undefined {
  return findByUrl(navTree, locationUtil.assureBaseUrl(pathname))?.text;
}
