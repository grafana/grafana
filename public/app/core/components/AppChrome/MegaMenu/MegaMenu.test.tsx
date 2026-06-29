import { act, getWrapper, render, screen, userEvent, waitFor, within } from 'test/test-utils';

import { type NavModelItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { reportExperimentView, reportInteraction, setBackendSrv } from '@grafana/runtime';
import server, { setupMockServer } from '@grafana/test-utils/server';
import {
  customGetUserPreferencesHandler,
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
import { NAV_EXPERIMENT_GROUP, NAV_EXPERIMENT_ID, resetNavExperimentStateForTests } from './navExperiment';

// The org switcher fetches user orgs on mount when signed in, which is irrelevant here.
jest.mock('../OrganizationSwitcher/OrganizationSwitcher', () => ({
  OrganizationSwitcher: () => null,
}));

// Spy on the analytics reporters so we can assert the experiment exposure and the variant/org
// stamped onto the KPI interactions, while keeping the rest of @grafana/runtime real.
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
  reportExperimentView: jest.fn(),
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

const renderMegaMenu = ({
  navBarTree = customisableNavTree,
  bookmarkUrls = [],
}: { navBarTree?: NavModelItem[]; bookmarkUrls?: string[] } = {}) => {
  seedBookmarks(bookmarkUrls);

  return render(<MegaMenu onClose={() => {}} />, { preloadedState: { navBarTree } });
};

describe('MegaMenu', () => {
  beforeEach(() => {
    // Seed one starred dashboard and the searcher that resolves it, so the real starred-items sync
    // populates the Starred section deterministically (the stars query runs regardless of sign-in).
    setMockStarredDashboards([STARRED_DASHBOARD.uid]);
    setupSearcher();
    // The exposure guard and cached variant live in module scope, so reset them per test.
    resetNavExperimentStateForTests();
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
      contextSrv.user.orgId = 42;
    });

    afterEach(() => {
      contextSrv.isSignedIn = false;
      contextSrv.user.isSignedIn = false;
      contextSrv.user.orgId = 0;
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

    describe('experiment instrumentation', () => {
      it('fires the exposure event once with the treatment variant', async () => {
        renderMegaMenu();

        await screen.findByRole('link', { name: 'Explore' });
        expect(reportExperimentView).toHaveBeenCalledTimes(1);
        expect(reportExperimentView).toHaveBeenCalledWith(NAV_EXPERIMENT_ID, NAV_EXPERIMENT_GROUP, 'treatment');
      });

      it('fires the exposure event with the control variant when the flag is off', async () => {
        setTestFlags({ [CUSTOMISE_FLAG]: false });
        renderMegaMenu();

        await screen.findByRole('link', { name: 'Explore' });
        expect(reportExperimentView).toHaveBeenCalledTimes(1);
        expect(reportExperimentView).toHaveBeenCalledWith(NAV_EXPERIMENT_ID, NAV_EXPERIMENT_GROUP, 'control');
      });

      it('stamps the variant and org onto the nav click interaction', async () => {
        const { user } = renderMegaMenu();

        await user.click(await screen.findByRole('link', { name: 'Explore' }));

        expect(reportInteraction).toHaveBeenCalledWith(
          'grafana_navigation_item_clicked',
          expect.objectContaining({ experiment_nav_customization: 'treatment', org_id: 42 })
        );
      });

      it('stamps the variant and org onto the pin interaction', async () => {
        const { user } = renderMegaMenu();

        await screen.findByRole('link', { name: 'Dashboards' });
        const pinButton = screen
          .getAllByRole('button', { hidden: true })
          .find((button) => button.getAttribute('aria-label') === 'Pin Dashboards');
        await user.click(pinButton!);

        await waitFor(() =>
          expect(reportInteraction).toHaveBeenCalledWith(
            'grafana_nav_item_pinned',
            expect.objectContaining({ path: '/dashboards', experiment_nav_customization: 'treatment', org_id: 42 })
          )
        );
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

        await screen.findByRole('link', { name: 'Dashboards' });
        // The pin control in the normal nav is hover-only (visibility:hidden), so select it by label
        const pinButton = screen
          .getAllByRole('button', { hidden: true })
          .find((button) => button.getAttribute('aria-label') === 'Pin Dashboards');
        await user.click(pinButton!);

        // The section is pinned by its own url (not by enumerating children)
        await waitFor(() => expect(mockUserPreferences.navbar?.bookmarkUrls).toEqual(['/dashboards']));
        // ...and shows up in the pinned area with its children, and no longer in the normal nav
        const pinned = within(await screen.findByRole('list', { name: 'Pinned' }));
        expect(pinned.getByRole('link', { name: 'Dashboards' })).toBeInTheDocument();
        expect(pinned.getByRole('link', { name: 'Playlists' })).toBeInTheDocument();
        expect(screen.getAllByRole('link', { name: 'Dashboards' })).toHaveLength(1);
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
        renderMegaMenu({ bookmarkUrls: ['/dashboards'] });

        const pinned = within(await screen.findByRole('list', { name: 'Pinned' }));
        const labels = pinned.getAllByRole('button', { hidden: true }).map((b) => b.getAttribute('aria-label'));
        expect(labels).toContain('Unpin Dashboards');
        expect(labels).toContain('Unpin Playlists');
        expect(labels).toContain('Unpin Snapshots');
      });

      it('unpinning the top-level section removes the whole group', async () => {
        const { user } = renderMegaMenu({ bookmarkUrls: ['/dashboards'] });

        const pinned = within(await screen.findByRole('list', { name: 'Pinned' }));
        const sectionUnpin = pinned
          .getAllByRole('button', { hidden: true })
          .find((button) => button.getAttribute('aria-label') === 'Unpin Dashboards');
        await user.click(sectionUnpin!);

        await waitFor(() => expect(mockUserPreferences.navbar?.bookmarkUrls).toEqual([]));
        await waitFor(() => expect(screen.queryByRole('list', { name: 'Pinned' })).not.toBeInTheDocument());
      });

      it('unpinning one child of a whole-pinned section expands to the remaining siblings', async () => {
        const { user } = renderMegaMenu({ bookmarkUrls: ['/dashboards'] });

        const pinned = within(await screen.findByRole('list', { name: 'Pinned' }));
        const childUnpin = pinned
          .getAllByRole('button', { hidden: true })
          .find((button) => button.getAttribute('aria-label') === 'Unpin Playlists');
        await user.click(childUnpin!);

        // The section is replaced by its remaining (still-pinned) sibling
        await waitFor(() => expect(mockUserPreferences.navbar?.bookmarkUrls).toEqual(['/snapshots']));
      });

      it('unpins from the pinned area and restores the item', async () => {
        const { user } = renderMegaMenu({ bookmarkUrls: ['/admin/settings'] });

        // The unpin control is hover-only (visibility:hidden), so select it by label
        const pinned = within(await screen.findByRole('list', { name: 'Pinned' }));
        const unpinButton = pinned
          .getAllByRole('button', { hidden: true })
          .find((button) => button.getAttribute('aria-label') === 'Unpin Settings');
        await user.click(unpinButton!);

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
        expect(screen.queryByRole('button', { name: 'Hide unpinned items' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Show unpinned items' })).not.toBeInTheDocument();
      });

      it('collapses and expands the non-pinned items while keeping pinned items visible', async () => {
        const { user } = renderMegaMenu({ bookmarkUrls: ['/playlists'] });

        // Expanded by default — other items are visible
        expect(await screen.findByRole('link', { name: 'Alerting' })).toBeInTheDocument();

        // The toggle is wired to the unpinned list for a11y (aria-controls + aria-expanded)
        const toggle = screen.getByRole('button', { name: 'Hide unpinned items' });
        const controlledId = toggle.getAttribute('aria-controls');
        expect(controlledId).toBeTruthy();
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
        expect(document.getElementById(controlledId!)).toContainElement(screen.getByRole('link', { name: 'Alerting' }));

        // Collapse: the non-pinned items disappear but the pinned ones remain
        await user.click(toggle);
        expect(screen.queryByRole('link', { name: 'Alerting' })).not.toBeInTheDocument();
        expect(
          within(screen.getByRole('list', { name: 'Pinned' })).getByRole('link', { name: 'Playlists' })
        ).toBeInTheDocument();

        // Expand again
        await user.click(screen.getByRole('button', { name: 'Show unpinned items' }));
        expect(await screen.findByRole('link', { name: 'Alerting' })).toBeInTheDocument();
      });

      it('resets the collapse when all items are unpinned, so re-pinning starts expanded', async () => {
        const { user } = renderMegaMenu({ bookmarkUrls: ['/explore'] });

        // Collapse the rest
        await user.click(await screen.findByRole('button', { name: 'Hide unpinned items' }));
        expect(screen.queryByRole('link', { name: 'Alerting' })).not.toBeInTheDocument();

        // Unpin everything
        const unpin = within(screen.getByRole('list', { name: 'Pinned' }))
          .getAllByRole('button', { hidden: true })
          .find((button) => button.getAttribute('aria-label') === 'Unpin Explore');
        await user.click(unpin!);
        await waitFor(() => expect(screen.queryByRole('list', { name: 'Pinned' })).not.toBeInTheDocument());

        // Re-pin — the menu must not still be collapsed
        const rePin = screen
          .getAllByRole('button', { hidden: true })
          .find((button) => button.getAttribute('aria-label') === 'Pin Explore');
        await user.click(rePin!);

        expect(await screen.findByRole('list', { name: 'Pinned' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Alerting' })).toBeInTheDocument();
      });
    });
  });
});
