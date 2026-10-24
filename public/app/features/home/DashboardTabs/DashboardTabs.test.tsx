import { http, HttpResponse } from 'msw';
import { useEffect, type ReactNode } from 'react';
import { makeDataSourceSettings } from 'test/helpers/makeDataSourceSettings';
import { render, screen, within } from 'test/test-utils';

import { type DashboardHit } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { type ComponentTypeWithExtensionMeta, PluginExtensionPoints } from '@grafana/data';
import { config, reportInteraction, setBackendSrv } from '@grafana/runtime';
import { setDataSourceInstanceSettings } from '@grafana/runtime/internal';
import { mockComboboxRect } from '@grafana/test-utils';
import { getCustomSearchHandler, searchRoute } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { setMockStarredDashboards } from '@grafana/test-utils/unstable';
import { interceptLinkClicks } from 'app/core/navigation/patch/interceptLinkClicks';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { pageHistorySrv } from 'app/core/services/pageHistory/pageHistorySrv';
import { type PageHistoryEntry } from 'app/core/services/pageHistory/types';
import { createComponentWithMeta } from 'app/features/plugins/extensions/usePluginComponents';
import { AccessControlAction } from 'app/types/accessControl';

import {
  clearHistoryClicked,
  ctaClicked,
  recentActivityFilterChanged,
  recentActivityShown,
  tabChanged,
} from '../analytics/main';

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
  recentActivityShown: jest.fn(),
  recentActivityFilterChanged: jest.fn(),
}));
jest.mock('app/core/services/pageHistory/pageHistorySrv', () => ({
  pageHistorySrv: { getEntries: jest.fn(), clear: jest.fn() },
}));

setBackendSrv(backendSrv);
setupMockServer();
// The kind filter is a Combobox; without a measured rect the virtualizer renders no options in jsdom.
mockComboboxRect();

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

/** The page history, newest first. */
function seedHistory(entries: PageHistoryEntry[]) {
  jest.mocked(pageHistorySrv.getEntries).mockResolvedValue(entries);
}

