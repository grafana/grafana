import { act, getWrapper, render, screen, userEvent, waitFor, within } from 'test/test-utils';

import { type NavModelItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import {
  customGetUserPreferencesHandler,
  customPatchUserPreferencesHandler,
  getFolderFixtures,
  mockUserPreferences,
  setMockStarredDashboards,
  setMockUserPreferences,
  setTestFlags,
} from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { configureStore } from 'app/store/configureStore';

import { AppChromeService } from '../AppChromeService';

import { MegaMenu } from './MegaMenu';
import { customisableNavTree, nestedNavTree } from './__mocks__/fixtures';
import { HIDDEN_ITEMS_STORAGE_KEY } from './hooks';

// The org switcher fetches user orgs on mount when signed in, which is irrelevant here.
jest.mock('../OrganizationSwitcher/OrganizationSwitcher', () => ({
  OrganizationSwitcher: () => null,
}));

// The searcher resolves starred UIDs to nav rows but has no MSW path, so stub it.
jest.mock('app/features/search/service/searcher');

// The starred dashboard the tests pin to: the stars fixture is seeded with its UID and the searcher
// resolves that UID to this row, so the synced Starred section is populated deterministically.
const [, { dashbdE }] = getFolderFixtures();
const STARRED_DASHBOARD = { uid: dashbdE.item.uid, name: dashbdE.item.title, url: `/d/${dashbdE.item.uid}` };

const setupSearcher = (dashboards = [STARRED_DASHBOARD]) => {
  const search = jest.fn(({ name }: { name: string[] }) => {
    const rows = dashboards.filter((d) => name.includes(d.uid));
    return Promise.resolve({ view: { length: rows.length, get: (i: number) => rows[i] } });
  });
  jest.mocked(getGrafanaSearcher).mockReturnValue({ search } as unknown as ReturnType<typeof getGrafanaSearcher>);
};

setBackendSrv(backendSrv);
setupMockServer();

// Seed the stateful preferences fixture with the pinned (bookmark) urls before rendering. The
// preferences handlers read this fixture and persist PATCHes back into it, so pin/unpin updates
// survive the refetch the patch's cache invalidation triggers. The fixture is reset between tests
// by setupMockServer's resetFixtures().
const seedBookmarks = (bookmarkUrls: string[] = []) => {
  setMockUserPreferences({ navbar: { bookmarkUrls } });
};

const CUSTOMISE_FLAG = 'grafana.customizableMegaMenu';
const getStoredHiddenItems = () => JSON.parse(window.localStorage.getItem(HIDDEN_ITEMS_STORAGE_KEY) ?? '[]');

const renderMegaMenu = ({
  navBarTree = customisableNavTree,
  hiddenItemIds = [],
  bookmarkUrls = [],
}: { navBarTree?: NavModelItem[]; hiddenItemIds?: string[]; bookmarkUrls?: string[] } = {}) => {
  // Hidden state is read from localStorage; pins come from preferences.
  window.localStorage.setItem(HIDDEN_ITEMS_STORAGE_KEY, JSON.stringify(hiddenItemIds));
  seedBookmarks(bookmarkUrls);

  return render(<MegaMenu onClose={() => {}} />, { preloadedState: { navBarTree } });
};

describe('MegaMenu', () => {
  beforeEach(() => {
    // Seed one starred dashboard and the searcher that resolves it, so the real starred-items sync
    // populates the Starred section deterministically (the stars query runs regardless of sign-in).
    setMockStarredDashboards([STARRED_DASHBOARD.uid]);
    setupSearcher();
  });

  afterEach(async () => {
    window.localStorage.clear();
    // Wrap in act() because setTestFlags fires OpenFeature events that trigger React state
    // updates while the component is still mounted (RTL cleanup runs in a separate afterEach).
    await act(async () => {
      setTestFlags({});
    });
    jest.clearAllMocks();
  });
  it('should render component', async () => {
    renderMegaMenu({ navBarTree: nestedNavTree });

    expect(await screen.findByTestId(selectors.components.NavMenu.Menu)).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Section name' })).toBeInTheDocument();
  });

  it('should render children', async () => {
    renderMegaMenu({ navBarTree: nestedNavTree });
    await userEvent.click(await screen.findByRole('button', { name: 'Expand section: Section name' }));
    expect(await screen.findByRole('link', { name: 'Child1' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Child2' })).toBeInTheDocument();
  });

  it('should render grandchildren', async () => {
    renderMegaMenu({ navBarTree: nestedNavTree });
    await userEvent.click(await screen.findByRole('button', { name: 'Expand section: Section name' }));
    expect(await screen.findByRole('link', { name: 'Child1' })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Expand section: Child1' }));
    expect(await screen.findByRole('link', { name: 'Grandchild1' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Child2' })).toBeInTheDocument();
  });

  it('should filter out profile', async () => {
    renderMegaMenu({ navBarTree: nestedNavTree });

    expect(screen.queryByLabelText('Profile')).not.toBeInTheDocument();
  });

  it('should filter out home', async () => {
    renderMegaMenu({ navBarTree: nestedNavTree });

    expect(await screen.findByRole('link', { name: 'Section name' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
  });

  describe('customisation', () => {
    beforeEach(() => {
      setTestFlags({ [CUSTOMISE_FLAG]: true });
      contextSrv.isSignedIn = true;
      // The preferences query skips when the user isn't signed in.
      contextSrv.user.isSignedIn = true;
    });

    afterEach(() => {
      contextSrv.isSignedIn = false;
      contextSrv.user.isSignedIn = false;
    });

    it('does not show the customise control when the feature flag is off', async () => {
      setTestFlags({ [CUSTOMISE_FLAG]: false });
      renderMegaMenu();

      expect(await screen.findByRole('link', { name: 'Explore' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Customise menu' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Feedback' })).not.toBeInTheDocument();
    });

    it('shows a loading skeleton until preferences have loaded, instead of the un-customised menu', async () => {
      // Keep the preferences request pending so the query stays in its loading state.
      server.use(customGetUserPreferencesHandler(() => new Promise(() => {})));

      renderMegaMenu();

      const list = await screen.findByRole('list', { name: 'Navigation' });
      expect(list).toHaveAttribute('aria-busy', 'true');
      // The real items aren't rendered yet (so there's no reflow once preferences arrive)
      expect(screen.queryByRole('link', { name: 'Explore' })).not.toBeInTheDocument();
    });

    it('hides items the user has hidden, but still shows them in edit mode', async () => {
      const { user } = renderMegaMenu({ hiddenItemIds: ['explore'] });

      // Hidden outside edit mode
      expect(screen.queryByRole('link', { name: 'Explore' })).not.toBeInTheDocument();
      expect(await screen.findByRole('link', { name: 'Alerting' })).toBeInTheDocument();

      // Visible again once editing
      await user.click(await screen.findByRole('button', { name: 'Customise menu' }));
      expect(await screen.findByRole('link', { name: 'Explore' })).toBeInTheDocument();
      expect(await screen.findByRole('button', { name: 'Show Explore' })).toBeInTheDocument();
    });

    it('does not offer a visibility toggle for protected items', async () => {
      const { user } = renderMegaMenu();

      await user.click(await screen.findByRole('button', { name: 'Customise menu' }));

      expect(await screen.findByRole('button', { name: 'Hide Explore' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Hide Home' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Hide Bookmarks' })).not.toBeInTheDocument();
    });

    it('persists hidden items to localStorage on Done (pins go to preferences)', async () => {
      const { user } = renderMegaMenu();

      await user.click(await screen.findByRole('button', { name: 'Customise menu' }));
      await user.click(await screen.findByRole('button', { name: 'Hide Explore' }));
      await user.click(await screen.findByRole('button', { name: 'Hide Alerting' }));
      await user.click(await screen.findByRole('button', { name: 'Done' }));

      expect(getStoredHiddenItems()).toEqual(['explore', 'alerting']);
      // Hidden state goes to localStorage; the preferences pins are untouched
      await waitFor(() => expect(mockUserPreferences.navbar?.bookmarkUrls).toEqual([]));
    });

    it('keeps the pin control available while customising', async () => {
      const { user } = renderMegaMenu();

      await user.click(await screen.findByRole('button', { name: 'Customise menu' }));

      // The hide toggle and the pin control are both available in edit mode
      expect(await screen.findByRole('button', { name: 'Hide Explore' })).toBeInTheDocument();
      const pin = screen
        .getAllByRole('button', { hidden: true })
        .find((button) => button.getAttribute('aria-label') === 'Pin Explore');
      expect(pin).toBeDefined();
    });

    it('discards changes on Cancel', async () => {
      const { user } = renderMegaMenu();

      await user.click(await screen.findByRole('button', { name: 'Customise menu' }));
      await user.click(await screen.findByRole('button', { name: 'Hide Explore' }));
      await user.click(await screen.findByRole('button', { name: 'Cancel' }));

      // Explore remains visible since the hide was discarded (hide state is local; pins untouched)
      expect(await screen.findByRole('link', { name: 'Explore' })).toBeInTheDocument();
    });

    it('does not show reset to default when nothing is customised', async () => {
      const { user } = renderMegaMenu();

      await user.click(await screen.findByRole('button', { name: 'Customise menu' }));
      expect(screen.queryByRole('button', { name: 'Reset to default' })).not.toBeInTheDocument();
    });

    it('stages a reset and only persists it on save', async () => {
      const { user } = renderMegaMenu({ hiddenItemIds: ['explore'], bookmarkUrls: ['/playlists'] });

      await user.click(await screen.findByRole('button', { name: 'Customise menu' }));
      // The pinned item is shown while editing
      expect(screen.getByRole('list', { name: 'Pinned' })).toBeInTheDocument();

      await user.click(await screen.findByRole('button', { name: 'Reset to default' }));

      // Reset is staged, not saved — the preview clears, the reset control disappears, and the
      // stored pins are untouched until save
      expect(mockUserPreferences.navbar?.bookmarkUrls).toEqual(['/playlists']);
      expect(screen.queryByRole('list', { name: 'Pinned' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Reset to default' })).not.toBeInTheDocument();

      // Saving persists the cleared state — hidden to localStorage, pins to preferences
      await user.click(screen.getByRole('button', { name: 'Done' }));
      expect(getStoredHiddenItems()).toEqual([]);
      await waitFor(() => expect(mockUserPreferences.navbar?.bookmarkUrls).toEqual([]));
      await waitFor(() => expect(screen.queryByRole('list', { name: 'Pinned' })).not.toBeInTheDocument());
      expect(screen.getByRole('link', { name: 'Explore' })).toBeInTheDocument();
    });

    it('discards a staged reset on cancel', async () => {
      const { user } = renderMegaMenu({ bookmarkUrls: ['/playlists'] });

      await user.click(await screen.findByRole('button', { name: 'Customise menu' }));
      await user.click(await screen.findByRole('button', { name: 'Reset to default' }));
      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      // Nothing was persisted, so the stored pin is unchanged and the pinned item is restored
      expect(mockUserPreferences.navbar?.bookmarkUrls).toEqual(['/playlists']);
      expect(await screen.findByRole('list', { name: 'Pinned' })).toBeInTheDocument();
    });

    describe('hiding child items', () => {
      it('hides a child item, removing it from the normal nav while keeping the parent', async () => {
        const { user } = renderMegaMenu();

        await user.click(await screen.findByRole('button', { name: 'Customise menu' }));
        await user.click(await screen.findByRole('button', { name: 'Expand section: Dashboards' }));
        await user.click(await screen.findByRole('button', { name: 'Hide Playlists' }));
        await user.click(screen.getByRole('button', { name: 'Done' }));

        expect(getStoredHiddenItems()).toEqual(['dashboards/playlists']);
      });

      it('greys children and offers to show them when the parent is hidden', async () => {
        const { user } = renderMegaMenu();

        await user.click(await screen.findByRole('button', { name: 'Customise menu' }));
        await user.click(await screen.findByRole('button', { name: 'Expand section: Dashboards' }));
        await user.click(await screen.findByRole('button', { name: 'Hide Dashboards' }));

        // Children inherit the hidden state — their control now offers to Show them
        expect(await screen.findByRole('button', { name: 'Show Playlists' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Show Snapshots' })).toBeInTheDocument();
      });

      it('breaks apart the parent-hide when a child is unhidden', async () => {
        const { user } = renderMegaMenu();

        await user.click(await screen.findByRole('button', { name: 'Customise menu' }));
        await user.click(await screen.findByRole('button', { name: 'Expand section: Dashboards' }));
        await user.click(await screen.findByRole('button', { name: 'Hide Dashboards' }));
        await user.click(await screen.findByRole('button', { name: 'Show Playlists' }));
        await user.click(screen.getByRole('button', { name: 'Done' }));

        // Dashboards is no longer hidden; its other child is hidden individually instead
        expect(getStoredHiddenItems()).toEqual(['dashboards/snapshots']);
      });

      it('keeps the parent visible when all its children are hidden individually', async () => {
        renderMegaMenu({ hiddenItemIds: ['dashboards/playlists', 'dashboards/snapshots'] });

        expect(await screen.findByRole('link', { name: 'Dashboards' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Playlists' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Snapshots' })).not.toBeInTheDocument();
      });

      it('does not show an expand control when all the visible children are hidden', async () => {
        // Dashboards still has a "New dashboard" create-action child, which never renders as a row
        renderMegaMenu({ hiddenItemIds: ['dashboards/playlists', 'dashboards/snapshots'] });

        await screen.findByRole('link', { name: 'Dashboards' });
        expect(screen.queryByRole('button', { name: 'Expand section: Dashboards' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Collapse section: Dashboards' })).not.toBeInTheDocument();
      });
    });

    describe('pinned items', () => {
      const pinnedRegion = () => within(screen.getByRole('list', { name: 'Pinned' }));

      it('surfaces a pinned child under its parent in the pinned area, with no Bookmarks section', async () => {
        renderMegaMenu({ bookmarkUrls: ['/playlists'] });

        await screen.findByRole('list', { name: 'Pinned' });
        // The pinned child brings along its parent
        expect(pinnedRegion().getByRole('link', { name: 'Playlists' })).toBeInTheDocument();
        expect(pinnedRegion().getByRole('link', { name: 'Dashboards' })).toBeInTheDocument();
        // No dedicated Bookmarks section
        expect(screen.queryByRole('link', { name: 'Bookmarks' })).not.toBeInTheDocument();
      });

      it('moves the pinned child out of its normal location', async () => {
        renderMegaMenu({ bookmarkUrls: ['/playlists'] });

        await screen.findByRole('list', { name: 'Pinned' });
        // Playlists exists only in the pinned area (moved, not duplicated)
        expect(screen.getAllByRole('link', { name: 'Playlists' })).toHaveLength(1);
        expect(pinnedRegion().getByRole('link', { name: 'Playlists' })).toBeInTheDocument();
      });

      it('keeps a partially-pinned parent in the normal nav too', async () => {
        renderMegaMenu({ bookmarkUrls: ['/playlists'] });

        await screen.findByRole('list', { name: 'Pinned' });
        // Dashboards appears both in the pinned area (as the parent of Playlists) and in the
        // normal nav (still holding Snapshots)
        expect(screen.getAllByRole('link', { name: 'Dashboards' })).toHaveLength(2);
      });

      it('removes a fully-pinned section from the normal nav', async () => {
        // Administration has a single child; pinning it pins the whole section
        renderMegaMenu({ bookmarkUrls: ['/admin/settings'] });

        await screen.findByRole('list', { name: 'Pinned' });
        expect(pinnedRegion().getByRole('link', { name: 'Administration' })).toBeInTheDocument();
        expect(pinnedRegion().getByRole('link', { name: 'Settings' })).toBeInTheDocument();
        // Only the pinned copy of Administration remains
        expect(screen.getAllByRole('link', { name: 'Administration' })).toHaveLength(1);
      });

      it('places the pinned block at the top, above the other sections', async () => {
        renderMegaMenu({ bookmarkUrls: ['/admin/settings'] });

        await screen.findByRole('list', { name: 'Pinned' });
        // Home is reached via the logo, not listed, so the pinned block leads the menu
        expect(screen.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
        const names = screen.getAllByRole('link').map((el) => el.textContent);
        expect(names.indexOf('Administration')).toBe(0);
        expect(names.indexOf('Administration')).toBeLessThan(names.indexOf('Explore'));
      });

      it('pins a whole section by its own url and shows its children', async () => {
        const { user } = renderMegaMenu();

        // Pinning is only available while customising
        await user.click(await screen.findByRole('button', { name: 'Customise menu' }));
        await screen.findByRole('link', { name: 'Dashboards' });
        // Several icon buttons per row, so select the pin control by its label
        const pinButton = screen
          .getAllByRole('button', { hidden: true })
          .find((button) => button.getAttribute('aria-label') === 'Pin Dashboards');
        await user.click(pinButton!);

        // Staged in the pinned-area preview with its children, and no longer in the normal nav
        const pinned = within(await screen.findByRole('list', { name: 'Pinned' }));
        expect(pinned.getByRole('link', { name: 'Dashboards' })).toBeInTheDocument();
        expect(pinned.getByRole('link', { name: 'Playlists' })).toBeInTheDocument();
        expect(screen.getAllByRole('link', { name: 'Dashboards' })).toHaveLength(1);

        // Persisted on Done — by the section's own url, not by enumerating children
        await user.click(screen.getByRole('button', { name: 'Done' }));
        await waitFor(() => expect(mockUserPreferences.navbar?.bookmarkUrls).toEqual(['/dashboards']));
      });

      it('keeps a section with children pinned by its own url (e.g. Starred)', async () => {
        // A section pinned in its own right must stay in the pinned area and keep showing its
        // children even though it has children — the case that broke when starring a dashboard
        // gave the pinned "Starred" section children.
        renderMegaMenu({ bookmarkUrls: ['/dashboards'] });

        const pinned = within(await screen.findByRole('list', { name: 'Pinned' }));
        expect(pinned.getByRole('link', { name: 'Dashboards' })).toBeInTheDocument();
        expect(pinned.getByRole('link', { name: 'Playlists' })).toBeInTheDocument();
        expect(pinned.getByRole('link', { name: 'Snapshots' })).toBeInTheDocument();
        // The whole section moved out of the normal nav
        expect(screen.getAllByRole('link', { name: 'Dashboards' })).toHaveLength(1);
      });

      it('offers an unpin control on the section and every pinned child', async () => {
        const { user } = renderMegaMenu({ bookmarkUrls: ['/dashboards'] });

        await user.click(await screen.findByRole('button', { name: 'Customise menu' }));
        const pinned = within(await screen.findByRole('list', { name: 'Pinned' }));
        const labels = pinned.getAllByRole('button', { hidden: true }).map((b) => b.getAttribute('aria-label'));
        expect(labels).toContain('Unpin Dashboards');
        expect(labels).toContain('Unpin Playlists');
        expect(labels).toContain('Unpin Snapshots');
      });

      it('unpinning the top-level section removes the whole group', async () => {
        const { user } = renderMegaMenu({ bookmarkUrls: ['/dashboards'] });

        await user.click(await screen.findByRole('button', { name: 'Customise menu' }));
        const pinned = within(await screen.findByRole('list', { name: 'Pinned' }));
        const sectionUnpin = pinned
          .getAllByRole('button', { hidden: true })
          .find((button) => button.getAttribute('aria-label') === 'Unpin Dashboards');
        await user.click(sectionUnpin!);
        await user.click(screen.getByRole('button', { name: 'Done' }));

        await waitFor(() => expect(mockUserPreferences.navbar?.bookmarkUrls).toEqual([]));
        await waitFor(() => expect(screen.queryByRole('list', { name: 'Pinned' })).not.toBeInTheDocument());
      });

      it('unpinning one child of a whole-pinned section expands to the remaining siblings', async () => {
        const { user } = renderMegaMenu({ bookmarkUrls: ['/dashboards'] });

        await user.click(await screen.findByRole('button', { name: 'Customise menu' }));
        const pinned = within(await screen.findByRole('list', { name: 'Pinned' }));
        const childUnpin = pinned
          .getAllByRole('button', { hidden: true })
          .find((button) => button.getAttribute('aria-label') === 'Unpin Playlists');
        await user.click(childUnpin!);
        await user.click(screen.getByRole('button', { name: 'Done' }));

        // The section is replaced by its remaining (still-pinned) sibling
        await waitFor(() => expect(mockUserPreferences.navbar?.bookmarkUrls).toEqual(['/snapshots']));
      });

      it('lets you unpin an immediate child subsection of a whole-pinned section', async () => {
        // A three-level section (Administration → General/Access → leaves), pinned as a whole.
        const navBarTree: NavModelItem[] = [
          { text: 'Home', id: 'home', url: '/' },
          {
            text: 'Administration',
            id: 'cfg',
            url: '/admin',
            children: [
              {
                text: 'General',
                id: 'cfg/general',
                url: '/admin/general',
                children: [{ text: 'Default preferences', id: 'cfg/general/prefs', url: '/admin/general/prefs' }],
              },
              {
                text: 'Access',
                id: 'cfg/access',
                url: '/admin/access',
                children: [{ text: 'Users', id: 'cfg/access/users', url: '/admin/users/list' }],
              },
            ],
          },
        ];
        const { user } = renderMegaMenu({ navBarTree, bookmarkUrls: ['/admin'] });

        await user.click(await screen.findByRole('button', { name: 'Customise menu' }));
        const pinned = within(await screen.findByRole('list', { name: 'Pinned' }));

        // The immediate child subsection is unpinnable (the bug: it offered no control)
        const unpinGeneral = pinned
          .getAllByRole('button', { hidden: true })
          .find((button) => button.getAttribute('aria-label') === 'Unpin General');
        expect(unpinGeneral).toBeDefined();

        // Unpinning it drops just that subsection; the sibling stays pinned
        await user.click(unpinGeneral!);
        await user.click(screen.getByRole('button', { name: 'Done' }));
        await waitFor(() => expect(mockUserPreferences.navbar?.bookmarkUrls).toEqual(['/admin/users/list']));
      });

      it('unpins from the pinned area and restores the item', async () => {
        const { user } = renderMegaMenu({ bookmarkUrls: ['/admin/settings'] });

        await user.click(await screen.findByRole('button', { name: 'Customise menu' }));
        // Several icon buttons per row, so select the unpin control by its label
        const pinned = within(await screen.findByRole('list', { name: 'Pinned' }));
        const unpinButton = pinned
          .getAllByRole('button', { hidden: true })
          .find((button) => button.getAttribute('aria-label') === 'Unpin Settings');
        await user.click(unpinButton!);
        await user.click(screen.getByRole('button', { name: 'Done' }));

        await waitFor(() => expect(mockUserPreferences.navbar?.bookmarkUrls).toEqual([]));
        await waitFor(() => expect(screen.queryByRole('list', { name: 'Pinned' })).not.toBeInTheDocument());
      });

      it('highlights a pinned item that matches the current page', async () => {
        seedBookmarks(['/explore']);

        // Current page is Explore, which is pinned, so the pinned Explore row is the current page
        const chrome = new AppChromeService();
        chrome.update({
          sectionNav: { node: { id: 'explore', text: 'Explore', url: '/explore' }, main: { text: '' } },
        });

        const wrapper = getWrapper({
          store: configureStore({ navBarTree: customisableNavTree }),
          grafanaContext: { chrome },
          renderWithRouter: true,
          historyOptions: { initialEntries: ['/explore'] },
        });
        render(<MegaMenu onClose={() => {}} />, { wrapper });

        const pinned = within(await screen.findByRole('list', { name: 'Pinned' }));
        expect(pinned.getByRole('link', { name: 'Explore' })).toHaveAttribute('aria-current', 'page');
      });

      it('highlights only the matching pinned row when the active page is under a pinned section', async () => {
        seedBookmarks(['/dashboards']);

        // Current page is "Playlists", which lives under the (fully pinned) Dashboards section
        const chrome = new AppChromeService();
        chrome.update({
          sectionNav: {
            node: {
              id: 'dashboards/playlists',
              text: 'Playlists',
              url: '/playlists',
              parentItem: {
                id: 'dashboards',
                text: 'Dashboards',
                url: '/dashboards',
                parentItem: { id: 'home', text: 'Home', url: '/' },
              },
            },
            main: { text: '' },
          },
        });

        const wrapper = getWrapper({
          store: configureStore({ navBarTree: customisableNavTree }),
          grafanaContext: { chrome },
          renderWithRouter: true,
          historyOptions: { initialEntries: ['/playlists'] },
        });
        render(<MegaMenu onClose={() => {}} />, { wrapper });

        const pinned = within(await screen.findByRole('list', { name: 'Pinned' }));
        expect(pinned.getByRole('link', { name: 'Playlists' })).toHaveAttribute('aria-current', 'page');
        // Only the matching pinned row is current — an ancestor section isn't highlighted in its place
        expect(pinned.getByRole('link', { name: 'Dashboards' })).not.toHaveAttribute('aria-current', 'page');
      });

      it('does not offer a pin control on individual starred items, only the Starred section', async () => {
        const { user } = renderMegaMenu();

        // Pin controls only appear while customising
        await user.click(await screen.findByRole('button', { name: 'Customise menu' }));
        await user.click(await screen.findByRole('button', { name: 'Expand section: Starred' }));
        expect(await screen.findByRole('link', { name: STARRED_DASHBOARD.name })).toBeInTheDocument();

        const pinButtons = screen
          .getAllByRole('button', { hidden: true })
          .map((button) => button.getAttribute('aria-label'));
        // The starred dashboard cannot be pinned
        expect(pinButtons).not.toContain(`Pin ${STARRED_DASHBOARD.name}`);
        // ...but the Starred section itself can
        expect(pinButtons).toContain('Pin Starred');
      });

      it('keeps the collapsible Bookmarks section when the flag is off', async () => {
        setTestFlags({ [CUSTOMISE_FLAG]: false });
        renderMegaMenu({ bookmarkUrls: ['/explore'] });

        expect(await screen.findByRole('button', { name: 'Expand section: Bookmarks' })).toBeInTheDocument();
      });

      it('keeps the legacy bookmark control on regular and starred items when the flag is off', async () => {
        setTestFlags({ [CUSTOMISE_FLAG]: false });
        const { user } = renderMegaMenu();

        await user.click(await screen.findByRole('button', { name: 'Expand section: Starred' }));
        await screen.findByRole('link', { name: STARRED_DASHBOARD.name });

        // With customisation off the new pin restrictions don't apply — every signed-in item
        // (except the Bookmarks section) keeps the legacy bookmark control, as on main.
        const labels = screen
          .getAllByRole('button', { hidden: true })
          .map((button) => button.getAttribute('aria-label'));
        expect(labels).toContain('Bookmark Explore');
        expect(labels).toContain(`Bookmark ${STARRED_DASHBOARD.name}`);
        // ...and a bookmarked item keeps the legacy "Bookmark" tooltip, not "Unpin"
        expect(labels).not.toContain('Unpin Explore');
      });
    });

    describe('collapsing the non-pinned items', () => {
      it('does not offer the collapse toggle when nothing is pinned', async () => {
        renderMegaMenu();

        expect(await screen.findByRole('link', { name: 'Alerting' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'All items' })).not.toBeInTheDocument();
      });

      it('collapses and expands the non-pinned items while keeping pinned items visible', async () => {
        const { user } = renderMegaMenu({ bookmarkUrls: ['/playlists'] });

        // Expanded by default — other items are visible
        expect(await screen.findByRole('link', { name: 'Alerting' })).toBeInTheDocument();

        // The "All items" toggle is wired to the unpinned list for a11y (aria-controls + aria-expanded)
        const toggle = screen.getByRole('button', { name: 'All items' });
        const controlledId = toggle.getAttribute('aria-controls');
        expect(controlledId).toBeTruthy();
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(document.getElementById(controlledId!)).toContainElement(screen.getByRole('link', { name: 'Alerting' }));

        // Collapse: the non-pinned items disappear but the pinned ones remain
        await user.click(toggle);
        expect(screen.queryByRole('link', { name: 'Alerting' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'All items' })).toHaveAttribute('aria-expanded', 'false');
        expect(
          within(screen.getByRole('list', { name: 'Pinned' })).getByRole('link', { name: 'Playlists' })
        ).toBeInTheDocument();

        // Expand again — the toggle stays in place
        await user.click(screen.getByRole('button', { name: 'All items' }));
        expect(await screen.findByRole('link', { name: 'Alerting' })).toBeInTheDocument();
      });

      it('resets the collapse when all items are unpinned, so re-pinning starts expanded', async () => {
        const { user } = renderMegaMenu({ bookmarkUrls: ['/explore'] });

        // Collapse the rest (outside edit mode)
        await user.click(await screen.findByRole('button', { name: 'All items' }));
        expect(screen.queryByRole('link', { name: 'Alerting' })).not.toBeInTheDocument();

        // Unpin everything (pinning is edit-mode only; staged, persisted on Done)
        await user.click(await screen.findByRole('button', { name: 'Customise menu' }));
        const unpin = within(screen.getByRole('list', { name: 'Pinned' }))
          .getAllByRole('button', { hidden: true })
          .find((button) => button.getAttribute('aria-label') === 'Unpin Explore');
        await user.click(unpin!);
        await user.click(screen.getByRole('button', { name: 'Done' }));
        await waitFor(() => expect(screen.queryByRole('list', { name: 'Pinned' })).not.toBeInTheDocument());

        // Re-pin — the menu must not still be collapsed
        await user.click(await screen.findByRole('button', { name: 'Customise menu' }));
        const rePin = screen
          .getAllByRole('button', { hidden: true })
          .find((button) => button.getAttribute('aria-label') === 'Pin Explore');
        await user.click(rePin!);
        await user.click(screen.getByRole('button', { name: 'Done' }));

        expect(await screen.findByRole('list', { name: 'Pinned' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Alerting' })).toBeInTheDocument();
      });
    });

    describe('edit-mode-only controls', () => {
      it('reveals the pin control, feedback button and only-pinned toggle only while editing', async () => {
        const { user } = renderMegaMenu({ bookmarkUrls: ['/explore'] });

        // Outside edit mode: no pin/unpin controls, no feedback, no only-pinned toggle
        await screen.findByRole('list', { name: 'Pinned' });
        const beforeLabels = screen.getAllByRole('button', { hidden: true }).map((b) => b.getAttribute('aria-label'));
        expect(beforeLabels.some((label) => label?.startsWith('Pin ') || label?.startsWith('Unpin '))).toBe(false);
        expect(screen.queryByRole('button', { name: 'Feedback' })).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Only show pinned items')).not.toBeInTheDocument();

        // Entering edit mode reveals the feedback button (footer), pin controls and only-pinned toggle
        await user.click(screen.getByRole('button', { name: 'Customise menu' }));
        expect(screen.getByRole('button', { name: 'Feedback' })).toBeInTheDocument();
        expect(screen.getByLabelText('Only show pinned items')).toBeInTheDocument();
        const afterLabels = screen.getAllByRole('button', { hidden: true }).map((b) => b.getAttribute('aria-label'));
        expect(afterLabels).toContain('Unpin Explore');
      });

      it('"only show pinned items" hides the unpinned items, keeping the pinned block', async () => {
        const { user } = renderMegaMenu({ bookmarkUrls: ['/explore'] });

        await user.click(await screen.findByRole('button', { name: 'Customise menu' }));
        expect(await screen.findByRole('link', { name: 'Alerting' })).toBeInTheDocument();

        // Turn it on — the unpinned items drop away, the pinned block stays
        await user.click(screen.getByLabelText('Only show pinned items'));
        expect(screen.queryByRole('link', { name: 'Alerting' })).not.toBeInTheDocument();
        expect(
          within(screen.getByRole('list', { name: 'Pinned' })).getByRole('link', { name: 'Explore' })
        ).toBeInTheDocument();

        // Turn it off — they come back
        await user.click(screen.getByLabelText('Only show pinned items'));
        expect(await screen.findByRole('link', { name: 'Alerting' })).toBeInTheDocument();
      });

      it('shows a saving state on Done while the pins are being persisted', async () => {
        // Hold the preferences PATCH pending so the saving state stays observable
        server.use(customPatchUserPreferencesHandler(() => new Promise(() => {})));

        const { user } = renderMegaMenu();
        await user.click(await screen.findByRole('button', { name: 'Customise menu' }));
        // Stage a pin so there's something to save
        const pin = screen
          .getAllByRole('button', { hidden: true })
          .find((button) => button.getAttribute('aria-label') === 'Pin Explore');
        await user.click(pin!);
        await user.click(screen.getByRole('button', { name: 'Done' }));

        // Done switches to a disabled saving state, and we stay in edit mode until it resolves
        const saving = await screen.findByRole('button', { name: 'Saving…' });
        expect(saving).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      });

      it('shows the "only show pinned items" toggle but disables it until something is pinned', async () => {
        const { user } = renderMegaMenu();

        await user.click(await screen.findByRole('button', { name: 'Customise menu' }));
        // Feedback is available; the only-pinned toggle is shown but disabled while nothing is pinned
        expect(screen.getByRole('button', { name: 'Feedback' })).toBeInTheDocument();
        expect(screen.getByLabelText('Only show pinned items')).toBeDisabled();
      });
    });
  });
});
