import { useMemo } from 'react';

import { type NavModelItem } from '@grafana/data';
import { useFlagGrafanaNavigationInfoArchRefresh } from '@grafana/runtime/internal';
import { DASHBOARDS_TAB_NAV_IDS, type NavId, NavID } from 'app/core/navtree/constants';
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
 * Dashboard-level pages take this. A folder has its own tabs, from useNavModel.
 */
export function useDashboardsPageNav(activeTabId: NavId, pageId: NavId = NavID.dashboards): NavModelItem | undefined {
  const isInfoArchRefresh = useFlagGrafanaNavigationInfoArchRefresh();
  const section = useSelector((state) => state.navIndex[NavID.dashboards]);
  const page = useSelector((state) => state.navIndex[pageId]);

  return useMemo(() => {
    if (!isInfoArchRefresh || !section || !page) {
      return undefined;
    }

    const tabItems = [
      section,
      ...DASHBOARDS_TAB_NAV_IDS.map((id) => section.children?.find((child) => child.id === id)),
    ].filter((tab): tab is NavModelItem => tab !== undefined);
    const activeTab = tabItems.find((tab) => tab.id === activeTabId);
    const tabs = tabItems.map(({ id, text, url, icon }) => ({
      id,
      text,
      url,
      icon,
      active: id === activeTabId,
    }));

    return {
      ...page,
      subTitle: pageId === NavID.dashboards ? activeTab?.subTitle : page.subTitle,
      children: tabs.length > 1 ? tabs : undefined,
    };
  }, [activeTabId, isInfoArchRefresh, page, pageId, section]);
}
