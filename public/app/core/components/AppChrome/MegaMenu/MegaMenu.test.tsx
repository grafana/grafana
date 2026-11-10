import { HttpResponse } from 'msw';
import { act, render, screen, userEvent, waitFor, within } from 'test/test-utils';

import { type NavModelItem } from '@grafana/data';
import { config, reportExperimentView, reportInteraction, setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import {
  customGetUserPreferencesHandler,
  customPatchUserPreferencesHandler,
  getFolderFixtures,
  mockUserPreferences,
  setMockStarredDashboards,
  setMockStarredFolders,
  setMockUserPreferences,
  setTestFlags,
} from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';

import { AppChromeService } from '../AppChromeService';

import { MegaMenu } from './MegaMenu';
import { customisableNavTree, nestedNavTree } from './__mocks__/fixtures';
import { HIDDEN_NAV_ITEMS } from './utils';

jest.mock('../OrganizationSwitcher/OrganizationSwitcher', () => ({ OrganizationSwitcher: () => null }));
jest.mock('app/features/search/service/searcher');
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
  reportExperimentView: jest.fn(),
}));

const [, { dashbdE, folderB }] = getFolderFixtures();
const STARRED_DASHBOARD = {
  uid: dashbdE.item.uid,
  name: dashbdE.item.title,
  url: `/d/${dashbdE.item.uid}`,
  kind: 'dashboard',
};
const setupSearcher = (items = [STARRED_DASHBOARD]) => {
  const search = jest.fn(({ name }: { name: string[] }) => {
    const rows = items.filter((d) => name.includes(d.uid));
    return Promise.resolve({ view: { length: rows.length, get: (i: number) => rows[i], toArray: () => rows } });
  });
  jest.mocked(getGrafanaSearcher).mockReturnValue({ search } as unknown as ReturnType<typeof getGrafanaSearcher>);
};

setBackendSrv(backendSrv);
setupMockServer();
const IA_FLAG = 'grafana.navigationInfoArchRefresh';
const OLD_FLAG = 'grafana.customizableMegaMenu';
const HIDDEN_KEY = 'grafana.navigation.megamenu.hidden-items';
const ORDER_KEY = 'grafana.navigation.megamenu.section-order';

const renderMegaMenu = ({
  navBarTree = customisableNavTree,
  bookmarkUrls = [],
  onClose = jest.fn(),
  chrome,
}: {
  navBarTree?: NavModelItem[];
  bookmarkUrls?: string[];
  onClose?: () => void;
  chrome?: AppChromeService;
} = {}) => {
  setMockUserPreferences({ navbar: { bookmarkUrls } });
  return render(<MegaMenu onClose={onClose} />, {
    preloadedState: { navBarTree },
    ...(chrome ? { grafanaContext: { chrome } } : {}),
  });
};

// jsdom does not apply :hover styles; identify the control by its accessible label before hovering.
const pinControl = (label: string) => screen.getByLabelText(label);
const pinnedRegion = () => within(screen.getByRole('list', { name: 'Pinned items' }));

