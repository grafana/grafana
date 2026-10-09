import { dateMath, dateTime, type DateTime, ISO_8601, locationUtil, type NavModelItem, rangeUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type BadgeColor } from '@grafana/ui';
import { findByUrl } from 'app/core/components/AppChrome/MegaMenu/utils';
import { type PageHistoryEntry, type PageHistoryKind } from 'app/core/services/pageHistory/types';
import { type ExplorePaneDescription } from 'app/features/explore/utils/describeExplorePanes';
import { type DashboardQueryResult, type LocationInfo } from 'app/features/search/service/types';
import { VARIABLE_PREFIX } from 'app/features/variables/constants';

/** Every kind, in the order the filter and the rows present them. */
export const PAGE_KINDS: readonly PageHistoryKind[] = ['dashboard', 'explore', 'alerting', 'app'];

export type PageKindCounts = Record<PageHistoryKind, number>;

export function countByKind(items: ReadonlyArray<{ kind: PageHistoryKind }>): PageKindCounts {
  const counts: PageKindCounts = { dashboard: 0, explore: 0, alerting: 0, app: 0 };
  for (const { kind } of items) {
    counts[kind]++;
  }
  return counts;
}

type EntryOf<K extends PageHistoryKind> = Extract<PageHistoryEntry, { kind: K }>;

/**
 * A history entry plus what needs an async lookup to show it: the search hit that proved the user can
 * still see a dashboard (title, folder), or the datasource names and query text of an Explore page.
 * Formatting happens at render time, in {@link toRow}.
 */
export type RecentActivityItem =
  | (EntryOf<'dashboard'> & { dashboard: DashboardQueryResult })
  | (EntryOf<'explore'> & { panes: ExplorePaneDescription[] })
  | EntryOf<'alerting' | 'app'>;

interface PageKindMeta {
  /** Plural, for the kind filter. */
  filterLabel: string;
  /** Singular, for the row badge. */
  badge: string;
  color: BadgeColor;
}

export function getPageKindMeta(kind: PageHistoryKind): PageKindMeta {
  switch (kind) {
    case 'dashboard':
      return {
        filterLabel: t('home.recent-activity-tab.filter-dashboards', 'Dashboards'),
        badge: t('home.recent-activity-tab.kind-dashboard', 'Dashboard'),
        color: 'blue',
      };
    case 'explore':
      return {
        filterLabel: t('home.recent-activity-tab.filter-explore', 'Explore'),
        badge: t('home.recent-activity-tab.kind-explore', 'Explore'),
        color: 'orange',
      };
    case 'alerting':
      return {
        filterLabel: t('home.recent-activity-tab.filter-alerting', 'Alerting'),
        badge: t('home.recent-activity-tab.kind-alerting', 'Alerting'),
        color: 'red',
      };
    case 'app':
      return {
        filterLabel: t('home.recent-activity-tab.filter-apps', 'Apps'),
        badge: t('home.recent-activity-tab.kind-app', 'App'),
        color: 'purple',
      };
  }
}

const SEPARATOR = ' · ';
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
  // Relative expressions stay text so the quick-range names apply. Absolute values (epoch ms, or the ISO 8601
  // the dashboard scene writes) must become DateTime first, otherwise describeTimeRange echoes them raw.
  const toRawTime = (value: string): string | DateTime => {
    if (dateMath.isMathString(value)) {
      return value;
    }
    const parsed = /^\d+$/.test(value) ? dateTime(Number(value)) : dateTime(value, ISO_8601);
    return parsed.isValid() ? parsed : value;
  };
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

export interface Row {
  title: string;
  /** What the link restores (folder and time range, datasource and query, filters); absent when there is nothing to say. */
  subtitle: string | undefined;
}

function row(title: string, details: Array<string | undefined>): Row {
  return { title, subtitle: details.filter(Boolean).join(SEPARATOR) || undefined };
}

/** The badge already names the area, so a shown path drops its `/alerting` or `/a` prefix. */
const AREA_PREFIX = { alerting: /^\/alerting\/?/, app: /^\/a\/?/ };

/** Everything a row says about one visited page. */
export function toRow(
  item: RecentActivityItem,
  navTree: NavModelItem[],
  foldersByUid: Record<string, LocationInfo>
): Row {
  switch (item.kind) {
    case 'dashboard':
      return row(item.dashboard.name, [
        foldersByUid[item.dashboard.location]?.name,
        describeDashboardState(item.search),
      ]);
    case 'explore':
      return row(t('home.recent-activity-tab.kind-explore', 'Explore'), [describeExploreState(item.panes)]);
    case 'alerting':
    case 'app': {
      // Pages in the nav tree use their nav label. Deep links use the title the page set, which
      // often is just the section's ("Incidents" for every incident), so the path tells them apart.
      const navTitle = getNavTitle(navTree, item.pathname);
      const title = navTitle ?? item.title ?? item.pathname;
      const showPath = !navTitle && title !== item.pathname;
      return row(title, [
        showPath ? item.pathname.replace(AREA_PREFIX[item.kind], '') : undefined,
        describeAppState(item.search),
      ]);
    }
  }
}
