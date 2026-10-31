import { act, getWrapper, renderHook } from 'test/test-utils';

import { type NavModelItem } from '@grafana/data';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { configureStore } from 'app/store/configureStore';

import { useDashboardsPageNav } from './useDashboardsPageNav';

const INFO_ARCH_REFRESH_FLAG = 'grafana.navigationInfoArchRefresh';

// The section as the nav tree builds it, with the pages that become tabs
const dashboardsSection: NavModelItem = {
  id: 'dashboards/browse',
  text: 'Dashboards',
  url: '/dashboards',
  children: [
    { id: 'dashboards/playlists', text: 'Playlists', url: '/playlists' },
    { id: 'dashboards/library-panels', text: 'Library panels', url: '/library-panels' },
    { id: 'dashboards/variables', text: 'Variables', url: '/dashboards/variables' },
    { id: 'dashboards/recently-deleted', text: 'Recently deleted', url: '/dashboard/recently-deleted' },
  ],
};

function render(activeId: string, section: NavModelItem | null = dashboardsSection) {
  const store = configureStore({ navIndex: section ? { [section.id!]: section } : {} });
  return renderHook(() => useDashboardsPageNav(activeId), { wrapper: getWrapper({ store }) });
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

    expect(render('dashboards/browse').result.current).toBeUndefined();
  });

  it('lists the dashboards tab first, then the pages that moved out of the menu', () => {
    setTestFlags({ [INFO_ARCH_REFRESH_FLAG]: true });

    const tabs = render('dashboards/browse').result.current?.children ?? [];

    // Playlists stays in the menu, so it is not a tab
    expect(tabs.map((tab) => tab.id)).toEqual([
      'dashboards/browse',
      'dashboards/library-panels',
      'dashboards/variables',
      'dashboards/recently-deleted',
    ]);
  });

  it('marks the page asking for the bar as the active tab', () => {
    setTestFlags({ [INFO_ARCH_REFRESH_FLAG]: true });

    const tabs = render('dashboards/variables').result.current?.children ?? [];

    expect(tabs.filter((tab) => tab.active).map((tab) => tab.id)).toEqual(['dashboards/variables']);
  });

  // The nav tree gates each page — Variables needs its own flag and variables:read
  // — so a page the user cannot reach is simply absent from the section
  it('leaves out a page the nav tree did not build', () => {
    setTestFlags({ [INFO_ARCH_REFRESH_FLAG]: true });
    const withoutVariables = {
      ...dashboardsSection,
      children: dashboardsSection.children?.filter((child) => child.id !== 'dashboards/variables'),
    };

    const tabs = render('dashboards/browse', withoutVariables).result.current?.children ?? [];

    expect(tabs.map((tab) => tab.id)).not.toContain('dashboards/variables');
  });

  it('gives no tab bar when the section itself is missing', () => {
    setTestFlags({ [INFO_ARCH_REFRESH_FLAG]: true });

    expect(render('dashboards/browse', null).result.current).toBeUndefined();
  });
});
