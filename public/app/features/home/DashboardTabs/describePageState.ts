import { dateTime, locationUtil, type NavModelItem, rangeUtil } from '@grafana/data';
import { findByUrl } from 'app/core/components/AppChrome/MegaMenu/utils';
import { type ExplorePaneDescription } from 'app/features/explore/utils/describeExplorePanes';
import { VARIABLE_PREFIX } from 'app/features/variables/constants';

export const SEPARATOR = ' · ';
/** Rendered through the time range (or not meaningful to show) rather than as `key=value`. */
const HIDDEN_PARAMS = ['from', 'to', 'orgId', 'timezone', 'schemaVersion', 'returnTo'];

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

/** Datasource and queries per pane, panes separated by ` | `, e.g. `Ops Logs · {service_name="api"}`. */
export function describeExploreState(panes: ExplorePaneDescription[]): string {
  return panes
    .map(({ datasource, queries }) => [datasource, queries.join('; ')].filter(Boolean).join(SEPARATOR))
    .filter(Boolean)
    .join(' | ');
}

/** Nav label for an exact nav-tree url match; deep links return undefined. */
export function getNavTitle(navTree: NavModelItem[], pathname: string): string | undefined {
  return findByUrl(navTree, locationUtil.assureBaseUrl(pathname))?.text;
}
