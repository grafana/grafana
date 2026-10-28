import { useMemo } from 'react';

import { type NavModelItem } from '@grafana/data';
import { useFlagGrafanaNavigationInfoArchRefresh } from '@grafana/runtime/internal';
import { DASHBOARDS_TAB_NAV_IDS, NavID } from 'app/core/navtree/constants';
import { useSelector } from 'app/types/store';

/**
 * The tab bar shared by the dashboard list and the Dashboards pages beside it,
 * or undefined while the information architecture refresh is off, which leaves
 * every page as it was.
 *
 * The tabs are taken from the nav tree rather than declared here: those items
 * already carry their own gates — Variables needs its feature flag and
 * variables:read, Library panels a signed-in user — and a second copy of those
 * rules would drift from the first. An item the user cannot see is simply
 * missing from the section, so it is missing from the bar.
 *
 * Only the root list takes this. A folder has its own tabs, from useNavModel.
 */
export function useDashboardsPageNav(activeId: string): NavModelItem | undefined {
  const isInfoArchRefresh = useFlagGrafanaNavigationInfoArchRefresh();
  const section = useSelector((state) => state.navIndex[NavID.dashboards]);

  return useMemo(() => {
    if (!isInfoArchRefresh || !section) {
      return undefined;
    }

    // The list is the section itself, so its tab is the one that has to be made
    const listTab: NavModelItem = { id: NavID.dashboards, text: section.text, url: '/dashboards', icon: 'apps' };
    const tabs = [listTab, ...DASHBOARDS_TAB_NAV_IDS.map((id) => section.children?.find((child) => child.id === id))]
      .filter((tab) => tab !== undefined)
      .map((tab) => ({ ...tab, active: tab.id === activeId }));

    // The section is already the breadcrumb, so the page must not add it again
    return { ...section, hideFromBreadcrumbs: true, children: tabs };
  }, [activeId, isInfoArchRefresh, section]);
}
