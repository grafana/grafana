import { http, HttpResponse } from 'msw';
import { useEffect, type ReactNode } from 'react';
import { render, screen, within } from 'test/test-utils';

import { type DashboardHit } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { type ComponentTypeWithExtensionMeta, PluginExtensionPoints } from '@grafana/data';
import { config, reportInteraction, setBackendSrv } from '@grafana/runtime';
import { getCustomSearchHandler, searchRoute } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { setMockStarredDashboards } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { pageHistorySrv } from 'app/core/services/pageHistory/pageHistorySrv';
import { type PageHistoryEntry } from 'app/core/services/pageHistory/types';
import { createComponentWithMeta } from 'app/features/plugins/extensions/usePluginComponents';

import { clearHistoryClicked, ctaClicked, tabChanged } from '../analytics/main';

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
  pageHistorySrv: { getEntries: jest.fn(), clear: jest.fn() },
}));

setBackendSrv(backendSrv);
setupMockServer();

const FILTER_KEY = 'grafana.home.recentActivity.filter';

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

function dashboardEntry(uid: string, search = ''): PageHistoryEntry {
  return { kind: 'dashboard', uid, pathname: `/d/${uid}/x`, search, lastVisited: Date.now() - 60_000 };
}

/** Visited dashboards in page history, newest first. */
function seedRecent(uids: string[]) {
  jest.mocked(pageHistorySrv.getEntries).mockResolvedValue(uids.map((uid) => dashboardEntry(uid)));
}

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.removeItem(FILTER_KEY);
  setMockStarredDashboards([]);
  config.licenseInfo.enabledFeatures = {};
  // restoreAllMocks wipes the implementation, so the empty default must come back every test.
  jest.mocked(pageHistorySrv.getEntries).mockResolvedValue([]);
  jest.mocked(pageHistorySrv.clear).mockResolvedValue();
});

