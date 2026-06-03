import { type NavModelItem } from '@grafana/data';

export type JobRoleNavPreference =
  | 'default'
  | 'sre'
  | 'data-analyst'
  | 'incident-responder'
  | 'platform-engineer'
  | 'application-developer'
  | 'database-engineer'
  | 'nathan';

type FilteredJobRoleNavPreference = Exclude<JobRoleNavPreference, 'default' | 'nathan'>;

const sharedNavIds = new Set(['home', 'bookmarks', 'starred', 'profile', 'help']);

const jobRoleAllowedNavIds: Record<FilteredJobRoleNavPreference, Set<string>> = {
  sre: new Set([
    ...sharedNavIds,
    'plugin-page-grafana-assistant-app',
    'dashboards/browse',
    'explore',
    'drilldown',
    'alerting',
    'alerts-and-incidents',
    'adaptive-telemetry',
    'testing-and-synthetics',
    'observability',
    'connections',
    'apps',
  ]),
  'data-analyst': new Set([
    ...sharedNavIds,
    'plugin-page-grafana-assistant-app',
    'dashboards/browse',
    'explore',
    'drilldown',
    'plugin-page-grafana-ml-app',
    'plugin-page-grafana-cmab-app',
    'connections',
    'apps',
  ]),
  'incident-responder': new Set([
    ...sharedNavIds,
    'dashboards/browse',
    'explore',
    'drilldown',
    'plugin-page-grafana-assistant-app',
    'alerts-and-incidents',
    'observability',
  ]),
  'platform-engineer': new Set([
    ...sharedNavIds,
    'dashboards/browse',
    'explore',
    'drilldown',
    'adaptive-telemetry',
    'testing-and-synthetics',
    'plugin-page-grafana-k8s-app',
    'plugin-page-grafana-csp-app',
    'connections',
    'cfg',
  ]),
  'application-developer': new Set([
    ...sharedNavIds,
    'dashboards/browse',
    'explore',
    'drilldown',
    'plugin-page-grafana-assistant-app',
    'plugin-page-grafana-synthetic-monitoring-app',
    'plugin-page-grafana-kowalski-app',
    'plugin-page-grafana-app-observability-app',
    'plugin-page-grafana-dbo11y-app',
  ]),
  'database-engineer': new Set([
    ...sharedNavIds,
    'dashboards/browse',
    'explore',
    'plugin-page-grafana-sqldrilldown-app',
    'alerting',
    'plugin-page-grafana-dbo11y-app',
    'connections',
    'plugin-page-grafana-dssql-app',
    'cfg/plugins',
  ]),
};

export function filterNavTreeByJobRole(navTree: NavModelItem[], jobRole?: string): NavModelItem[] {
  if (!jobRole || jobRole === 'default' || !isFilteredJobRole(jobRole)) {
    return navTree;
  }

  const allowedIds = jobRoleAllowedNavIds[jobRole];
  return filterNavItems(navTree, allowedIds);
}

function isFilteredJobRole(jobRole: string): jobRole is FilteredJobRoleNavPreference {
  return jobRole in jobRoleAllowedNavIds;
}

function filterNavItems(navItems: NavModelItem[], allowedIds: Set<string>): NavModelItem[] {
  return navItems.reduce<NavModelItem[]>((items, item) => {
    const children = item.children ? filterNavItems(item.children, allowedIds) : undefined;
    const isAllowed = isAllowedNavItem(item, allowedIds);

    if (isAllowed) {
      items.push(item);
      return items;
    }

    if (!children?.length) {
      return items;
    }

    items.push(...children.map(clearParentItem));

    return items;
  }, []);
}

function clearParentItem(item: NavModelItem): NavModelItem {
  return {
    ...item,
    parentItem: undefined,
  };
}

function isAllowedNavItem(item: NavModelItem, allowedIds: Set<string>): boolean {
  if (!item.id) {
    return false;
  }

  return allowedIds.has(item.id);
}
