import { http, HttpResponse } from 'msw';
import { useEffect, type ReactNode } from 'react';
import { act, render, screen, within } from 'test/test-utils';

import { type DashboardHit } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { type ComponentTypeWithExtensionMeta, PluginExtensionPoints } from '@grafana/data';
import { config, reportInteraction, setBackendSrv } from '@grafana/runtime';
import { getCustomSearchHandler, searchRoute } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { setMockStarredDashboards, setTestFlags } from '@grafana/test-utils/unstable';
import { interceptLinkClicks } from 'app/core/navigation/patch/interceptLinkClicks';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { pageHistorySrv } from 'app/core/services/pageHistory/pageHistorySrv';
import { type PageHistoryEntry } from 'app/core/services/pageHistory/types';
import { createComponentWithMeta } from 'app/features/plugins/extensions/usePluginComponents';
import { AccessControlAction } from 'app/types/accessControl';

import { ctaClicked, tabChanged } from '../analytics/main';

import { DashboardTabs } from './DashboardTabs';
import { type HomepageTabExtensionProps } from './types';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));
jest.mock('../analytics/main', () => ({
  ctaClicked: jest.fn(),
  tabChanged: jest.fn(),
  clearHistoryClicked: jest.fn(),
  homepageViewed: jest.fn(),
}));
jest.mock('app/core/services/pageHistory/pageHistorySrv', () => ({
  pageHistorySrv: { getEntries: jest.fn() },
}));

setBackendSrv(backendSrv);
setupMockServer();

const impressionKey = `dashboard_impressions-${contextSrv.user.orgId}`;

function makeDashboardHit(overrides: Partial<DashboardHit> & { name: string; title: string }): DashboardHit {
  return {
    resource: 'dashboards',
    folder: 'general',
    field: {},
    ...overrides,
  };
}

const recentHits: DashboardHit[] = [
  makeDashboardHit({ name: 'recent-1', title: 'Recent Dashboard 1' }),
  makeDashboardHit({ name: 'recent-2', title: 'Recent Dashboard 2' }),
];

const starredHits: DashboardHit[] = [
  makeDashboardHit({ name: 'starred-1', title: 'Starred Dashboard 1' }),
  makeDashboardHit({ name: 'starred-2', title: 'Starred Dashboard 2' }),
  makeDashboardHit({ name: 'starred-3', title: 'Starred Dashboard 3' }),
];

const mostUsedHits: DashboardHit[] = [
  makeDashboardHit({ name: 'most-used-1', title: 'Most Used Dashboard 1', field: { views_last_30_days: 100 } }),
  makeDashboardHit({ name: 'most-used-2', title: 'Most Used Dashboard 2', field: { views_last_30_days: 50 } }),
  makeDashboardHit({ name: 'most-used-3', title: 'Most Used Dashboard 3', field: { views_last_30_days: null } }),
];

function seedRecent(uids: string[]) {
  window.localStorage.setItem(impressionKey, JSON.stringify(uids));
}

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.removeItem(impressionKey);
  setMockStarredDashboards([]);
  config.licenseInfo.enabledFeatures = {};
  // restoreAllMocks wipes the implementation, so the empty default must come back every test.
  jest.mocked(pageHistorySrv.getEntries).mockResolvedValue([]);
});

afterEach(async () => {
  // Wrap in act() because setTestFlags fires OpenFeature events that trigger React state updates.
  await act(async () => {
    setTestFlags({});
  });
  jest.restoreAllMocks();
});

const createDashboardTabsExtensionComponent = (
  pluginId: string,
  id: string,
  label: string,
  content: ReactNode,
  href?: string
): ComponentTypeWithExtensionMeta<HomepageTabExtensionProps> =>
  createComponentWithMeta(
    {
      pluginId,
      title: label,
      component: (({ register, active }: HomepageTabExtensionProps) => {
        useEffect(() => register({ id, label, href }), [register]);
        return active ? <div>{content}</div> : null;
      }) as React.ComponentType,
    },
    PluginExtensionPoints.HomepageTabs
    // createComponentWithMeta drops the props generic, narrow it back for the prop type
  ) as ComponentTypeWithExtensionMeta<HomepageTabExtensionProps>;