/** Visited dashboards in page history, newest first. */
function seedRecent(uids: string[]) {
  seedHistory(uids.map((uid) => dashboardEntry(uid)));
}

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.removeItem(FILTER_KEY);
  setMockStarredDashboards([]);
  config.licenseInfo.enabledFeatures = {};
  // Every tab searches by the uids it owns (history, stars, views), so one handler serves them all.
  server.use(getCustomSearchHandler([...recentHits, ...starredHits, ...mostUsedHits]));
  // restoreAllMocks wipes the implementation, so the empty default must come back every test.
  seedHistory([]);
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
  it('shows a loading skeleton until the initial fetches settle, then the tab bar', async () => {
    seedRecent(['recent-1', 'recent-2']);

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

    render(<DashboardTabs extensionComponents={[]} />);

    // the first tab bar shown is already on Starred — no Recent→Starred flip
    expect(await screen.findByRole('tab', { name: /starred/i, selected: true })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /recent/i })).toHaveAttribute('aria-selected', 'false');
    expect(jest.mocked(tabChanged)).not.toHaveBeenCalled();
  });

  it('switches to Starred tab and shows starred dashboards', async () => {
    setMockStarredDashboards(['starred-1', 'starred-2', 'starred-3']);

    const { user } = render(<DashboardTabs extensionComponents={[]} />);

    await user.click(await screen.findByRole('tab', { name: /starred/i }));

    expect(screen.getByRole('tab', { name: /starred/i })).toHaveAttribute('aria-selected', 'true');

    expect(await screen.findByText('Starred Dashboard 1')).toBeInTheDocument();
    expect(screen.getByText('Starred Dashboard 2')).toBeInTheDocument();
    expect(screen.getByText('Starred Dashboard 3')).toBeInTheDocument();
  });

  it('offers the full dashboard list from the dashboard tabs only', async () => {
    setMockStarredDashboards(['starred-1']);

    const { user } = render(<DashboardTabs extensionComponents={[]} />);

    // Recent is empty, so the card lands on Starred.
    await screen.findByRole('tab', { name: /starred/i, selected: true });
    expect(screen.getByRole('link', { name: /view all dashboards/i })).toHaveAttribute('href', '/dashboards');

    await user.click(screen.getByRole('tab', { name: /recent/i }));

    expect(screen.queryByRole('link', { name: /view all dashboards/i })).not.toBeInTheDocument();
  });

  describe('empty Recent activity tab', () => {
    // LinkButton renders a plain <a href>; clicking it would trigger a real jsdom navigation
    // (console.error -> jest-fail-on-console). Route anchor clicks through the SPA history the
    // way the app does so the onClick fires without navigating.
    beforeEach(() => {
      document.addEventListener('click', interceptLinkClicks);
    });

    afterEach(() => {
      document.removeEventListener('click', interceptLinkClicks);
    });

    it('offers to create a dashboard when the user may, reports the empty display and has no clear action', async () => {
      jest
        .spyOn(contextSrv, 'hasPermission')
        .mockImplementation((action: string) => action === AccessControlAction.DashboardsCreate);

      const { user } = render(<DashboardTabs extensionComponents={[]} />);

      expect(await screen.findByText('No recent activity yet. Pages you visit will show up here.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /clear recent activity/i })).not.toBeInTheDocument();
      // Displayed with an empty history still counts as shown.
      expect(jest.mocked(recentActivityShown)).toHaveBeenCalledWith(expect.objectContaining({ total_count: 0 }));

      const create = screen.getByRole('link', { name: /create your first dashboard/i });
      expect(create).toHaveAttribute('href', '/dashboard/new');
      await user.click(create);
      expect(jest.mocked(ctaClicked)).toHaveBeenCalledWith({
        surface: 'recent_tab',
        action: 'create_dashboard',
        placement: 'empty_state',
      });
    });

    it('offers to browse dashboards when the user may not create one', async () => {
      jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);

      const { user } = render(<DashboardTabs extensionComponents={[]} />);

      const browse = await screen.findByRole('link', { name: /browse dashboards/i });
      expect(browse).toHaveAttribute('href', '/dashboards');
      expect(screen.queryByRole('link', { name: /create your first dashboard/i })).not.toBeInTheDocument();
      await user.click(browse);
      expect(jest.mocked(ctaClicked)).toHaveBeenCalledWith({
        surface: 'recent_tab',
        action: 'browse_dashboards',
        placement: 'empty_state',
      });
    });
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

    const { user } = render(<DashboardTabs extensionComponents={[]} />);

    expect(await screen.findByRole('tab', { name: /recent/i, selected: true })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /starred/i }));

    expect(screen.getByRole('tab', { name: /starred/i })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByText('Your starred dashboards will appear here.')).toBeInTheDocument();
  });

  it('shows counter badges with correct counts', async () => {
    seedRecent(['recent-1', 'recent-2']);
    setMockStarredDashboards(['starred-1', 'starred-2', 'starred-3']);

    render(<DashboardTabs extensionComponents={[]} />);

    expect(await screen.findByRole('tab', { name: /recent.*2/i })).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: /starred.*3/i })).toBeInTheDocument();
  });

  describe('Most used tab', () => {
    beforeEach(() => {
      config.licenseInfo.enabledFeatures = { analytics: true };
      // Recent non-empty keeps the card on the Recent tab unless a test says otherwise.
      seedRecent(['recent-1', 'recent-2']);
    });

    it('renders Most used tab when analytics feature is enabled', async () => {
      render(<DashboardTabs extensionComponents={[]} />);

      expect(await screen.findByRole('tab', { name: /most used/i })).toBeInTheDocument();
    });

    it('does not render Most used tab when analytics feature is disabled', async () => {
      config.licenseInfo.enabledFeatures = {};

      render(<DashboardTabs extensionComponents={[]} />);

      expect(await screen.findByText('Recent Dashboard 1')).toBeInTheDocument();

      expect(screen.queryByRole('tab', { name: /most used/i })).not.toBeInTheDocument();
    });

    it('does not render dashboards with no views in the last 30 days', async () => {
      const { user } = render(<DashboardTabs extensionComponents={[]} />);

      await user.click(await screen.findByRole('tab', { name: /most used/i }));

      expect(await screen.findByText('Most Used Dashboard 1')).toBeInTheDocument();
      expect(screen.queryByText('Most Used Dashboard 3')).not.toBeInTheDocument();
    });

    it('auto-switches to Most used when recent is empty and most-used has items', async () => {
      seedHistory([]);

      render(<DashboardTabs extensionComponents={[]} />);

      expect(await screen.findByRole('tab', { name: /most used/i, selected: true })).toBeInTheDocument();

      expect(await screen.findByText('Most Used Dashboard 1')).toBeInTheDocument();
      expect(screen.getByText('Most Used Dashboard 2')).toBeInTheDocument();
    });

    it('stays on Recent when recent has items even with most-used available', async () => {
      render(<DashboardTabs extensionComponents={[]} />);

      expect(await screen.findByText('Recent Dashboard 1')).toBeInTheDocument();

      expect(screen.getByRole('tab', { name: /recent/i })).toHaveAttribute('aria-selected', 'true');
    });

    it('tracks a user click on the Most used tab', async () => {
      const { user } = render(<DashboardTabs extensionComponents={[]} />);

      await user.click(await screen.findByRole('tab', { name: /most used/i }));

      // The only tabChanged call: the card stayed on Recent until the click.
      expect(jest.mocked(tabChanged)).toHaveBeenCalledWith({ tab: 'most-used' });
    });

    it('tracks clicks on a dashboard in the Most used tab', async () => {
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
    beforeEach(() => {
      setDataSourceInstanceSettings({ loki: makeDataSourceSettings('loki-uid', 'Ops Logs', 'loki') });
    });

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
      session: 'abc',
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
      seedHistory([appEntry, exploreEntry, recentDashboardEntry, alertingEntry]);

      const { user } = render(<DashboardTabs extensionComponents={[]} />, { preloadedState: { navBarTree } });

      expect(await screen.findByRole('tab', { name: /recent.*4/i, selected: true })).toBeInTheDocument();

      const links = within(screen.getByRole('list')).getAllByRole('link');
      expect(links.map((link) => link.getAttribute('href'))).toEqual([
        '/a/grafana-irm-app/incidents/5987?tab=timeline',
        `/explore${exploreSearch}`,
        '/d/recent-1/x?from=now-90d&to=now&var-Plugin=finnhub',
        '/alerting/list?search=firing',
      ]);

      // Row formatting is toRow's and tested with it; this only proves a row's URL state reaches the subtitle.
      expect(screen.getByRole('link', { name: /Recent Dashboard 1/ })).toHaveTextContent(
        'Last 90 days · Plugin=finnhub'
      );

      // Kind badges are icon-only; the kind is their accessible name and tooltip.
      const list = within(screen.getByRole('list'));
      expect(list.getByRole('img', { name: 'Dashboard' })).toBeInTheDocument();
      expect(list.getByRole('img', { name: 'Alerting' })).toBeInTheDocument();
      expect(list.getByRole('img', { name: 'App' })).toBeInTheDocument();
      expect(list.getByRole('img', { name: 'Explore' })).toBeInTheDocument();

      // The kind filter covers the whole history; "All" is active until one is picked.
      const filter = screen.getByRole('combobox', { name: /show only/i });
      expect(filter).toHaveValue('All');
      await user.click(filter);
      const options = await screen.findAllByRole('option');
      expect(options.map((option) => option.textContent)).toEqual(['All', 'Dashboards', 'Explore', 'Alerting', 'Apps']);
      await user.keyboard('{Escape}');

      // One exposure per display, counting the whole history.
      expect(jest.mocked(recentActivityShown)).toHaveBeenCalledTimes(1);
      expect(jest.mocked(recentActivityShown)).toHaveBeenCalledWith({
        total_count: 4,
        page_count: 0,
        dashboard_count: 1,
        explore_count: 1,
        alerting_count: 1,
        app_count: 1,
        filter: 'all',
      });
    });

    it('filters by kind without refetching, remembers the choice and offers only kinds with pages', async () => {
      seedHistory([exploreEntry, recentDashboardEntry]);

      const { user } = render(<DashboardTabs extensionComponents={[]} />);

      const filter = await screen.findByRole('combobox', { name: /show only/i });
      await user.click(filter);
      expect(await screen.findAllByRole('option')).toHaveLength(3);
      expect(screen.queryByRole('option', { name: 'Alerting' })).not.toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'Apps' })).not.toBeInTheDocument();

      await user.click(screen.getByRole('option', { name: 'Explore' }));

      expect(within(screen.getByRole('list')).getAllByRole('link')).toHaveLength(1);
      expect(screen.getByRole('link', { name: /^Ops Logs/ })).toBeInTheDocument();
      expect(filter).toHaveValue('Explore');
      expect(window.localStorage.getItem(FILTER_KEY)).toBe('explore');
      expect(jest.mocked(recentActivityFilterChanged)).toHaveBeenCalledWith({ filter: 'explore' });
      expect(jest.mocked(pageHistorySrv.getEntries)).toHaveBeenCalledTimes(1);
      // The counter says what the list shows; the options follow the whole history.
      expect(screen.getByRole('tab', { name: /recent.*1/i })).toBeInTheDocument();
      await user.click(filter);
      expect(await screen.findByRole('option', { name: 'Dashboards' })).toBeInTheDocument();
      await user.keyboard('{Escape}');

      // A click under a kind filter says so: the kind was forced and the position counts within it.
      await user.click(screen.getByRole('link', { name: /^Ops Logs/ }));
      expect(jest.mocked(ctaClicked)).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'open_page', page_kind: 'explore', position: 0, filter: 'explore' })
      );
    });

    it('hides the filter when every page is of one kind but keeps the clear action', async () => {
      seedHistory([recentDashboardEntry, dashboardEntry('recent-2')]);

      render(<DashboardTabs extensionComponents={[]} />);

      expect(await screen.findByRole('button', { name: /clear recent activity/i })).toBeInTheDocument();
      expect(screen.queryByRole('combobox', { name: /show only/i })).not.toBeInTheDocument();
    });

    it('shows the time column while a shown row has a visit time, blank on seeded rows; the filter decides', async () => {
      const seeded: PageHistoryEntry = { kind: 'dashboard', uid: 'recent-1', pathname: '/d/recent-1/x', search: '' };
      seedHistory([exploreEntry, seeded]);

      const { user } = render(<DashboardTabs extensionComponents={[]} />);

      // The Explore row has a time, so every row keeps the column; the seeded row's cell stays blank.
      const seededRow = (await screen.findByRole('link', { name: /Recent Dashboard 1/ })).closest('li')!;
      const exploreRow = screen.getByRole('link', { name: /^Ops Logs/ }).closest('li')!;
      expect(screen.getAllByTestId('time-ago')).toHaveLength(2);
      expect(within(seededRow).getByTestId('time-ago')).toBeEmptyDOMElement();
      expect(within(exploreRow).getByTestId('time-ago')).toHaveTextContent(/ago/);

      const filter = screen.getByRole('combobox', { name: /show only/i });
      await user.click(filter);
      await user.click(await screen.findByRole('option', { name: 'Dashboards' }));
      expect(screen.getByRole('link', { name: /Recent Dashboard 1/ })).toBeInTheDocument();
      expect(screen.queryByTestId('time-ago')).not.toBeInTheDocument();

      await user.click(filter);
      await user.click(await screen.findByRole('option', { name: 'All' }));
      expect(screen.getAllByTestId('time-ago')).toHaveLength(2);
    });

    it('shows a description icon only on dashboard rows that have one', async () => {
      seedHistory([recentDashboardEntry, dashboardEntry('recent-2')]);
      server.use(
        getCustomSearchHandler([
          makeDashboardHit({ name: 'recent-1', title: 'Recent Dashboard 1', description: 'Service health' }),
          makeDashboardHit({ name: 'recent-2', title: 'Recent Dashboard 2' }),
        ])
      );

      render(<DashboardTabs extensionComponents={[]} />);

      await screen.findByRole('link', { name: /Recent Dashboard 2/ });
      const described = screen.getByRole('link', { name: /Recent Dashboard 1/ }).closest('li')!;
      expect(screen.getAllByLabelText('Description')).toHaveLength(1);
      expect(within(described).getByLabelText('Description')).toBeInTheDocument();
    });

    it('lets the user star a dashboard row, which updates the Starred tab', async () => {
      seedHistory([exploreEntry, recentDashboardEntry]);

      const { user } = render(<DashboardTabs extensionComponents={[]} />);

      const star = await screen.findByRole('button', { name: 'Mark "Recent Dashboard 1" as favorite' });
      expect(screen.getAllByRole('button', { name: /as favorite/ })).toHaveLength(1);
      expect(screen.getByRole('tab', { name: /starred.*0/i })).toBeInTheDocument();

      await user.click(star);

      expect(
        await screen.findByRole('button', { name: 'Unmark "Recent Dashboard 1" as favorite' })
      ).toBeInTheDocument();
      expect(await screen.findByRole('tab', { name: /starred.*1/i })).toBeInTheDocument();
    });

    it('drops dashboards the user can no longer see', async () => {
      const gone: PageHistoryEntry[] = Array.from({ length: 3 }, (_, i) => dashboardEntry(`gone-${i}`));
      seedHistory([...gone, exploreEntry]);

      render(<DashboardTabs extensionComponents={[]} />);

      expect(await screen.findByRole('tab', { name: /recent.*1/i, selected: true })).toBeInTheDocument();
      const rows = within(screen.getByRole('list'));
      expect(rows.getByRole('link', { name: /^Ops Logs/ })).toBeInTheDocument();
      expect(rows.getAllByRole('link')).toHaveLength(1);
    });

    it('tracks the tab switch and row clicks', async () => {
      seedHistory([exploreEntry]);

      const { user } = render(<DashboardTabs extensionComponents={[]} />);

      await user.click(await screen.findByRole('tab', { name: /starred/i }));
      expect(jest.mocked(recentActivityShown)).toHaveBeenCalledTimes(1);
      await user.click(screen.getByRole('tab', { name: /^recent/i }));
      expect(jest.mocked(tabChanged)).toHaveBeenLastCalledWith({ tab: 'recent' });
      // Shown again: the user came back to it.
      expect(jest.mocked(recentActivityShown)).toHaveBeenCalledTimes(2);

      await user.click(screen.getByRole('link', { name: /^Ops Logs/ }));
      expect(jest.mocked(ctaClicked)).toHaveBeenCalledWith({
        surface: 'recent_tab',
        action: 'open_page',
        placement: 'list',
        page_kind: 'explore',
        position: 0,
        filter: 'all',
      });
    });

    it('clears the history, reports what was cleared, resets the filter and reloads the tab', async () => {
      window.localStorage.setItem(FILTER_KEY, 'explore');
      seedHistory([exploreEntry, recentDashboardEntry, alertingEntry]);

      const { user } = render(<DashboardTabs extensionComponents={[]} />);
      expect(await screen.findByRole('combobox', { name: /show only/i })).toHaveValue('Explore');

      jest.mocked(pageHistorySrv.clear).mockImplementation(async () => seedHistory([]));
      await user.click(screen.getByRole('button', { name: /clear recent activity/i }));

      // Counts cover the whole history, not the filtered rows.
      expect(jest.mocked(clearHistoryClicked)).toHaveBeenCalledWith({ dashboard_count: 1, total_count: 3 });
      expect(await screen.findByText('No recent activity yet. Pages you visit will show up here.')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /clear recent activity/i })).not.toBeInTheDocument();
      expect(window.localStorage.getItem(FILTER_KEY)).toBe('all');
    });

    it('ignores a stored filter that no longer matches any page', async () => {
      window.localStorage.setItem(FILTER_KEY, 'explore');
      seedHistory([recentDashboardEntry, alertingEntry]);

      const { user } = render(<DashboardTabs extensionComponents={[]} />, { preloadedState: { navBarTree } });

      expect(await screen.findByRole('link', { name: /Recent Dashboard 1/ })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Alert rules/ })).toBeInTheDocument();
      const filter = screen.getByRole('combobox', { name: /show only/i });
      expect(filter).toHaveValue('All');
      await user.click(filter);
      expect(await screen.findByRole('option', { name: 'All' })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'Explore' })).not.toBeInTheDocument();
    });

    it('shows a retryable error when the dashboard lookup fails', async () => {
      seedHistory([recentDashboardEntry]);
      server.use(http.get(searchRoute, () => HttpResponse.json({}, { status: 500 })));

      const { user } = render(<DashboardTabs extensionComponents={[]} />);

      expect(await screen.findByText('Could not load your recent activity')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /clear recent activity/i })).not.toBeInTheDocument();

      server.use(getCustomSearchHandler(recentHits));
      await user.click(screen.getByRole('button', { name: /retry/i }));

      expect(await screen.findByRole('link', { name: /Recent Dashboard 1/ })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /recent/i })).toHaveAttribute('aria-selected', 'true');
    });
  });
});
