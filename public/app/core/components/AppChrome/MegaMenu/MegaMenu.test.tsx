import { HttpResponse } from 'msw';
import { act, render, screen, testWithFeatureToggles, userEvent, waitFor, within } from 'test/test-utils';

import { type NavModelItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { reportInteraction, setBackendSrv } from '@grafana/runtime';
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
import { HIDDEN_ITEMS_STORAGE_KEY, SECTION_ORDER_STORAGE_KEY } from './hooks';

// The org switcher fetches user orgs on mount when signed in, which is irrelevant here.
jest.mock('../OrganizationSwitcher/OrganizationSwitcher', () => ({
  OrganizationSwitcher: () => null,
}));

// The searcher resolves starred UIDs to nav rows but has no MSW path, so stub it.
jest.mock('app/features/search/service/searcher');

// Spy on analytics so we can assert a failed save isn't recorded as a successful save.
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

// The starred dashboard the tests use: the stars fixture is seeded with its UID and the searcher
// resolves that UID to this row, so the synced Starred section is populated deterministically.
const [, { dashbdE, folderB }] = getFolderFixtures();
const STARRED_DASHBOARD = {
  uid: dashbdE.item.uid,
  name: dashbdE.item.title,
  url: `/d/${dashbdE.item.uid}`,
  kind: 'dashboard',
};

// Resolves starred uids to nav rows. Accepts a combined dashboard+folder list ({uid,name,url,kind})
// and filters by the requested `name`, so folders and dashboards both round-trip through one searcher.
const setupSearcher = (items = [STARRED_DASHBOARD]) => {
  const search = jest.fn(({ name }: { name: string[] }) => {
    const rows = items.filter((d) => name.includes(d.uid));
    return Promise.resolve({ view: { length: rows.length, get: (i: number) => rows[i] } });
  });
  jest.mocked(getGrafanaSearcher).mockReturnValue({ search } as unknown as ReturnType<typeof getGrafanaSearcher>);
};

setBackendSrv(backendSrv);
setupMockServer();

const seedBookmarks = (bookmarkUrls: string[] = []) => {
  setMockUserPreferences({ navbar: { bookmarkUrls } });
};

const CUSTOMISE_FLAG = 'grafana.customizableMegaMenu';
const getStoredHiddenItems = () => JSON.parse(window.localStorage.getItem(HIDDEN_ITEMS_STORAGE_KEY) ?? '[]');

const renderMegaMenu = ({
  navBarTree = customisableNavTree,
  hiddenItemIds = [],
  bookmarkUrls = [],
  sectionOrder,
  chrome,
}: {
  navBarTree?: NavModelItem[];
  hiddenItemIds?: string[];
  bookmarkUrls?: string[];
  sectionOrder?: string[];
  chrome?: AppChromeService;
} = {}) => {
  // Hidden state + section order are read from localStorage; pins come from preferences.
  window.localStorage.setItem(HIDDEN_ITEMS_STORAGE_KEY, JSON.stringify(hiddenItemIds));
  if (sectionOrder) {
    window.localStorage.setItem(SECTION_ORDER_STORAGE_KEY, JSON.stringify(sectionOrder));
  }
  seedBookmarks(bookmarkUrls);

  return render(<MegaMenu onClose={() => {}} />, {
    preloadedState: { navBarTree },
    ...(chrome ? { grafanaContext: { chrome } } : {}),
  });
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
      expect(screen.queryByRole('button', { name: 'Customise navigation' })).not.toBeInTheDocument();
    });

    it('shows a loading skeleton until preferences have loaded', async () => {
      // Keep the preferences request pending so the query stays in its loading state.
      server.use(customGetUserPreferencesHandler(() => new Promise(() => {})));

      renderMegaMenu();

      const list = await screen.findByRole('list', { name: 'Navigation' });
      expect(list).toHaveAttribute('aria-busy', 'true');
      expect(screen.queryByRole('link', { name: 'Explore' })).not.toBeInTheDocument();
    });

    it('hides the customise entry point until preferences have loaded, so pins are not cleared', async () => {
      // Hold the preferences GET pending. Entering edit mode now would start from an empty pinned
      // list, and pressing Done before preferences arrive would overwrite the user's saved pins with
      // []. The entry point must stay hidden until loading finishes.
      server.use(customGetUserPreferencesHandler(() => new Promise(() => {})));

      renderMegaMenu({ bookmarkUrls: ['/playlists'] });

      // The nav still renders (skeleton), but there's no way into edit mode while preferences load.
      await screen.findByRole('list', { name: 'Navigation' });
      expect(screen.queryByRole('button', { name: 'Customise navigation' })).not.toBeInTheDocument();
    });

    describe('reordering top-level sections', () => {
      it('renders the top-level sections in the stored order', async () => {
        renderMegaMenu({ sectionOrder: ['cfg', 'explore'] });

        // Wait for the real list (past the loading skeleton), then read the section order
        await screen.findByRole('link', { name: 'Administration' });
        const nav = within(screen.getByRole('list', { name: 'Navigation' }));
        const names = nav.getAllByRole('link').map((el) => el.textContent);
        expect(names.indexOf('Administration')).toBeLessThan(names.indexOf('Explore'));
      });

      it('offers a drag handle on each top-level section while editing', async () => {
        const { user } = renderMegaMenu();

        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        expect(screen.getByRole('button', { name: 'Reorder Explore' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Reorder Dashboards' })).toBeInTheDocument();
      });
    });

    describe('locking the rest of the menu while customising', () => {
      it('disables the close control until customising ends', async () => {
        const { user } = renderMegaMenu();

        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        expect(screen.getByRole('button', { name: 'Close menu' })).toBeDisabled();

        await user.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(screen.getByRole('button', { name: 'Close menu' })).toBeEnabled();
      });

      it('takes nav item links out of the tab order so they cannot navigate', async () => {
        const { user } = renderMegaMenu();

        // Outside edit mode the link is a normal navigation target.
        const exploreLink = await screen.findByRole('link', { name: 'Explore' });
        expect(exploreLink).not.toHaveAttribute('tabindex', '-1');

        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        expect(screen.getByRole('link', { name: 'Explore' })).toHaveAttribute('tabindex', '-1');
      });
    });

    describe('hiding top-level sections', () => {
      it('hides a top-level section, but shows it (greyed) while editing', async () => {
        const { user } = renderMegaMenu({ hiddenItemIds: ['explore'] });

        expect(screen.queryByRole('link', { name: 'Explore' })).not.toBeInTheDocument();
        expect(await screen.findByRole('link', { name: 'Alerting' })).toBeInTheDocument();

        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        expect(await screen.findByRole('link', { name: 'Explore' })).toBeInTheDocument();
        expect(await screen.findByRole('button', { name: 'Show Explore' })).toBeInTheDocument();
      });

      it('offers the hide toggle on sections and children, but not protected/create items', async () => {
        const { user } = renderMegaMenu();

        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        expect(await screen.findByRole('button', { name: 'Hide Explore' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Hide Home' })).not.toBeInTheDocument();

        // Children are hideable too, but create actions (New dashboard) are not.
        await user.click(await screen.findByRole('button', { name: 'Expand section: Dashboards' }));
        expect(await screen.findByRole('button', { name: 'Hide Playlists' })).toBeInTheDocument();
        const labels = screen.getAllByRole('button', { hidden: true }).map((b) => b.getAttribute('aria-label'));
        expect(labels).not.toContain('Hide New');
      });

      it('hides a child item — greyed while editing, removed from the nav after Done', async () => {
        const { user } = renderMegaMenu();

        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        await user.click(await screen.findByRole('button', { name: 'Expand section: Dashboards' }));
        await user.click(await screen.findByRole('button', { name: 'Hide Playlists' }));

        // Hiding reports an interaction (path = the item's url).
        expect(reportInteraction).toHaveBeenCalledWith(
          'grafana_nav_item_hidden',
          expect.objectContaining({ path: '/playlists' })
        );

        // While editing it stays visible (greyed) and the control flips to a Show toggle.
        await user.click(await screen.findByRole('button', { name: 'Show Playlists' }));

        // Revealing flips the control back — the item is no longer marked hidden.
        await user.click(await screen.findByRole('button', { name: 'Hide Playlists' }));
        expect(await screen.findByRole('button', { name: 'Show Playlists' })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Done' }));
        expect(getStoredHiddenItems()).toEqual(['dashboards/playlists']);
        // Dashboards stays expanded: the hidden child is gone but its siblings remain.
        expect(screen.queryByRole('link', { name: 'Playlists' })).not.toBeInTheDocument();
        expect(await screen.findByRole('link', { name: 'Snapshots' })).toBeInTheDocument();
      });

      it('persists hidden sections to localStorage on Done (pins untouched)', async () => {
        const { user } = renderMegaMenu();

        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        await user.click(await screen.findByRole('button', { name: 'Hide Explore' }));
        await user.click(await screen.findByRole('button', { name: 'Hide Alerting' }));
        await user.click(await screen.findByRole('button', { name: 'Done' }));

        expect(getStoredHiddenItems()).toEqual(['explore', 'alerting']);
        await waitFor(() => expect(mockUserPreferences.navbar?.bookmarkUrls).toEqual([]));
      });

      it('discards changes on Cancel', async () => {
        const { user } = renderMegaMenu();

        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        await user.click(await screen.findByRole('button', { name: 'Hide Explore' }));
        await user.click(await screen.findByRole('button', { name: 'Cancel' }));

        expect(await screen.findByRole('link', { name: 'Explore' })).toBeInTheDocument();
      });

      it('toggles the chrome customising flag on enter and exit (drives the page de-emphasis overlay)', async () => {
        const chrome = new AppChromeService();
        const { user } = renderMegaMenu({ chrome });

        expect(chrome.state.getValue().megaMenuCustomising).toBeFalsy();

        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        expect(chrome.state.getValue().megaMenuCustomising).toBe(true);

        await user.click(await screen.findByRole('button', { name: 'Cancel' }));
        expect(chrome.state.getValue().megaMenuCustomising).toBe(false);
      });
    });

    describe('pinning', () => {
      const pinnedRegion = () => within(screen.getByRole('list', { name: 'Pinned' }));

      it('shows a pinned child as a breadcrumb in the grey box, and keeps it in the nav', async () => {
        const { user } = renderMegaMenu({ bookmarkUrls: ['/playlists'] });

        await screen.findByRole('list', { name: 'Pinned' });
        // The box shows the breadcrumb "Dashboards › Playlists" as a single link with an ancestor crumb.
        expect(pinnedRegion().getByRole('link', { name: /Playlists/ })).toBeInTheDocument();
        expect(pinnedRegion().getByText('Dashboards')).toBeInTheDocument();
        // No dedicated Bookmarks section
        expect(screen.queryByRole('link', { name: 'Bookmarks' })).not.toBeInTheDocument();

        // Pinning didn't remove it from the nav — expand Dashboards and it's still there (now 2 copies)
        await user.click(screen.getByRole('button', { name: 'Expand section: Dashboards' }));
        expect(screen.getAllByText('Playlists')).toHaveLength(2);
      });

      it('does not render the pinned box when nothing is pinned', async () => {
        renderMegaMenu();

        await screen.findByRole('link', { name: 'Explore' });
        expect(screen.queryByRole('list', { name: 'Pinned' })).not.toBeInTheDocument();
      });

      it('does not render a divider between the pinned box and the nav', async () => {
        renderMegaMenu({ bookmarkUrls: ['/playlists'] });

        await screen.findByRole('list', { name: 'Pinned' });
        expect(screen.queryByRole('separator')).not.toBeInTheDocument();
      });

      it('pins a child from the nav into the box, staged and persisted on Done', async () => {
        const { user } = renderMegaMenu();

        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        await user.click(await screen.findByRole('button', { name: 'Expand section: Dashboards' }));
        const pin = screen
          .getAllByRole('button', { hidden: true })
          .find((button) => button.getAttribute('aria-label') === 'Pin Playlists');
        await user.click(pin!);

        expect(
          within(await screen.findByRole('list', { name: 'Pinned' })).getByRole('link', { name: /Playlists/ })
        ).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Done' }));
        await waitFor(() => expect(mockUserPreferences.navbar?.bookmarkUrls).toEqual(['/playlists']));
      });

      it('does not offer a pin control outside edit mode', async () => {
        renderMegaMenu();

        // The Dashboards children render, but no pin control is available until customising.
        await screen.findByRole('link', { name: 'Explore' });
        const labels = screen.getAllByRole('button', { hidden: true }).map((b) => b.getAttribute('aria-label'));
        expect(labels.some((l) => l?.startsWith('Pin '))).toBe(false);
      });

      it('offers a pin control on all top-level sections, including parents', async () => {
        const { user } = renderMegaMenu();

        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        await screen.findByRole('link', { name: 'Dashboards' });
        const labels = screen.getAllByRole('button', { hidden: true }).map((b) => b.getAttribute('aria-label'));
        // Parent sections are pinnable as a quick-link (as well as their children being pinnable).
        expect(labels).toContain('Pin Dashboards');
        expect(labels).toContain('Pin Administration');
        // Childless top-level sections (Explore) are pinnable too.
        expect(labels).toContain('Pin Explore');
      });

      it('pins a top-level parent section as a quick-link and keeps it in the nav', async () => {
        const { user } = renderMegaMenu();

        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        const pin = screen
          .getAllByRole('button', { hidden: true })
          .find((button) => button.getAttribute('aria-label') === 'Pin Dashboards');
        await user.click(pin!);
        await user.click(screen.getByRole('button', { name: 'Done' }));

        await waitFor(() => expect(mockUserPreferences.navbar?.bookmarkUrls).toEqual(['/dashboards']));
        // Shows in the box as a single breadcrumb quick-link…
        const pinned = within(await screen.findByRole('list', { name: 'Pinned' }));
        expect(pinned.getByRole('link', { name: 'Dashboards' })).toBeInTheDocument();
        // …and still appears in the nav below (pinning duplicates, it doesn't move).
        expect(screen.getAllByRole('link', { name: 'Dashboards' }).length).toBeGreaterThanOrEqual(2);
      });

      it('offers a pin control on the Starred section (special case) but not its dashboards', async () => {
        const { user } = renderMegaMenu();

        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        await user.click(await screen.findByRole('button', { name: 'Expand section: Starred' }));
        expect(await screen.findByRole('link', { name: STARRED_DASHBOARD.name })).toBeInTheDocument();

        const labels = screen.getAllByRole('button', { hidden: true }).map((b) => b.getAttribute('aria-label'));
        expect(labels).toContain('Pin Starred'); // the Starred section itself is pinnable
        expect(labels).not.toContain(`Pin ${STARRED_DASHBOARD.name}`); // but its sub-dashboards are not
      });

      it('pins the top-level Starred section, listing its dashboards in the box', async () => {
        const { user } = renderMegaMenu();

        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        const pin = screen
          .getAllByRole('button', { hidden: true })
          .find((button) => button.getAttribute('aria-label') === 'Pin Starred');
        await user.click(pin!);
        await user.click(screen.getByRole('button', { name: 'Done' }));

        await waitFor(() => expect(mockUserPreferences.navbar?.bookmarkUrls).toEqual(['/dashboards?starred']));
        // The box expands the pin into one breadcrumb line per starred dashboard ("Starred › <name>").
        const pinned = within(await screen.findByRole('list', { name: 'Pinned' }));
        expect(await pinned.findByRole('link', { name: new RegExp(STARRED_DASHBOARD.name) })).toBeInTheDocument();
        expect(pinned.getByText('Starred')).toBeInTheDocument();
      });

      it('makes Starred pinnable rather than hideable', async () => {
        const { user } = renderMegaMenu();

        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        await screen.findByRole('link', { name: 'Starred' });
        const labels = screen.getAllByRole('button', { hidden: true }).map((b) => b.getAttribute('aria-label'));
        expect(labels).toContain('Pin Starred');
        expect(labels).not.toContain('Hide Starred');
      });

      it('offers an unpin control on the pinned endpoint, not the ancestor', async () => {
        const { user } = renderMegaMenu({ bookmarkUrls: ['/playlists'] });

        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        const labels = pinnedRegion()
          .getAllByRole('button', { hidden: true })
          .map((b) => b.getAttribute('aria-label'));
        expect(labels).toContain('Unpin Playlists');
        expect(labels).not.toContain('Unpin Dashboards'); // ancestor is context only
      });

      it('unpins from the box on Done', async () => {
        const { user } = renderMegaMenu({ bookmarkUrls: ['/playlists'] });

        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        const unpin = pinnedRegion()
          .getAllByRole('button', { hidden: true })
          .find((button) => button.getAttribute('aria-label') === 'Unpin Playlists');
        await user.click(unpin!);
        await user.click(screen.getByRole('button', { name: 'Done' }));

        await waitFor(() => expect(mockUserPreferences.navbar?.bookmarkUrls).toEqual([]));
        await waitFor(() => expect(screen.queryByRole('list', { name: 'Pinned' })).not.toBeInTheDocument());
      });

      it('keeps the collapsible Bookmarks section when the flag is off, skipping orphaned urls', async () => {
        setTestFlags({ [CUSTOMISE_FLAG]: false });
        // The second url matches no nav item, so it's safely skipped when building the section.
        renderMegaMenu({ bookmarkUrls: ['/explore', '/orphaned-not-in-nav'] });

        expect(await screen.findByRole('button', { name: 'Expand section: Bookmarks' })).toBeInTheDocument();
      });

      it('keeps the legacy bookmark control when the flag is off', async () => {
        setTestFlags({ [CUSTOMISE_FLAG]: false });
        const { user } = renderMegaMenu();

        await user.click(await screen.findByRole('button', { name: 'Expand section: Starred' }));
        await screen.findByRole('link', { name: STARRED_DASHBOARD.name });

        const labels = screen
          .getAllByRole('button', { hidden: true })
          .map((button) => button.getAttribute('aria-label'));
        expect(labels).toContain('Bookmark Explore');
        expect(labels).toContain(`Bookmark ${STARRED_DASHBOARD.name}`);
      });

      it('toggles a bookmark from the legacy control when the flag is off', async () => {
        setTestFlags({ [CUSTOMISE_FLAG]: false });
        const { user } = renderMegaMenu();

        const bookmark = (await screen.findAllByRole('button', { hidden: true })).find(
          (b) => b.getAttribute('aria-label') === 'Bookmark Explore'
        );
        await user.click(bookmark!);

        // The legacy path persists via the bookmark urls and populates the Bookmarks section.
        await waitFor(() => expect(mockUserPreferences.navbar?.bookmarkUrls).toEqual(['/explore']));
        expect(await screen.findByRole('button', { name: 'Expand section: Bookmarks' })).toBeInTheDocument();
      });
    });

    describe('edit-mode controls', () => {
      it('offers the unpin control only while editing', async () => {
        const { user } = renderMegaMenu({ bookmarkUrls: ['/playlists'] });

        await screen.findByRole('list', { name: 'Pinned' });
        // Outside edit mode the box is read-only — no unpin control.
        const before = screen.getAllByRole('button', { hidden: true }).map((b) => b.getAttribute('aria-label'));
        expect(before).not.toContain('Unpin Playlists');

        await user.click(screen.getByRole('button', { name: 'Customise navigation' }));
        const after = screen.getAllByRole('button', { hidden: true }).map((b) => b.getAttribute('aria-label'));
        expect(after).toContain('Unpin Playlists');
      });

      it('does not show reset to default until something is customised', async () => {
        const { user } = renderMegaMenu();

        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        expect(
          screen.queryByRole('button', { name: 'Reset navigation - show all items, unpin all and reset order' })
        ).not.toBeInTheDocument();
      });

      it('stages a reset and only persists it on Done', async () => {
        const { user } = renderMegaMenu({ hiddenItemIds: ['explore'], bookmarkUrls: ['/playlists'] });

        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        expect(screen.getByRole('list', { name: 'Pinned' })).toBeInTheDocument();

        await user.click(
          await screen.findByRole('button', { name: 'Reset navigation - show all items, unpin all and reset order' })
        );
        // Staged, not saved — the box clears in the preview but the stored pins are untouched
        expect(mockUserPreferences.navbar?.bookmarkUrls).toEqual(['/playlists']);
        expect(screen.queryByRole('list', { name: 'Pinned' })).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Done' }));
        expect(getStoredHiddenItems()).toEqual([]);
        await waitFor(() => expect(mockUserPreferences.navbar?.bookmarkUrls).toEqual([]));
      });

      it('shows a saving state on Done while the pins are being persisted', async () => {
        // Hold the preferences PATCH pending so the saving state stays observable
        server.use(customPatchUserPreferencesHandler(() => new Promise(() => {})));

        const { user } = renderMegaMenu();
        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        await user.click(await screen.findByRole('button', { name: 'Expand section: Dashboards' }));
        const pin = screen
          .getAllByRole('button', { hidden: true })
          .find((button) => button.getAttribute('aria-label') === 'Pin Playlists');
        await user.click(pin!);
        await user.click(screen.getByRole('button', { name: 'Done' }));

        const saving = await screen.findByRole('button', { name: 'Saving…' });
        expect(saving).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();

        // All editing controls are disabled while the save is in flight, so edits made against the
        // in-flight snapshot can't be silently overwritten when it resolves. Playlists is now pinned,
        // so it has an unpin control in both the pinned box and the nav — both must be disabled.
        const unpins = screen
          .getAllByRole('button', { hidden: true })
          .filter((button) => button.getAttribute('aria-label') === 'Unpin Playlists');
        expect(unpins.length).toBeGreaterThanOrEqual(2);
        unpins.forEach((button) => expect(button).toBeDisabled());
      });

      it('stays in edit mode and persists nothing when the save fails', async () => {
        // Make the preferences PATCH fail so the save errors out.
        server.use(customPatchUserPreferencesHandler(() => HttpResponse.json({ message: 'nope' }, { status: 500 })));

        const { user } = renderMegaMenu();
        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        await user.click(await screen.findByRole('button', { name: 'Expand section: Dashboards' }));
        const pin = screen
          .getAllByRole('button', { hidden: true })
          .find((button) => button.getAttribute('aria-label') === 'Pin Playlists');
        await user.click(pin!);
        await user.click(screen.getByRole('button', { name: 'Done' }));

        // The save failed: we stay in edit mode (Done/Cancel remain) and nothing is persisted.
        expect(await screen.findByRole('button', { name: 'Done' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        expect(mockUserPreferences.navbar?.bookmarkUrls ?? []).toEqual([]);
        // A failed save must not be recorded as a successful one.
        expect(reportInteraction).not.toHaveBeenCalledWith('grafana_nav_customise_saved', expect.anything());
      });

      it('reports a successful save only once the pins have persisted', async () => {
        const { user } = renderMegaMenu();
        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        await user.click(await screen.findByRole('button', { name: 'Expand section: Dashboards' }));
        const pin = screen
          .getAllByRole('button', { hidden: true })
          .find((button) => button.getAttribute('aria-label') === 'Pin Playlists');
        await user.click(pin!);
        await user.click(screen.getByRole('button', { name: 'Done' }));

        await waitFor(() => expect(mockUserPreferences.navbar?.bookmarkUrls).toEqual(['/playlists']));
        // objectContaining: the event also carries the A/B experiment variant stamp.
        expect(reportInteraction).toHaveBeenCalledWith(
          'grafana_nav_customise_saved',
          expect.objectContaining({ hiddenCount: 0, pinnedCount: 1 })
        );
      });
    });
  });

  describe('when starredFolders is enabled', () => {
    testWithFeatureToggles({ enable: ['starsFromAPIServer', 'foldersAppPlatformAPI'] });

    // Flag cleanup is handled by the outer afterEach (act-wrapped, since setTestFlags fires
    // OpenFeature events into the still-mounted menu).
    beforeEach(() => {
      setTestFlags({ 'grafana.starredFolders': true });
    });

    it('renders a starred folder and a same-named starred dashboard as two distinct, per-kind-iconed rows', async () => {
      const dashUid = dashbdE.item.uid;
      const folderUid = folderB.item.uid;
      // A folder and a dashboard that share a display name — only the icon tells them apart.
      setMockStarredDashboards([dashUid]);
      setMockStarredFolders([folderUid]);
      setupSearcher([
        { uid: dashUid, name: 'Shared Name', url: `/d/${dashUid}`, kind: 'dashboard' },
        { uid: folderUid, name: 'Shared Name', url: `/dashboards/f/${folderUid}`, kind: 'folder' },
      ]);

      const { user } = renderMegaMenu();

      await user.click(await screen.findByRole('button', { name: 'Expand section: Starred' }));

      // The real sync replaces the placeholder Starred child with both starred items.
      const starredSection = () => within(screen.getByRole('link', { name: 'Starred' }).closest('li')!);
      await waitFor(() => {
        expect(starredSection().getAllByRole('link', { name: 'Shared Name' })).toHaveLength(2);
      });

      // Same name, but the per-kind icons make the two rows distinguishable.
      expect(starredSection().getByTestId('icon-apps')).toBeInTheDocument();
      expect(starredSection().getByTestId('icon-folder')).toBeInTheDocument();

      // The icons also expose the kind as an accessible title (which lifts Icon's aria-hidden),
      // so screen readers don't hear the two rows as identical links.
      expect(starredSection().getByTitle('Dashboard')).toBe(starredSection().getByTestId('icon-apps'));
      expect(starredSection().getByTitle('Folder')).toBe(starredSection().getByTestId('icon-folder'));
    });
  });
});
