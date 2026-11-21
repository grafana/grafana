import { HttpResponse } from 'msw';
import { type JSX } from 'react';
import { testWithStarsUser } from 'test/helpers/testWithStarsUser';
import { act, fireEvent, render, screen, userEvent, waitFor, within } from 'test/test-utils';

import { type NavModelItem, PluginExtensionPoints } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config, reportInteraction, setBackendSrv, setPluginComponentsHook } from '@grafana/runtime';
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
import { createComponentWithMeta } from 'app/features/plugins/extensions/usePluginComponents';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';

import { MegaMenu } from './MegaMenu';
import { type MegaMenuSectionProps } from './MegaMenuSectionExtensionPoint';
import { customisableNavTree, nestedNavTree } from './__mocks__/fixtures';
import { HIDDEN_ITEMS_STORAGE_KEY, SECTION_ORDER_STORAGE_KEY } from './hooks';
import {
  MEGA_MENU_NAV_HEIGHT_STORAGE_KEY,
  MEGA_MENU_SECTION_COLLAPSED_STORAGE_KEY,
} from './useMegaMenuSectionSplitter';
import { HIDDEN_NAV_ITEMS } from './utils';

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
    return Promise.resolve({ view: { length: rows.length, get: (i: number) => rows[i], toArray: () => rows } });
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
}: {
  navBarTree?: NavModelItem[];
  hiddenItemIds?: string[];
  bookmarkUrls?: string[];
  sectionOrder?: string[];
} = {}) => {
  // Hidden state + section order are read from localStorage; pins come from preferences.
  window.localStorage.setItem(HIDDEN_ITEMS_STORAGE_KEY, JSON.stringify(hiddenItemIds));
  if (sectionOrder) {
    window.localStorage.setItem(SECTION_ORDER_STORAGE_KEY, JSON.stringify(sectionOrder));
  }
  seedBookmarks(bookmarkUrls);

  return render(<MegaMenu onClose={() => {}} />, { preloadedState: { navBarTree } });
};

