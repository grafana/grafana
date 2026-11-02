import { act, getWrapper, renderHook } from 'test/test-utils';

import { type NavModelItem } from '@grafana/data';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { NavID } from 'app/core/navtree/constants';
import { configureStore } from 'app/store/configureStore';

import { useDashboardsPageNav } from './useDashboardsPageNav';

const INFO_ARCH_REFRESH_FLAG = 'grafana.navigationInfoArchRefresh';

// The section as the nav tree builds it, with the pages that become tabs
const dashboardsSection: NavModelItem = {
  id: NavID.dashboards,
  text: 'Dashboards',
  url: '/dashboards',
  children: [
    { id: 'dashboards/playlists', text: 'Playlists', url: '/playlists' },
    { id: NavID.dashboardsLibraryPanels, text: 'Library panels', url: '/library-panels' },
    { id: NavID.dashboardsVariables, text: 'Variables', url: '/dashboards/variables' },
    { id: NavID.dashboardsRecentlyDeleted, text: 'Recently deleted', url: '/dashboard/recently-deleted' },
  ],
};

function renderNav(
  activeId: string,
  section: NavModelItem | null = dashboardsSection,
  currentPageId: string = activeId
) {
  const store = configureStore({ navIndex: section ? { [section.id!]: section } : {} });
  return renderHook(() => useDashboardsPageNav(activeId, currentPageId), { wrapper: getWrapper({ store }) });
}

describe('useDashboardsPageNav', () => {
  // setTestFlags fires OpenFeature events that update mounted hooks, and RTL's
  // cleanup runs after this, so the reset has to be wrapped
  afterEach(async () => {
    await act(async () => {
      setTestFlags({});
    });
  });

  it('gives no tab bar while the information architecture refresh is off', () => {
    setTestFlags({ [INFO_ARCH_REFRESH_FLAG]: false });

    expect(renderNav(NavID.dashboards).result.current).toBeUndefined();
  });

  it('lists the dashboards tab first, then the pages that moved out of the menu', () => {
    setTestFlags({ [INFO_ARCH_REFRESH_FLAG]: true });

    const tabs = renderNav(NavID.dashboards).result.current?.children ?? [];

    // Playlists stays in the menu, so it is not a tab
    expect(tabs.map((tab) => tab.id)).toEqual([
      NavID.dashboards,
      NavID.dashboardsLibraryPanels,
      NavID.dashboardsVariables,
      NavID.dashboardsRecentlyDeleted,
    ]);
  });

  it('marks the page asking for the bar as the active tab', () => {
    setTestFlags({ [INFO_ARCH_REFRESH_FLAG]: true });

    const tabs = renderNav(NavID.dashboardsVariables).result.current?.children ?? [];

    expect(tabs.filter((tab) => tab.active).map((tab) => tab.id)).toEqual([NavID.dashboardsVariables]);
  });

  it('keeps Dashboards as the active first tab on the Starred page', () => {
    setTestFlags({ [INFO_ARCH_REFRESH_FLAG]: true });

    const pageNav = renderNav(NavID.dashboards, dashboardsSection, NavID.starred).result.current;
    const tabs = pageNav?.children ?? [];

    expect(tabs[0]).toMatchObject({ id: NavID.dashboards, text: 'Dashboards', active: true });
    expect(tabs.map((tab) => tab.id)).not.toContain(NavID.starred);
    expect(pageNav).toMatchObject({ hideFromBreadcrumbs: true, url: undefined });
  });

  it('only includes the synthetic page nav in breadcrumbs on the root Dashboards page', () => {
    setTestFlags({ [INFO_ARCH_REFRESH_FLAG]: true });

    expect(renderNav(NavID.dashboards).result.current?.hideFromBreadcrumbs).toBe(false);
    expect(renderNav(NavID.dashboardsVariables).result.current?.hideFromBreadcrumbs).toBe(true);
  });

  // The nav tree gates each page — Variables needs its own flag and variables:read
  // — so a page the user cannot reach is simply absent from the section
  it('leaves out a page the nav tree did not build', () => {
    setTestFlags({ [INFO_ARCH_REFRESH_FLAG]: true });
    const withoutVariables = {
      ...dashboardsSection,
      children: dashboardsSection.children?.filter((child) => child.id !== NavID.dashboardsVariables),
    };

    const tabs = renderNav(NavID.dashboards, withoutVariables).result.current?.children ?? [];

    expect(tabs.map((tab) => tab.id)).not.toContain(NavID.dashboardsVariables);
  });

  it('gives no tab bar when the section itself is missing', () => {
    setTestFlags({ [INFO_ARCH_REFRESH_FLAG]: true });

    expect(renderNav(NavID.dashboards, null).result.current).toBeUndefined();
  });
});