describe('MegaMenu', () => {
  beforeEach(() => {
    contextSrv.isSignedIn = true;
    contextSrv.user.isSignedIn = true;
    setTestFlags({ [IA_FLAG]: true });
    setMockStarredDashboards([STARRED_DASHBOARD.uid]);
    setupSearcher();
  });

  afterEach(async () => {
    window.localStorage.clear();
    await act(async () => setTestFlags({}));
    contextSrv.isSignedIn = false;
    contextSrv.user.isSignedIn = false;
    jest.clearAllMocks();
  });

  it('expands nested navigation while omitting Home and profile', async () => {
    const { user } = renderMegaMenu({ navBarTree: nestedNavTree });
    await user.click(await screen.findByRole('button', { name: 'Expand section: Section name' }));
    await user.click(screen.getByRole('button', { name: 'Expand section: Child1' }));
    expect(screen.getByRole('link', { name: 'Grandchild1' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Child2' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Profile' })).not.toBeInTheDocument();
  });

  it('shows a loading skeleton until preferences have loaded', async () => {
    server.use(customGetUserPreferencesHandler(() => new Promise(() => {})));
    renderMegaMenu();
    expect(await screen.findByRole('list', { name: 'Navigation' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByLabelText('Pin Explore')).not.toBeInTheDocument();
  });

  it.each([false, true])('uses IA presentation independently of the old flag (%s)', async (oldFlag) => {
    setTestFlags({ [IA_FLAG]: true, [OLD_FLAG]: oldFlag });
    const { user } = renderMegaMenu({ bookmarkUrls: ['/explore'] });
    expect(await screen.findByRole('list', { name: 'Pinned items' })).toBeInTheDocument();
    await user.hover(pinnedRegion().getByRole('link', { name: 'Explore' }));
    expect(pinnedRegion().getByLabelText('Unpin Explore')).toContainElement(
      screen.getAllByTestId('icon-gf-pin-filled')[0]
    );
    expect(screen.queryByRole('link', { name: 'Bookmarks' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Customise navigation' })).not.toBeInTheDocument();
    expect(reportExperimentView).not.toHaveBeenCalled();
  });

  it.each([false, true])('keeps legacy bookmarks when IA is off and the old flag is %s', async (oldFlag) => {
    setTestFlags({ [IA_FLAG]: false, [OLD_FLAG]: oldFlag });
    const { user } = renderMegaMenu({ bookmarkUrls: ['/explore', '/orphaned-not-in-nav'] });
    await user.click(await screen.findByRole('button', { name: 'Expand section: Bookmarks' }));
    const bookmarks = within(screen.getByRole('link', { name: 'Bookmarks' }).closest('li')!);
    expect(bookmarks.getByRole('link', { name: 'Explore' })).toBeInTheDocument();
    const navExplore = within(screen.getByRole('list', { name: 'Navigation' }))
      .getAllByRole('link', { name: 'Explore' })
      .at(-1)!;
    await user.hover(navExplore);
    expect(screen.getAllByLabelText('Bookmark Explore')[0]).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Pinned items' })).not.toBeInTheDocument();
  });

  it('toggles legacy bookmarks immediately', async () => {
    setTestFlags({ [IA_FLAG]: false });
    const { user } = renderMegaMenu();
    await user.hover(await screen.findByRole('link', { name: 'Explore' }));
    await user.click(pinControl('Bookmark Explore'));
    await waitFor(() => expect(mockUserPreferences.navbar?.bookmarkUrls).toEqual(['/explore']));
    expect(await screen.findByRole('button', { name: 'Expand section: Bookmarks' })).toBeInTheDocument();
  });

  it('ignores stored hiding/order while preserving pins and removing edit controls', async () => {
    window.localStorage.setItem(HIDDEN_KEY, JSON.stringify(['explore']));
    window.localStorage.setItem(ORDER_KEY, JSON.stringify(['cfg', 'explore']));
    renderMegaMenu({ bookmarkUrls: ['/admin', '/explore'] });
    await screen.findByRole('list', { name: 'Pinned items' });
    const links = within(screen.getByRole('list', { name: 'Navigation' }))
      .getAllByRole('link')
      .map((el) => el.textContent);
    expect(links.indexOf('Explore')).toBeLessThan(links.indexOf('Administration'));
    expect(
      pinnedRegion()
        .getAllByRole('link')
        .map((el) => el.textContent)
    ).toEqual(['Administration', 'Explore']);
    const labels = screen.getAllByRole('button', { hidden: true }).map((b) => b.getAttribute('aria-label'));
    expect(
      labels.some((label) => /^(Hide |Show |Reorder |Reset |Cancel$|Done$|Customise navigation$)/.test(label ?? ''))
    ).toBe(false);
    expect(mockUserPreferences.navbar?.bookmarkUrls).toEqual(['/admin', '/explore']);
    expect(window.localStorage.getItem(HIDDEN_KEY)).toBe('["explore"]');
  });

  it('shows saved breadcrumbs with a divider and retains the original navigation item', async () => {
    const { user } = renderMegaMenu({ bookmarkUrls: ['/playlists'] });
    await screen.findByRole('list', { name: 'Pinned items' });
    expect(pinnedRegion().getByRole('link', { name: /Dashboards.*Playlists/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Expand section: Dashboards' }));
    expect(screen.getAllByText('Playlists')).toHaveLength(2);
    const divider = screen.getByRole('list', { name: 'Pinned items' }).parentElement?.nextElementSibling;
    expect(divider).toHaveRole('separator');
    expect(divider?.nextElementSibling).toBe(screen.getByRole('list', { name: 'Navigation' }));
  });

  it.each([
    { name: 'Explore', url: '/explore' },
    { name: 'Dashboards', url: '/dashboards' },
    { name: 'Playlists', url: '/playlists' },
  ])('pins $name immediately and keeps both copies after reopening', async ({ name, url }) => {
    const { user, unmount } = renderMegaMenu();
    await screen.findByRole('link', { name: 'Explore' });
    if (name === 'Playlists') {
      await user.click(screen.getByRole('button', { name: 'Expand section: Dashboards' }));
    }
    await user.hover(screen.getByRole('link', { name }));
    await user.click(pinControl(`Pin ${name}`));
    await waitFor(() => expect(mockUserPreferences.navbar?.bookmarkUrls).toEqual([url]));
    expect(pinnedRegion().getByRole('link', { name: new RegExp(name) })).toBeInTheDocument();
    expect(reportInteraction).toHaveBeenCalledWith('grafana_nav_item_pinned', { path: url });
    unmount();
    renderMegaMenu({ bookmarkUrls: [url] });
    await screen.findByRole('list', { name: 'Pinned items' });
    expect(pinnedRegion().getByRole('link', { name: new RegExp(name) })).toBeInTheDocument();
  });

  it('unpins from the breadcrumb without navigating or closing the menu', async () => {
    const onClose = jest.fn();
    const { user } = renderMegaMenu({ bookmarkUrls: ['/playlists'], onClose });
    await screen.findByRole('list', { name: 'Pinned items' });
    await user.hover(pinnedRegion().getByRole('link', { name: /Playlists/ }));
    await user.click(pinnedRegion().getByLabelText('Unpin Playlists'));
    await waitFor(() => expect(mockUserPreferences.navbar?.bookmarkUrls).toEqual([]));
    expect(screen.getByRole('link', { name: 'Dashboards' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Pinned items' })).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(reportInteraction).toHaveBeenCalledWith('grafana_nav_item_unpinned', { path: '/playlists' });
  });

  it('unpins using the original navigation copy', async () => {
    const { user } = renderMegaMenu({ bookmarkUrls: ['/explore'] });
    await screen.findByRole('list', { name: 'Pinned items' });
    const nav = within(screen.getByRole('list', { name: 'Navigation' }));
    await user.hover(nav.getByRole('link', { name: 'Explore' }));
    await user.click(nav.getByLabelText('Unpin Explore'));
    await waitFor(() => expect(mockUserPreferences.navbar?.bookmarkUrls).toEqual([]));
    expect(nav.getByRole('link', { name: 'Explore' })).toBeInTheDocument();
  });

  it('pins Starred as an independently collapsible section, not its individual children', async () => {
    const { user } = renderMegaMenu();
    await user.hover(await screen.findByRole('link', { name: 'Starred' }));
    await user.click(pinControl('Pin Starred'));
    await screen.findByRole('list', { name: 'Pinned items' });
    expect(await pinnedRegion().findByRole('link', { name: STARRED_DASHBOARD.name })).toBeInTheDocument();
    const nav = within(screen.getByRole('list', { name: 'Navigation' }));
    expect(nav.getByRole('button', { name: 'Expand section: Starred' })).toHaveAttribute('aria-expanded', 'false');
    await user.click(pinnedRegion().getByRole('button', { name: 'Collapse section: Starred' }));
    await user.click(nav.getByRole('button', { name: 'Expand section: Starred' }));
    expect(nav.getByRole('link', { name: STARRED_DASHBOARD.name })).toBeInTheDocument();
    expect(screen.queryByLabelText(`Pin ${STARRED_DASHBOARD.name}`)).not.toBeInTheDocument();
    expect(mockUserPreferences.navbar?.bookmarkUrls).toEqual(['/dashboards?starred']);
  });

  it('disables all pin controls during a write and prevents overlapping changes', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const patch = jest.fn(async () => {
      await gate;
      return HttpResponse.json({});
    });
    server.use(customPatchUserPreferencesHandler(patch));
    const { user } = renderMegaMenu({ bookmarkUrls: ['/explore'] });
    await screen.findByRole('list', { name: 'Pinned items' });
    await user.hover(screen.getByRole('link', { name: 'Dashboards' }));
    await user.click(pinControl('Pin Dashboards'));
    await waitFor(() => expect(pinControl('Pin Dashboards')).toBeDisabled());
    expect(pinnedRegion().getByLabelText('Unpin Explore')).toBeDisabled();
    await user.click(pinControl('Pin Administration'));
    expect(patch).toHaveBeenCalledTimes(1);
    await act(async () => release());
    expect(await pinnedRegion().findByRole('link', { name: 'Dashboards' })).toBeInTheDocument();
  });

  it('keeps successful pins on write failure and permits retrying', async () => {
    server.use(customPatchUserPreferencesHandler(() => HttpResponse.json({ message: 'nope' }, { status: 500 })));
    const { user, store } = renderMegaMenu({ bookmarkUrls: ['/explore'] });
    await screen.findByRole('list', { name: 'Pinned items' });
    await user.hover(screen.getByRole('link', { name: 'Dashboards' }));
    await user.click(pinControl('Pin Dashboards'));
    await waitFor(() =>
      expect(Object.values(store?.getState().appNotifications.byId ?? {})).toEqual(
        expect.arrayContaining([expect.objectContaining({ title: 'Failed to update pinned menu items' })])
      )
    );
    await waitFor(() => expect(pinControl('Pin Dashboards')).toBeEnabled());
    expect(mockUserPreferences.navbar?.bookmarkUrls).toEqual(['/explore']);
    expect(pinnedRegion().getByRole('link', { name: 'Explore' })).toBeInTheDocument();
    expect(reportInteraction).not.toHaveBeenCalledWith('grafana_nav_item_pinned', expect.anything());
    server.resetHandlers();
    await user.click(pinControl('Pin Dashboards'));
    await waitFor(() => expect(mockUserPreferences.navbar?.bookmarkUrls).toEqual(['/explore', '/dashboards']));
  });

  it('keeps navigation usable for anonymous users without pin actions', async () => {
    contextSrv.isSignedIn = false;
    contextSrv.user.isSignedIn = false;
    renderMegaMenu();
    expect(await screen.findByRole('link', { name: 'Explore' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Pin Explore')).not.toBeInTheDocument();
  });

  it('preserves ordinary navigation analytics without experiment metadata', async () => {
    const { user } = renderMegaMenu();
    await user.click(await screen.findByRole('link', { name: 'Explore' }));
    expect(reportInteraction).toHaveBeenCalledWith('grafana_navigation_item_clicked', {
      path: '/explore',
      menuIsDocked: false,
      itemIsBookmarked: false,
      itemIsStarred: false,
      itemKind: undefined,
      isNew: undefined,
    });
    expect(reportExperimentView).not.toHaveBeenCalled();
  });

  it('retains dock/undock without customisation controls', async () => {
    const chrome = new AppChromeService();
    const { user } = renderMegaMenu({ chrome });
    await screen.findByRole('link', { name: 'Explore' });
    await user.click(screen.getByLabelText('Dock menu'));
    expect(chrome.state.getValue().megaMenuDocked).toBe(true);
    await user.click(screen.getByLabelText('Undock menu'));
    expect(chrome.state.getValue().megaMenuDocked).toBe(false);
  });

  describe('information architecture refresh exclusions', () => {
    let originalAppSubUrl: string;
    beforeEach(() => {
      originalAppSubUrl = config.appSubUrl;
      HIDDEN_NAV_ITEMS.add('child2');
      HIDDEN_NAV_ITEMS.add('dashboards/playlists');
    });
    afterEach(() => {
      config.appSubUrl = originalAppSubUrl;
      HIDDEN_NAV_ITEMS.delete('child2');
      HIDDEN_NAV_ITEMS.delete('dashboards/playlists');
    });

    it.each(['', '/grafana'])('excludes URL and ID keys under subpath "%s", including pins', async (appSubUrl) => {
      config.appSubUrl = appSubUrl;
      const { user } = renderMegaMenu({
        bookmarkUrls: [`${appSubUrl}/playlists`],
        navBarTree: [
          {
            id: 'plugin-page-grafana-adaptive-metrics-app',
            text: 'Adaptive Metrics',
            url: `${appSubUrl}/a/grafana-adaptive-metrics-app/overview`,
            children: [
              { text: 'Configuration', url: `${appSubUrl}/a/grafana-adaptive-metrics-app/configuration` },
              { id: 'dashboards/playlists', text: 'Playlists', url: `${appSubUrl}/playlists` },
              { text: 'Customizations', url: `${appSubUrl}/a/grafana-adaptive-metrics-app/customizations` },
            ],
          },
        ],
      });
      await user.click(await screen.findByRole('button', { name: 'Expand section: Adaptive Metrics' }));
      expect(screen.getByRole('link', { name: 'Customizations' })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Configuration' })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Playlists' })).not.toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'Pinned items' })).not.toBeInTheDocument();
    });

    it.each([false, true])('applies hard-coded exclusions only with IA refresh: %s', async (enabled) => {
      setTestFlags({ [IA_FLAG]: enabled });
      const { user } = renderMegaMenu({ navBarTree: nestedNavTree });
      await user.click(await screen.findByRole('button', { name: 'Expand section: Section name' }));
      await user.click(screen.getByRole('button', { name: 'Expand section: Child1' }));
      expect(screen.getByRole('link', { name: 'Grandchild1' })).toBeInTheDocument();
      expect(Boolean(screen.queryByRole('link', { name: 'Child2' }))).toBe(!enabled);
    });
  });

  it('distinguishes a same-named starred folder and dashboard by their icons', async () => {
    setMockStarredFolders([folderB.item.uid]);
    setupSearcher([
      { ...STARRED_DASHBOARD, name: 'Shared Name' },
      { uid: folderB.item.uid, name: 'Shared Name', url: `/dashboards/f/${folderB.item.uid}`, kind: 'folder' },
    ]);
    renderMegaMenu();
    await userEvent.click(await screen.findByRole('button', { name: 'Expand section: Starred' }));
    const starred = within(screen.getByRole('link', { name: 'Starred' }).closest('li')!);
    await waitFor(() => expect(starred.getAllByRole('link', { name: 'Shared Name' })).toHaveLength(2));
    expect(starred.getByTitle('Dashboard')).toBe(starred.getByTestId('icon-apps'));
    expect(starred.getByTitle('Folder')).toBe(starred.getByTestId('icon-folder'));
  });
});