testWithStarsUser();

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

  describe('profile', () => {
    const PROFILE_FLAG = 'grafana.megaMenuProfile';
    const renderWithProfile = () =>
      render(<MegaMenu onClose={() => {}} />, {
        preloadedState: {
          navBarTree: nestedNavTree,
          navIndex: { profile: { id: 'profile', text: 'Test User', url: '/profile', children: [] } },
        },
      });

    it('shows the profile at the bottom of the menu while grafana.megaMenuProfile is on', async () => {
      setTestFlags({ [PROFILE_FLAG]: true });
      const { user } = renderWithProfile();

      await user.click(await screen.findByRole('button', { name: /profile/i }));

      expect(await screen.findByRole('menuitem', { name: /sign out/i })).toBeInTheDocument();
    });

    it('offers Customise navigation as an item below the profile, not as a footer button', async () => {
      setTestFlags({ [PROFILE_FLAG]: true, [CUSTOMISE_FLAG]: true });
      const { user } = renderWithProfile();

      const customise = await screen.findByRole('button', { name: 'Customise navigation' });
      const profile = screen.getByRole('button', { name: /profile/i });
      expect(profile.compareDocumentPosition(customise) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

      await user.click(customise);

      expect(await screen.findByRole('button', { name: 'Done' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Customise navigation' })).not.toBeInTheDocument();
    });

    it('leaves the profile to the top bar while the toggle is off', async () => {
      setTestFlags({ [PROFILE_FLAG]: false });
      renderWithProfile();

      await screen.findByTestId(selectors.components.NavMenu.Menu);
      expect(screen.queryByRole('button', { name: /profile/i })).not.toBeInTheDocument();
    });
  });

  it('should filter out home', async () => {
    renderMegaMenu({ navBarTree: nestedNavTree });

    expect(await screen.findByRole('link', { name: 'Section name' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
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

    it.each(['', '/grafana'])(
      'hides plugin URL keys while preserving ID keys under subpath "%s"',
      async (appSubUrl) => {
        config.appSubUrl = appSubUrl;
        setTestFlags({ 'grafana.navigationInfoArchRefresh': true });
        const { user } = renderMegaMenu({
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
            { id: 'home', text: 'Home', url: `${appSubUrl}/` },
          ],
        });

        await user.click(await screen.findByRole('button', { name: 'Expand section: Adaptive Metrics' }));

        expect(screen.getByRole('link', { name: 'Customizations' })).toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Configuration' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Playlists' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
      }
    );

    it.each([false, true])(
      'applies hard-coded exclusions only when the refresh flag is enabled: %s',
      async (enabled) => {
        setTestFlags({ 'grafana.navigationInfoArchRefresh': enabled });
        const { user } = renderMegaMenu({ navBarTree: nestedNavTree });

        await user.click(await screen.findByRole('button', { name: 'Expand section: Section name' }));
        await user.click(screen.getByRole('button', { name: 'Expand section: Child1' }));

        expect(screen.getByRole('link', { name: 'Grandchild1' })).toBeInTheDocument();
        if (enabled) {
          expect(screen.queryByRole('link', { name: 'Child2' })).not.toBeInTheDocument();
        } else {
          expect(screen.getByRole('link', { name: 'Child2' })).toBeInTheDocument();
        }
        expect(screen.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
      }
    );
  });

  describe('administration section nav', () => {
    const administrationTree: NavModelItem[] = [
      { id: 'dashboards', text: 'Dashboards', url: '/dashboards' },
      {
        id: 'cfg',
        text: 'Administration',
        url: '/admin',
        icon: 'cog',
        children: [
          {
            id: 'cfg/general',
            text: 'General',
            url: '/admin/general',
            children: [{ id: 'org-settings', text: 'Default preferences', url: '/org' }],
          },
          {
            id: 'cfg/access',
            text: 'Users and access',
            url: '/admin/access',
            children: [{ id: 'global-users', text: 'Users', url: '/admin/users' }],
          },
        ],
      },
    ];

    it.each([false, true])(
      'shows Administration as a single row without destinations when the flag is on, regardless of the refresh flag: refresh %s',
      async (refresh) => {
        setTestFlags({ 'grafana.navigationAdminSubNav': true, 'grafana.navigationInfoArchRefresh': refresh });
        renderMegaMenu({ navBarTree: administrationTree });

        expect(await screen.findByRole('link', { name: 'Administration' })).toHaveAttribute('href', '/admin');
        expect(screen.queryByRole('button', { name: 'Expand section: Administration' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'General' })).not.toBeInTheDocument();
        expect(screen.queryByRole('link', { name: 'Users and access' })).not.toBeInTheDocument();
      }
    );

    it('lists its destinations as before when the flag is off', async () => {
      setTestFlags({ 'grafana.navigationAdminSubNav': false });
      const { user } = renderMegaMenu({ navBarTree: administrationTree });

      await user.click(await screen.findByRole('button', { name: 'Expand section: Administration' }));

      expect(screen.getByRole('link', { name: 'General' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Users and access' })).toBeInTheDocument();
    });

    it('leaves other sections with destinations alone when the flag is on', async () => {
      setTestFlags({ 'grafana.navigationAdminSubNav': true });
      const { user } = renderMegaMenu({ navBarTree: nestedNavTree });

      await user.click(await screen.findByRole('button', { name: 'Expand section: Section name' }));

      expect(await screen.findByRole('link', { name: 'Child1' })).toBeInTheDocument();
    });
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

    describe('plugin section', () => {
      // Built once: a new component type per render would remount the section.
      const conversationsSection = createComponentWithMeta<Partial<MegaMenuSectionProps> & JSX.IntrinsicAttributes>(
        {
          pluginId: 'grafana-assistant-app',
          title: 'Conversations',
          component: () => <div>Conversations section</div>,
        },
        PluginExtensionPoints.MegaMenuSection
      );

      beforeEach(() => {
        setPluginComponentsHook(({ extensionPointId }) => ({
          isLoading: false,
          components: extensionPointId === PluginExtensionPoints.MegaMenuSection ? [conversationsSection] : [],
        }));
      });

      afterEach(() => {
        setPluginComponentsHook(() => ({ components: [], isLoading: false }));
      });

      it('shows the Assistant section below the navigation', async () => {
        renderMegaMenu();

        const section = await screen.findByTestId('mega-menu-section');
        expect(within(section).getByText('Conversations section')).toBeInTheDocument();
      });

      it('hides the section while customising the navigation', async () => {
        const { user } = renderMegaMenu();
        await screen.findByText('Conversations section');

        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));

        expect(screen.queryByText('Conversations section')).not.toBeInTheDocument();
        expect(screen.queryByRole('separator', { name: 'Resize navigation' })).not.toBeInTheDocument();
      });

      describe('resizing the navigation above it', () => {
        let rectSpy: jest.SpyInstance;

        /**
         * jsdom has no layout, so the panes measure what the splitter's inline styles ask for: an 800px menu, and a
         * navigation 400px tall by its content, at least 80px and at most 600px.
         */
        const measuredHeight = (element: HTMLElement) => {
          const handle = screen.queryByRole('separator', { name: 'Resize navigation' });
          if (handle?.parentElement === element) {
            return 800;
          }
          if (handle && element.id === handle.getAttribute('aria-controls')) {
            if (element.style.flexGrow === '100') {
              return 600;
            }
            if (['0', '0px'].includes(element.style.flexBasis)) {
              return 80;
            }
            return parseFloat(element.style.flexBasis) || 400;
          }
          return 0;
        };

        beforeEach(() => {
          rectSpy = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
            this: HTMLElement
          ) {
            const height = measuredHeight(this);
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- a measured box without toJSON
            return { x: 0, y: 0, top: 0, left: 0, width: 320, height, right: 320, bottom: height } as DOMRect;
          });
        });

        afterEach(() => {
          rectSpy.mockRestore();
        });

        const findHandle = async () => {
          const handle = await screen.findByRole('separator', { name: 'Resize navigation' });
          handle.setPointerCapture = jest.fn();
          handle.releasePointerCapture = jest.fn();
          return handle;
        };
        const navigationPane = (handle: HTMLElement) => document.getElementById(handle.getAttribute('aria-controls')!)!;
        const storedHeight = () => window.localStorage.getItem(MEGA_MENU_NAV_HEIGHT_STORAGE_KEY);

        it('keeps the navigation at its own height until the handle is dragged, then remembers the height', async () => {
          const { user } = renderMegaMenu();
          const handle = await findHandle();
          expect(navigationPane(handle)).toHaveStyle({ flexBasis: 'auto' });

          await user.pointer([
            { keys: '[MouseLeft>]', target: handle, coords: { clientX: 0, clientY: 500 } },
            { target: handle, coords: { clientX: 0, clientY: 400 } },
            { keys: '[/MouseLeft]', target: handle, coords: { clientX: 0, clientY: 400 } },
          ]);

          expect(navigationPane(handle)).toHaveStyle({ flexBasis: '300px' });
          expect(storedHeight()).toBe('300');
        });

        it('opens with the height the navigation was given, and a double-click gives it its own height back', async () => {
          window.localStorage.setItem(MEGA_MENU_NAV_HEIGHT_STORAGE_KEY, '300');
          const { user } = renderMegaMenu();
          const handle = await findHandle();
          expect(navigationPane(handle)).toHaveStyle({ flexBasis: '300px' });

          await user.dblClick(handle);

          expect(navigationPane(handle)).toHaveStyle({ flexBasis: 'auto' });
          expect(storedHeight()).toBeNull();
        });

        it('starts a drag without selecting text, which would have the browser cancel it', async () => {
          renderMegaMenu();
          const handle = await findHandle();

          // `false`: the press was default-prevented.
          expect(fireEvent.pointerDown(handle, { button: 0 })).toBe(false);
        });

        it('does not pin the navigation when the handle is only clicked', async () => {
          const { user } = renderMegaMenu();
          const handle = await findHandle();

          await user.click(handle);

          expect(navigationPane(handle)).toHaveStyle({ flexBasis: 'auto' });
          expect(storedHeight()).toBeNull();
        });
      });

      describe('folding it to its heading', () => {
        // Built once: a new component type per render would remount the section.
        const foldableSection = createComponentWithMeta<Partial<MegaMenuSectionProps> & JSX.IntrinsicAttributes>(
          {
            pluginId: 'grafana-assistant-app',
            title: 'Conversations',
            component: ({ collapsed, onCollapsedChange }) => (
              <button type="button" aria-expanded={!collapsed} onClick={() => onCollapsedChange?.(!collapsed)}>
                Conversations
              </button>
            ),
          },
          PluginExtensionPoints.MegaMenuSection
        );
        const storedCollapsed = () => window.localStorage.getItem(MEGA_MENU_SECTION_COLLAPSED_STORAGE_KEY);

        beforeEach(() => {
          setPluginComponentsHook(({ extensionPointId }) => ({
            isLoading: false,
            components: extensionPointId === PluginExtensionPoints.MegaMenuSection ? [foldableSection] : [],
          }));
        });

        it('folds and unfolds from the section, without the resize handle while folded, and remembers it', async () => {
          const { user } = renderMegaMenu();
          const toggle = await screen.findByRole('button', { name: 'Conversations' });
          expect(toggle).toHaveAttribute('aria-expanded', 'true');

          await user.click(toggle);

          expect(toggle).toHaveAttribute('aria-expanded', 'false');
          expect(screen.queryByRole('separator', { name: 'Resize navigation' })).not.toBeInTheDocument();
          expect(storedCollapsed()).toBe('true');

          await user.click(toggle);

          expect(toggle).toHaveAttribute('aria-expanded', 'true');
          expect(screen.getByRole('separator', { name: 'Resize navigation' })).toBeInTheDocument();
          expect(storedCollapsed()).toBeNull();
        });

        it('opens with the section folded when the user left it folded', async () => {
          window.localStorage.setItem(MEGA_MENU_SECTION_COLLAPSED_STORAGE_KEY, 'true');
          renderMegaMenu();

          expect(await screen.findByRole('button', { name: 'Conversations' })).toHaveAttribute(
            'aria-expanded',
            'false'
          );
          expect(screen.queryByRole('separator', { name: 'Resize navigation' })).not.toBeInTheDocument();
        });
      });
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
    });

    describe('pinning', () => {
      const pinnedRegion = () => within(screen.getByRole('list', { name: 'Pinned items' }));

      it('keeps a pinned administration page in the pinned box while Administration is a single row', async () => {
        setTestFlags({ [CUSTOMISE_FLAG]: true, 'grafana.navigationAdminSubNav': true });
        renderMegaMenu({ bookmarkUrls: ['/admin/settings'] });

        await screen.findByRole('list', { name: 'Pinned items' });
        expect(pinnedRegion().getByRole('link', { name: /Settings/ })).toBeInTheDocument();
        expect(pinnedRegion().getByText('Administration')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Expand section: Administration' })).not.toBeInTheDocument();
      });

      it('lets Administration be hidden while it is a single row', async () => {
        setTestFlags({ [CUSTOMISE_FLAG]: true, 'grafana.navigationAdminSubNav': true });
        const { user } = renderMegaMenu();

        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        await user.click(await screen.findByRole('button', { name: 'Hide Administration' }));
        await user.click(await screen.findByRole('button', { name: 'Done' }));

        expect(getStoredHiddenItems()).toEqual(['cfg']);
        expect(screen.queryByRole('link', { name: 'Administration' })).not.toBeInTheDocument();
      });

      it('shows a pinned child as a breadcrumb in the grey box, and keeps it in the nav', async () => {
        const { user } = renderMegaMenu({ bookmarkUrls: ['/playlists'] });

        await screen.findByRole('list', { name: 'Pinned items' });
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
        expect(screen.queryByRole('list', { name: 'Pinned items' })).not.toBeInTheDocument();
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
          within(await screen.findByRole('list', { name: 'Pinned items' })).getByRole('link', { name: /Playlists/ })
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
        const pinned = within(await screen.findByRole('list', { name: 'Pinned items' }));
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
        const pinned = within(await screen.findByRole('list', { name: 'Pinned items' }));
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
        await waitFor(() => expect(screen.queryByRole('list', { name: 'Pinned items' })).not.toBeInTheDocument());
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

        await screen.findByRole('list', { name: 'Pinned items' });
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
        expect(screen.getByRole('list', { name: 'Pinned items' })).toBeInTheDocument();

        await user.click(
          await screen.findByRole('button', { name: 'Reset navigation - show all items, unpin all and reset order' })
        );
        // Staged, not saved — the box clears in the preview but the stored pins are untouched
        expect(mockUserPreferences.navbar?.bookmarkUrls).toEqual(['/playlists']);
        expect(screen.queryByRole('list', { name: 'Pinned items' })).not.toBeInTheDocument();

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

  describe('empty Starred and Bookmarks sections', () => {
    beforeEach(() => {
      setTestFlags({ 'grafana.navigationInfoArchRefresh': true });
      contextSrv.isSignedIn = true;
      contextSrv.user.isSignedIn = true;
    });

    afterEach(() => {
      contextSrv.isSignedIn = false;
      contextSrv.user.isSignedIn = false;
    });

    it('keeps both empty sections when the refresh flag is off', async () => {
      setTestFlags({ 'grafana.navigationInfoArchRefresh': false });
      setMockStarredDashboards([]);
      renderMegaMenu();

      expect(await screen.findByRole('link', { name: 'Bookmarks' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Starred' })).toBeInTheDocument();
    });

    it('hides both sections when nothing is starred or bookmarked', async () => {
      setMockStarredDashboards([]);
      renderMegaMenu();

      expect(await screen.findByRole('link', { name: 'Explore' })).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole('link', { name: 'Starred' })).not.toBeInTheDocument());
      expect(screen.queryByRole('link', { name: 'Bookmarks' })).not.toBeInTheDocument();
    });

    it('shows Starred when something is starred', async () => {
      renderMegaMenu();

      expect(await screen.findByRole('button', { name: 'Expand section: Starred' })).toBeInTheDocument();
    });

    it('keeps Starred visible with its error state when the starred fetch fails', async () => {
      jest.mocked(getGrafanaSearcher).mockReturnValue({
        search: jest.fn(() => Promise.reject(new Error('boom'))),
      } as unknown as ReturnType<typeof getGrafanaSearcher>);
      const { user } = renderMegaMenu({
        navBarTree: customisableNavTree.map((item) => (item.id === 'starred' ? { ...item, children: [] } : item)),
      });

      await user.click(await screen.findByRole('button', { name: 'Expand section: Starred' }));
      expect(await screen.findByText('Failed to load items')).toBeInTheDocument();
    });

    it('shows Bookmarks when a bookmark matches a nav item', async () => {
      renderMegaMenu({ bookmarkUrls: ['/explore'] });

      expect(await screen.findByRole('button', { name: 'Expand section: Bookmarks' })).toBeInTheDocument();
    });

    it('hides Bookmarks when the only bookmarks match no nav item', async () => {
      renderMegaMenu({ bookmarkUrls: ['/orphaned-not-in-nav'] });

      expect(await screen.findByRole('link', { name: 'Explore' })).toBeInTheDocument();
      await waitFor(() => expect(screen.queryByRole('link', { name: 'Bookmarks' })).not.toBeInTheDocument());
    });
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