describe('DashboardTabs', () => {
  it('renders Recent tab as active by default and shows recent dashboards', async () => {
    seedRecent(['recent-1', 'recent-2']);
    server.use(getCustomSearchHandler([...recentHits, ...starredHits]));

    render(<DashboardTabs extensionComponents={[]} />);

    expect(await screen.findByRole('tab', { name: /recent/i, selected: true })).toBeInTheDocument();

    expect(await screen.findByText('Recent Dashboard 1')).toBeInTheDocument();
    expect(screen.getByText('Recent Dashboard 2')).toBeInTheDocument();
  });

  it('shows a loading skeleton until the initial fetches settle, then the tab bar', async () => {
    seedRecent(['recent-1', 'recent-2']);
    server.use(getCustomSearchHandler([...recentHits, ...starredHits]));

    render(<DashboardTabs extensionComponents={[]} />);

    // tab bar is hidden behind the skeleton until data lands
    expect(screen.getByTestId('dashboard-tabs-skeleton')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();

    expect(await screen.findByRole('tab', { name: /recent/i, selected: true })).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-tabs-skeleton')).not.toBeInTheDocument();
  });

  it('lands directly on Starred when Recent is empty, without flashing the Recent tab', async () => {
    // no recent seeded; starred has items (analytics off by default → no most-used tab)
    setMockStarredDashboards(['starred-1', 'starred-2', 'starred-3']);
    server.use(getCustomSearchHandler([...starredHits]));

    render(<DashboardTabs extensionComponents={[]} />);

    // the first tab bar shown is already on Starred — no Recent→Starred flip
    expect(await screen.findByRole('tab', { name: /starred/i, selected: true })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /recent/i })).toHaveAttribute('aria-selected', 'false');
  });

  it('switches to Starred tab and shows starred dashboards', async () => {
    setMockStarredDashboards(['starred-1', 'starred-2', 'starred-3']);
    server.use(getCustomSearchHandler([...recentHits, ...starredHits]));

    const { user } = render(<DashboardTabs extensionComponents={[]} />);

    await user.click(await screen.findByRole('tab', { name: /starred/i }));

    expect(screen.getByRole('tab', { name: /starred/i })).toHaveAttribute('aria-selected', 'true');

    expect(await screen.findByText('Starred Dashboard 1')).toBeInTheDocument();
    expect(screen.getByText('Starred Dashboard 2')).toBeInTheDocument();
    expect(screen.getByText('Starred Dashboard 3')).toBeInTheDocument();
  });

  it('shows empty state when no recent dashboards', async () => {
    render(<DashboardTabs extensionComponents={[]} />);

    expect(await screen.findByText("Dashboards you've recently viewed will appear here.")).toBeInTheDocument();
  });

  it('renders the compact empty Recent activity tab on the redesigned homepage', async () => {
    await act(async () => {
      setTestFlags({ 'grafana.growthHomepage': true });
    });

    render(<DashboardTabs extensionComponents={[]} />);

    expect(await screen.findByText('No recent activity yet. Pages you visit will show up here.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clear recent activity/i })).not.toBeInTheDocument();
  });

  it('shows empty state when no starred dashboards', async () => {
    setMockStarredDashboards([]);
    const { user } = render(<DashboardTabs extensionComponents={[]} />);

    await user.click(await screen.findByRole('tab', { name: /starred/i }));

    expect(await screen.findByText('Your starred dashboards will appear here.')).toBeInTheDocument();
  });

  it('stays on a manually selected empty tab instead of bouncing back', async () => {
    seedRecent(['recent-1', 'recent-2']);
    setMockStarredDashboards([]);
    server.use(getCustomSearchHandler([...recentHits]));

    const { user } = render(<DashboardTabs extensionComponents={[]} />);

    expect(await screen.findByRole('tab', { name: /recent/i, selected: true })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /starred/i }));

    expect(screen.getByRole('tab', { name: /starred/i })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('Your starred dashboards will appear here.')).toBeInTheDocument();
  });

  it('shows counter badges with correct counts', async () => {
    seedRecent(['recent-1', 'recent-2']);
    setMockStarredDashboards(['starred-1', 'starred-2', 'starred-3']);
    server.use(getCustomSearchHandler([...recentHits, ...starredHits]));

    render(<DashboardTabs extensionComponents={[]} />);

    expect(await screen.findByRole('tab', { name: /recent.*2/i })).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: /starred.*3/i })).toBeInTheDocument();
  });

  it('refetches starred dashboards when star is toggled', async () => {
    setMockStarredDashboards(['starred-1', 'starred-2', 'starred-3']);
    server.use(getCustomSearchHandler(starredHits));

    const { user } = render(<DashboardTabs extensionComponents={[]} />);

    await user.click(await screen.findByRole('tab', { name: /starred/i }));

    expect(await screen.findByText('Starred Dashboard 1')).toBeInTheDocument();
  });

  describe('Most used tab', () => {
    const allHits = [...recentHits, ...starredHits, ...mostUsedHits];

    it('renders Most used tab when analytics feature is enabled', async () => {
      config.licenseInfo.enabledFeatures = { analytics: true };
      seedRecent(['recent-1', 'recent-2']);
      server.use(getCustomSearchHandler(allHits));

      render(<DashboardTabs extensionComponents={[]} />);

      expect(await screen.findByRole('tab', { name: /most used/i })).toBeInTheDocument();
    });

    it('does not render Most used tab when analytics feature is disabled', async () => {
      config.licenseInfo.enabledFeatures = {};
      seedRecent(['recent-1', 'recent-2']);
      server.use(getCustomSearchHandler(allHits));

      render(<DashboardTabs extensionComponents={[]} />);

      expect(await screen.findByText('Recent Dashboard 1')).toBeInTheDocument();

      expect(screen.queryByRole('tab', { name: /most used/i })).not.toBeInTheDocument();
    });

    it('does not render dashboards with no views in the last 30 days', async () => {
      config.licenseInfo.enabledFeatures = { analytics: true };
      seedRecent(['recent-1', 'recent-2']);
      server.use(getCustomSearchHandler(allHits));

      const { user } = render(<DashboardTabs extensionComponents={[]} />);

      await user.click(await screen.findByRole('tab', { name: /most used/i }));

      expect(await screen.findByText('Most Used Dashboard 1')).toBeInTheDocument();
      expect(screen.queryByText('Most Used Dashboard 3')).not.toBeInTheDocument();
    });

    it('auto-switches to Most used when recent is empty and most-used has items', async () => {
      config.licenseInfo.enabledFeatures = { analytics: true };
      // No recent dashboards seeded
      server.use(getCustomSearchHandler(allHits));

      render(<DashboardTabs extensionComponents={[]} />);

      expect(await screen.findByRole('tab', { name: /most used/i, selected: true })).toBeInTheDocument();

      expect(await screen.findByText('Most Used Dashboard 1')).toBeInTheDocument();
      expect(screen.getByText('Most Used Dashboard 2')).toBeInTheDocument();
    });

    it('stays on Recent when recent has items even with most-used available', async () => {
      config.licenseInfo.enabledFeatures = { analytics: true };
      seedRecent(['recent-1', 'recent-2']);
      server.use(getCustomSearchHandler(allHits));

      render(<DashboardTabs extensionComponents={[]} />);

      expect(await screen.findByText('Recent Dashboard 1')).toBeInTheDocument();

      expect(screen.getByRole('tab', { name: /recent/i })).toHaveAttribute('aria-selected', 'true');
    });

    it('tracks a user click on the Most used tab', async () => {
      config.licenseInfo.enabledFeatures = { analytics: true };
      // recent non-empty keeps us on the Recent tab so the only tabChanged call comes from the click below
      seedRecent(['recent-1', 'recent-2']);
      server.use(getCustomSearchHandler(allHits));

      const { user } = render(<DashboardTabs extensionComponents={[]} />);

      await user.click(await screen.findByRole('tab', { name: /most used/i }));

      expect(jest.mocked(tabChanged)).toHaveBeenCalledWith({ tab: 'most-used' });
    });

    it('tracks clicks on a dashboard in the Most used tab', async () => {
      config.licenseInfo.enabledFeatures = { analytics: true };
      seedRecent(['recent-1', 'recent-2']);
      server.use(getCustomSearchHandler(allHits));

      const { user } = render(<DashboardTabs extensionComponents={[]} />);

      await user.click(await screen.findByRole('tab', { name: /most used/i }));
      await user.click(await screen.findByText('Most Used Dashboard 1'));

      expect(jest.mocked(reportInteraction)).toHaveBeenCalledWith(
        'grafana_browse_dashboards_page_click_list_item',
        expect.objectContaining({ source: 'homepage_mostUsedTab' })
      );
    });
  });
  it('renders extension tabs from plugins', async () => {
    const extensionComponents = [
      createDashboardTabsExtensionComponent(
        'grafana-setupguide-app',
        'tab-1',
        'Plugin Tab 1',
        <div>Content for Plugin Tab 1</div>
      ),
      createDashboardTabsExtensionComponent('grafana-setupguide-app', 'tab-2', 'Plugin Tab 2', null, '/test'),
      createDashboardTabsExtensionComponent(
        'grafana-untrusted-app',
        'tab-3',
        'Plugin Tab 3',
        <div>Content for Plugin Tab 3</div>
      ),
    ];

    const { user } = render(<DashboardTabs extensionComponents={extensionComponents} />);

    expect(await screen.findByRole('tab', { name: 'Plugin Tab 1' })).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: 'Plugin Tab 1', selected: true })).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: 'Plugin Tab 2' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Plugin Tab 3' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Plugin Tab 1' }));
    expect(await screen.findByText('Content for Plugin Tab 1')).toBeInTheDocument();

    expect(screen.getByRole('tab', { name: 'Plugin Tab 2' })).toHaveAttribute('href', '/test');
  });

  describe('empty Recent tab analytics', () => {
    // LinkButton renders a plain <a href>; clicking it would trigger a real jsdom
    // navigation (console.error -> jest-fail-on-console). Route anchor clicks through
    // the SPA history the way the app does so the onClick fires without navigating.
    beforeEach(() => {
      document.addEventListener('click', interceptLinkClicks);
    });

    afterEach(() => {
      document.removeEventListener('click', interceptLinkClicks);
    });

    it('tracks create_dashboard when the user can create dashboards', async () => {
      jest
        .spyOn(contextSrv, 'hasPermission')
        .mockImplementation((action: string) => action === AccessControlAction.DashboardsCreate);

      const { user } = render(<DashboardTabs extensionComponents={[]} />);

      await user.click(await screen.findByRole('link', { name: /create your first dashboard/i }));

      expect(jest.mocked(ctaClicked)).toHaveBeenCalledWith({
        surface: 'recent_tab',
        action: 'create_dashboard',
        placement: 'empty_state',
      });
    });

    it('tracks browse_dashboards when the user cannot create dashboards', async () => {
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);

      const { user } = render(<DashboardTabs extensionComponents={[]} />);

      await user.click(await screen.findByRole('link', { name: /browse dashboards/i }));

      expect(jest.mocked(ctaClicked)).toHaveBeenCalledWith({
        surface: 'recent_tab',
        action: 'browse_dashboards',
        placement: 'empty_state',
      });
    });
  });

  describe('Recent activity tab', () => {
    const exploreHref = `/explore?schemaVersion=1&panes=${encodeURIComponent(
      JSON.stringify({
        abc: {
          datasource: 'loki-uid',
          queries: [{ refId: 'A', expr: '{service_name="api"}' }],
          range: { from: 'now-1h', to: 'now' },
        },
      })
    )}`;
    const exploreEntry: PageHistoryEntry = {
      kind: 'explore',
      href: exploreHref,
      lastVisited: Date.now() - 2 * 60 * 60 * 1000,
    };
    const dashboardEntry: PageHistoryEntry = {
      kind: 'dashboard',
      uid: 'recent-1',
      href: '/d/recent-1/x?from=now-90d&to=now&var-Plugin=finnhub',
      lastVisited: Date.now() - 60_000,
    };
    const alertingEntry: PageHistoryEntry = {
      kind: 'alerting',
      pathname: '/alerting/list',
      href: '/alerting/list?search=firing',
      lastVisited: Date.now() - 30_000,
    };
    // A detail page whose chrome title is just the section's; the path has to tell it apart.
    const appEntry: PageHistoryEntry = {
      kind: 'app',
      pathname: '/a/grafana-irm-app/incidents/5987',
      href: '/a/grafana-irm-app/incidents/5987?tab=timeline',
      lastVisited: Date.now() - 10_000,
      title: 'Incidents',
    };
    const navBarTree = [
      { text: 'Alerting', url: '/alerting', children: [{ text: 'Alert rules', url: '/alerting/list' }] },
    ];

    async function enableRedesign() {
      await act(async () => {
        setTestFlags({ 'grafana.growthHomepage': true });
      });
    }

    it('is absent and never reads history when the flag is off', async () => {
      seedRecent(['recent-1', 'recent-2']);
      server.use(getCustomSearchHandler(recentHits));

      render(<DashboardTabs extensionComponents={[]} />);

      expect(await screen.findByRole('tab', { name: /recent dashboards/i, selected: true })).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: /recent activity/i })).not.toBeInTheDocument();
      expect(pageHistorySrv.getEntries).not.toHaveBeenCalled();
    });

    it('lists visited pages with their restored state, newest first', async () => {
      await enableRedesign();
      jest.mocked(pageHistorySrv.getEntries).mockResolvedValue([appEntry, exploreEntry, dashboardEntry, alertingEntry]);
      server.use(getCustomSearchHandler(recentHits));

      render(<DashboardTabs extensionComponents={[]} />, { preloadedState: { navBarTree } });

      expect(await screen.findByRole('tab', { name: /recent activity.*4/i, selected: true })).toBeInTheDocument();
      expect(screen.queryByRole('tab', { name: /recent dashboards/i })).not.toBeInTheDocument();

      const links = within(screen.getByRole('list')).getAllByRole('link');
      expect(links.map((link) => link.getAttribute('href'))).toEqual([
        '/a/grafana-irm-app/incidents/5987?tab=timeline',
        exploreHref,
        '/d/recent-1/x?from=now-90d&to=now&var-Plugin=finnhub',
        '/alerting/list?search=firing',
      ]);

      const dashboardLink = screen.getByRole('link', { name: /Recent Dashboard 1/ });
      expect(dashboardLink).toHaveTextContent('Last 90 days · Plugin=finnhub');
      expect(screen.getByRole('link', { name: /^Explore/ })).toBeInTheDocument();
      // Nav-tree pages use the nav label alone; deep links show the page's own title with the path under it.
      expect(screen.getByRole('link', { name: /Alert rules/ })).toHaveTextContent('search=firing');
      expect(screen.getByRole('link', { name: /Alert rules/ })).not.toHaveTextContent('/alerting/list');
      expect(screen.getByRole('link', { name: /^Incidents/ })).toHaveTextContent(
        'grafana-irm-app/incidents/5987 · tab=timeline'
      );

      const list = within(screen.getByRole('list'));
      expect(list.getByText('Dashboard')).toBeInTheDocument();
      expect(list.getByText('Alerting')).toBeInTheDocument();
      expect(list.getByText('App')).toBeInTheDocument();
      expect(list.getAllByText('Explore')).toHaveLength(2);

      // Kind chips cover the whole history; "All" is active until one is picked.
      const chips = within(screen.getByRole('group', { name: /show only/i }));
      expect(chips.getAllByRole('button').map((chip) => chip.textContent)).toEqual([
        'All',
        'Dashboards',
        'Explore',
        'Alerting',
        'Apps',
      ]);
      expect(chips.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('backfills dashboards from the recently viewed list while page history has few', async () => {
      await enableRedesign();
      seedRecent(['recent-1', 'recent-2']);
      jest.mocked(pageHistorySrv.getEntries).mockResolvedValue([exploreEntry]);
      server.use(getCustomSearchHandler(recentHits));

      render(<DashboardTabs extensionComponents={[]} />);

      expect(await screen.findByRole('tab', { name: /recent activity.*3/i, selected: true })).toBeInTheDocument();
      const links = within(screen.getByRole('list')).getAllByRole('link');
      // Real visits first, backfilled dashboards after them, without a visit time.
      expect(links.map((link) => link.textContent)).toEqual([
        expect.stringMatching(/^Explore/),
        expect.stringMatching(/^Recent Dashboard 1/),
        expect.stringMatching(/^Recent Dashboard 2/),
      ]);
      expect(within(screen.getByRole('list')).getAllByText('Dashboard')).toHaveLength(2);
      expect(screen.getAllByText(/ago$/)).toHaveLength(1);
      expect(screen.getByRole('button', { name: 'Dashboards' })).toBeEnabled();
    });

    it('drops dashboards the user can no longer see before applying the cap', async () => {
      await enableRedesign();
      const gone: PageHistoryEntry[] = Array.from({ length: 20 }, (_, i) => ({
        kind: 'dashboard',
        uid: `gone-${i}`,
        href: `/d/gone-${i}`,
        lastVisited: Date.now() - i,
      }));
      jest.mocked(pageHistorySrv.getEntries).mockResolvedValue([...gone, exploreEntry]);
      server.use(getCustomSearchHandler(recentHits));

      render(<DashboardTabs extensionComponents={[]} />);

      expect(await screen.findByRole('tab', { name: /recent activity.*1/i, selected: true })).toBeInTheDocument();
      const rows = within(screen.getByRole('list'));
      expect(rows.getByRole('link', { name: /^Explore/ })).toBeInTheDocument();
      expect(rows.getAllByRole('link')).toHaveLength(1);
    });

    it('tracks the tab switch and row clicks', async () => {
      await enableRedesign();
      jest.mocked(pageHistorySrv.getEntries).mockResolvedValue([exploreEntry]);
      server.use(getCustomSearchHandler(recentHits));

      const { user } = render(<DashboardTabs extensionComponents={[]} />);

      await user.click(await screen.findByRole('tab', { name: /starred/i }));
      await user.click(screen.getByRole('tab', { name: /^recent/i }));
      expect(jest.mocked(tabChanged)).toHaveBeenLastCalledWith({ tab: 'recent-activity' });

      await user.click(screen.getByRole('link', { name: /^Explore/ }));
      expect(jest.mocked(ctaClicked)).toHaveBeenCalledWith({
        surface: 'recent_activity_tab',
        action: 'open_page',
        placement: 'list',
        page_kind: 'explore',
      });
    });

    it('auto-switches to a tab with content when there is no recent activity', async () => {
      await enableRedesign();
      setMockStarredDashboards(['starred-1']);
      server.use(getCustomSearchHandler(starredHits));

      render(<DashboardTabs extensionComponents={[]} />);

      expect(await screen.findByRole('tab', { name: /starred dashboards/i, selected: true })).toBeInTheDocument();
      expect(jest.mocked(tabChanged)).not.toHaveBeenCalled();
    });

    it('shows a retryable error when the dashboard lookup fails', async () => {
      await enableRedesign();
      jest.mocked(pageHistorySrv.getEntries).mockResolvedValue([dashboardEntry]);
      server.use(http.get(searchRoute, () => HttpResponse.json({}, { status: 500 })));

      const { user } = render(<DashboardTabs extensionComponents={[]} />);

      expect(await screen.findByText('Could not load your recent activity')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /clear recent activity/i })).not.toBeInTheDocument();

      server.use(getCustomSearchHandler(recentHits));
      await user.click(screen.getByRole('button', { name: /retry/i }));

      expect(await screen.findByRole('link', { name: /Recent Dashboard 1/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /recent activity/i })).toHaveAttribute('aria-selected', 'true');
    });
  });
});
