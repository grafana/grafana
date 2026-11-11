import { type IconName, locationUtil, type NavModelItem, rangeUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { findNavByUrl } from 'app/core/navtree/utils';
import { PLUMBING_PARAMS } from 'app/core/services/pageHistory/hasNothingToResume';
import { type PageHistoryKind } from 'app/core/services/pageHistory/types';
import { parseUrlTime } from 'app/core/utils/timePicker';
import { type LocationInfo } from 'app/features/search/service/types';
import { VARIABLE_PREFIX } from 'app/features/variables/constants';

import { type RecentActivityItem } from './useRecentActivity';

interface PageKindMeta {
  /** Plural, for the kind filter. */
  filterLabel: string;
  /** Singular, for the row icon's tooltip. */
  badge: string;
  /** Row icon; nav-section icons where a kind has one, so the row reads like its menu entry. */
  icon: IconName;
}

export function getPageKindMeta(kind: PageHistoryKind): PageKindMeta {
  switch (kind) {
    case 'dashboard':
      return {
        filterLabel: t('home.recent-activity-tab.filter-dashboards', 'Dashboards'),
        badge: t('home.recent-activity-tab.kind-dashboard', 'Dashboard'),
        icon: 'apps',
      };
    case 'page':
      return {
        filterLabel: t('home.recent-activity-tab.filter-pages', 'Pages'),
        badge: t('home.recent-activity-tab.kind-page', 'Page'),
        icon: 'ai-sparkle',
      };
    case 'explore':
      return {
        filterLabel: t('home.recent-activity-tab.filter-explore', 'Explore'),
        badge: t('home.recent-activity-tab.kind-explore', 'Explore'),
        icon: 'compass',
      };
    case 'alerting':
      return {
        filterLabel: t('home.recent-activity-tab.filter-alerting', 'Alerting'),
        badge: t('home.recent-activity-tab.kind-alerting', 'Alerting'),
        icon: 'bell',
      };
    case 'app':
      return {
        filterLabel: t('home.recent-activity-tab.filter-apps', 'Apps'),
        badge: t('home.recent-activity-tab.kind-app', 'App'),
        icon: 'layer-group',
      };
  }
}

const SEPARATOR = ' · ';
/** Rendered through the time range, or plumbing, rather than as `key=value`. */
const HIDDEN_PARAMS = [...PLUMBING_PARAMS, 'from', 'to', 'timezone'];

interface PageParams {
  range: string;
  /** `name=a, b` per `var-` key, URL order. */
  vars: string[];
  /** `key=a, b` for every other key, URL order. */
  others: string[];
}

function collectParams(search: string): PageParams {
  const params = new URLSearchParams(search);
  // The URL's own timezone keeps the subtitle consistent with what the restored view shows.
  const timeZone = params.get('timezone') || undefined;
  const from = parseUrlTime(params.get('from') ?? '');
  const to = parseUrlTime(params.get('to') ?? '');
  const range = from && to ? rangeUtil.describeTimeRange({ from, to }, timeZone) : '';

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

export interface Row {
  title: string;
  /** What the link restores (folder and time range, datasource and query, filters); absent when there is nothing to say. */
  subtitle: string | undefined;
}

function row(title: string, details: Array<string | undefined>): Row {
  return { title, subtitle: details.filter(Boolean).join(SEPARATOR) || undefined };
}

/** Between the panes of a split Explore view, in both the title and the subtitle. */
const PANE_SEPARATOR = ' | ';
/** Holds a pane's slot in a line when that pane has nothing for it. */
const PANE_PLACEHOLDER = '—';

/**
 * One slot per pane, so the n-th query text sits under the n-th datasource whichever panes have either;
 * `undefined` when no pane has anything for the line.
 */
function joinPanes(slots: Array<string | undefined>): string | undefined {
  return slots.some(Boolean) ? slots.map((slot) => slot || PANE_PLACEHOLDER).join(PANE_SEPARATOR) : undefined;
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
    case 'dashboard': {
      // Time range and variables only; the other params (viewPanel, refresh) are not worth a line.
      const { range, vars } = collectParams(item.search);
      return row(item.dashboard.name, [foldersByUid[item.dashboard.location]?.name, range, ...vars]);
    }
    case 'explore': {
      // The datasource names the page, the query text is what it restores; "Explore" when no pane names one.
      const title = joinPanes(item.panes.map((pane) => pane.datasource)) ?? getPageKindMeta('explore').badge;
      return row(title, [joinPanes(item.panes.map((pane) => pane.queries.join('; ')))]);
    }
    case 'page': {
      // Without a title, the last path segment (the page's slug) is the most readable thing the URL has.
      const { range, vars, others } = collectParams(item.search);
      return row(item.title ?? item.pathname.slice(item.pathname.lastIndexOf('/') + 1), [range, ...vars, ...others]);
    }
    case 'alerting':
    case 'app': {
      // Pages in the nav tree use their nav label (matched by path; deep links have none). Deep links use the
      // title the page set, which often is just the section's ("Incidents" for every incident), so the path
      // tells them apart.
      const pathname = locationUtil.assureBaseUrl(item.pathname);
      const navTitle = findNavByUrl(navTree, (url) => url.split('?')[0] === pathname)?.text;
      const title = navTitle ?? item.title ?? item.pathname;
      const showPath = !navTitle && title !== item.pathname;
      const { range, vars, others } = collectParams(item.search);
      return row(title, [
        showPath ? item.pathname.replace(AREA_PREFIX[item.kind], '') : undefined,
        range,
        ...vars,
        ...others,
      ]);
    }
  }
}
