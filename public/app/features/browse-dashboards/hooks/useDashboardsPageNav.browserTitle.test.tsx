import { act, render, waitFor } from 'test/test-utils';

import { type NavIndex, type NavModelItem } from '@grafana/data';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { Page } from 'app/core/components/Page/Page';
import { type NavId, NavID } from 'app/core/navtree/constants';

import { useDashboardsPageNav } from './useDashboardsPageNav';

const dashboardsSection: NavModelItem = {
  id: NavID.dashboards,
  text: 'Dashboards',
  url: '/dashboards',
  children: [
    { id: NavID.dashboardsLibraryPanels, text: 'Library panels', url: '/library-panels' },
    { id: NavID.dashboardsVariables, text: 'Variables', url: '/dashboards/variables' },
    { id: NavID.dashboardsRecentlyDeleted, text: 'Recently deleted', url: '/dashboard/recently-deleted' },
  ],
};

function buildNavIndex(): NavIndex {
  const home: NavModelItem = { id: 'home', text: 'Home', url: '/' };
  const section: NavModelItem = {
    ...dashboardsSection,
    parentItem: home,
    children: dashboardsSection.children?.map((child) => ({ ...child })),
  };
  const starred: NavModelItem = {
    id: NavID.starred,
    text: 'Starred',
    url: '/dashboards?starred',
    parentItem: home,
  };
  home.children = [section, starred];

  return {
    home,
    [NavID.dashboards]: section,
    [NavID.starred]: starred,
  };
}

function PageHarness({ activeId, navId, pageId }: { activeId: NavId; navId: NavId; pageId?: NavId }) {
  const pageNav = useDashboardsPageNav(activeId, pageId);
  return (
    <Page navId={navId} pageNav={pageNav}>
      <Page.Contents>{null}</Page.Contents>
    </Page>
  );
}

describe('dashboard page browser titles', () => {
  afterEach(async () => {
    await act(async () => {
      setTestFlags({});
    });
  });

  it.each([
    [NavID.dashboards, NavID.dashboards, undefined, 'Dashboards - Grafana'],
    [NavID.dashboards, NavID.starred, NavID.starred, 'Starred - Grafana'],
    [NavID.dashboardsLibraryPanels, NavID.dashboardsLibraryPanels, undefined, 'Library panels - Dashboards - Grafana'],
    [NavID.dashboardsVariables, NavID.dashboardsVariables, undefined, 'Variables - Dashboards - Grafana'],
    [
      NavID.dashboardsRecentlyDeleted,
      NavID.dashboardsRecentlyDeleted,
      undefined,
      'Recently deleted - Dashboards - Grafana',
    ],
  ])('sets the title for active tab %s on page %s', async (activeId, navId, pageId, expectedTitle) => {
    setTestFlags({ 'grafana.navigationInfoArchRefresh': true });

    render(<PageHarness activeId={activeId} navId={navId} pageId={pageId} />, {
      preloadedState: { navIndex: buildNavIndex() },
    });

    await waitFor(() => expect(document.title).toBe(expectedTitle));
  });
});