afterEach(() => {
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
  it('renders Recent tab as active by default and shows recently visited dashboards', async () => {
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
    // no recent activity; starred has items (analytics off by default → no most-used tab)
    setMockStarredDashboards(['starred-1', 'starred-2', 'starred-3']);
    server.use(getCustomSearchHandler([...starredHits]));

    render(<DashboardTabs extensionComponents={[]} />);

    // the first tab bar shown is already on Starred — no Recent→Starred flip
    expect(await screen.findByRole('tab', { name: /starred/i, selected: true })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /recent/i })).toHaveAttribute('aria-selected', 'false');
    expect(jest.mocked(tabChanged)).not.toHaveBeenCalled();
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

  it('shows the empty state without a clear action when there is no recent activity', async () => {
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
      // No recent activity
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

  describe('Recent activity', () => {
    const exploreSearch = `?schemaVersion=1&panes=${encodeURIComponent(
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
      pathname: '/explore',
      search: exploreSearch,
      lastVisited: Date.now() - 2 * 60 * 60 * 1000,
    };
    const recentDashboardEntry = dashboardEntry('recent-1', '?from=now-90d&to=now&var-Plugin=finnhub');
    const alertingEntry: PageHistoryEntry = {
      kind: 'alerting',
      pathname: '/alerting/list',
      search: '?search=firing',
      lastVisited: Date.now() - 30_000,
    };
    // A detail page whose chrome title is just the section's; the path has to tell it apart.
    const appEntry: PageHistoryEntry = {
      kind: 'app',
      pathname: '/a/grafana-irm-app/incidents/5987',
      search: '?tab=timeline',
      lastVisited: Date.now() - 10_000,
      title: 'Incidents',
    };
    const navBarTree = [
      { text: 'Alerting', url: '/alerting', children: [{ text: 'Alert rules', url: '/alerting/list' }] },
    ];

    it('lists visited pages with their restored state, newest first', async () => {
      jest
        .mocked(pageHistorySrv.getEntries)
        .mockResolvedValue([appEntry, exploreEntry, recentDashboardEntry, alertingEntry]);
      server.use(getCustomSearchHandler(recentHits));

      render(<DashboardTabs extensionComponents={[]} />, { preloadedState: { navBarTree } });

      expect(await screen.findByRole('tab', { name: /recent activity.*4/i, selected: true })).toBeInTheDocument();

      const links = within(screen.getByRole('list')).getAllByRole('link');
      expect(links.map((link) => link.getAttribute('href'))).toEqual([
        '/a/grafana-irm-app/incidents/5987?tab=timeline',
        `/explore${exploreSearch}`,
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

      // The kind filter covers the whole history; "All" is active until one is picked.
      const filter = within(screen.getByRole('radiogroup', { name: /show only/i }));
      const radios = filter.getAllByRole('radio');
      expect(radios).toHaveLength(5);
      ['All', 'Dashboards', 'Explore', 'Alerting', 'Apps'].forEach((name, i) =>
        expect(radios[i]).toHaveAccessibleName(name)
      );
      expect(filter.getByRole('radio', { name: 'All' })).toBeChecked();
    });

    it('filters by kind without refetching, remembers the choice and disables kinds with no pages', async () => {
      jest.mocked(pageHistorySrv.getEntries).mockResolvedValue([exploreEntry, recentDashboardEntry]);
      server.use(getCustomSearchHandler(recentHits));

      const { user } = render(<DashboardTabs extensionComponents={[]} />);

      const filter = within(await screen.findByRole('radiogroup', { name: /show only/i }));
      expect(filter.getByRole('radio', { name: 'Alerting' })).toBeDisabled();
      expect(filter.getByRole('radio', { name: 'Apps' })).toBeDisabled();

      await user.click(filter.getByRole('radio', { name: 'Explore' }));

      expect(within(screen.getByRole('list')).getAllByRole('link')).toHaveLength(1);
      expect(screen.getByRole('link', { name: /^Explore/ })).toBeInTheDocument();
      expect(window.localStorage.getItem(FILTER_KEY)).toBe('explore');
      expect(jest.mocked(pageHistorySrv.getEntries)).toHaveBeenCalledTimes(1);
      // The counter and the disabled state follow the whole history, not the filtered rows.
      expect(screen.getByRole('tab', { name: /recent activity.*2/i })).toBeInTheDocument();
      expect(filter.getByRole('radio', { name: 'Dashboards' })).toBeEnabled();
    });

    it('drops dashboards the user can no longer see', async () => {
      const gone: PageHistoryEntry[] = Array.from({ length: 3 }, (_, i) => dashboardEntry(`gone-${i}`));
      jest.mocked(pageHistorySrv.getEntries).mockResolvedValue([...gone, exploreEntry]);
      server.use(getCustomSearchHandler(recentHits));

      render(<DashboardTabs extensionComponents={[]} />);

      expect(await screen.findByRole('tab', { name: /recent activity.*1/i, selected: true })).toBeInTheDocument();
      const rows = within(screen.getByRole('list'));
      expect(rows.getByRole('link', { name: /^Explore/ })).toBeInTheDocument();
      expect(rows.getAllByRole('link')).toHaveLength(1);
    });

    it('tracks the tab switch and row clicks', async () => {
      jest.mocked(pageHistorySrv.getEntries).mockResolvedValue([exploreEntry]);
      server.use(getCustomSearchHandler(recentHits));

      const { user } = render(<DashboardTabs extensionComponents={[]} />);

      await user.click(await screen.findByRole('tab', { name: /starred/i }));
      await user.click(screen.getByRole('tab', { name: /^recent/i }));
      expect(jest.mocked(tabChanged)).toHaveBeenLastCalledWith({ tab: 'recent' });

      await user.click(screen.getByRole('link', { name: /^Explore/ }));
      expect(jest.mocked(ctaClicked)).toHaveBeenCalledWith({
        surface: 'recent_activity_tab',
        action: 'open_page',
        placement: 'list',
        page_kind: 'explore',
      });
    });

    it('clears the history, reports what was cleared, resets the filter and reloads the tab', async () => {
      window.localStorage.setItem(FILTER_KEY, 'explore');
      jest.mocked(pageHistorySrv.getEntries).mockResolvedValue([exploreEntry, recentDashboardEntry, alertingEntry]);
      server.use(getCustomSearchHandler(recentHits));

      const { user } = render(<DashboardTabs extensionComponents={[]} />);
      expect(await screen.findByRole('radio', { name: 'Explore' })).toBeChecked();

      jest.mocked(pageHistorySrv.clear).mockImplementation(async () => {
        jest.mocked(pageHistorySrv.getEntries).mockResolvedValue([]);
      });
      await user.click(screen.getByRole('button', { name: /clear recent activity/i }));

      // Counts cover the whole history, not the filtered rows.
      expect(jest.mocked(clearHistoryClicked)).toHaveBeenCalledWith({ dashboard_count: 1, page_count: 3 });
      expect(await screen.findByText('No recent activity yet. Pages you visit will show up here.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /clear recent activity/i })).not.toBeInTheDocument();
      expect(window.localStorage.getItem(FILTER_KEY)).toBe('');
    });

    it('ignores a stored filter that no longer matches any page', async () => {
      window.localStorage.setItem(FILTER_KEY, 'explore');
      jest.mocked(pageHistorySrv.getEntries).mockResolvedValue([recentDashboardEntry]);
      server.use(getCustomSearchHandler(recentHits));

      render(<DashboardTabs extensionComponents={[]} />);

      expect(await screen.findByRole('link', { name: /Recent Dashboard 1/ })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'All' })).toBeChecked();
      expect(screen.getByRole('radio', { name: 'Explore' })).toBeDisabled();
    });

    it('shows a retryable error when the dashboard lookup fails', async () => {
      jest.mocked(pageHistorySrv.getEntries).mockResolvedValue([recentDashboardEntry]);
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
