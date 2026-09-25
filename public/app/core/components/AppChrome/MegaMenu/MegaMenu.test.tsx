import { render, screen, userEvent, waitFor, within } from 'test/test-utils';

import { type NavModelItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { reportInteraction, setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { setMockStarredDashboards } from '@grafana/test-utils/unstable';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';

import { MegaMenu } from './MegaMenu';
import { customisableNavTree, nestedNavTree } from './__mocks__/fixtures';
import { NAV_CUSTOMIZATION_STORAGE_KEY } from './hooks';
import { type NavCustomizationState, EMPTY_NAV_CUSTOMIZATION } from './utils';

// The org switcher fetches user orgs on mount when signed in, which is irrelevant here.
jest.mock('../OrganizationSwitcher/OrganizationSwitcher', () => ({
  OrganizationSwitcher: () => null,
}));

// The searcher resolves starred UIDs to nav rows but has no MSW path, so stub it.
jest.mock('app/features/search/service/searcher');

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

Object.assign(navigator, {
  clipboard: { writeText: () => Promise.resolve() },
});

const STARRED_DASHBOARD = { uid: 'dash-e', name: 'Dashboard E', url: '/d/dash-e', kind: 'dashboard' };

const setupSearcher = () => {
  const search = jest.fn(({ name }: { name: string[] }) => {
    const rows = [STARRED_DASHBOARD].filter((d) => name.includes(d.uid));
    return Promise.resolve({ view: { length: rows.length, get: (i: number) => rows[i] } });
  });
  jest.mocked(getGrafanaSearcher).mockReturnValue({ search } as unknown as ReturnType<typeof getGrafanaSearcher>);
};

setBackendSrv(backendSrv);
setupMockServer();

const getStoredCustomization = (): NavCustomizationState =>
  JSON.parse(window.localStorage.getItem(NAV_CUSTOMIZATION_STORAGE_KEY) ?? 'null') ?? EMPTY_NAV_CUSTOMIZATION;

const renderMegaMenu = ({
  navBarTree = customisableNavTree,
  customization,
  initialEntries,
}: {
  navBarTree?: NavModelItem[];
  customization?: NavCustomizationState;
  initialEntries?: string[];
} = {}) => {
  if (customization) {
    window.localStorage.setItem(NAV_CUSTOMIZATION_STORAGE_KEY, JSON.stringify(customization));
  }
  return render(<MegaMenu onClose={() => {}} />, {
    preloadedState: { navBarTree },
    ...(initialEntries && { historyOptions: { initialEntries } }),
  });
};

describe('MegaMenu', () => {
  beforeEach(() => {
    setMockStarredDashboards([STARRED_DASHBOARD.uid]);
    setupSearcher();
  });

  afterEach(() => {
    window.localStorage.clear();
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
      contextSrv.isSignedIn = true;
    });

    afterEach(() => {
      contextSrv.isSignedIn = false;
    });

    it('does not show the customise control when signed out', async () => {
      contextSrv.isSignedIn = false;
      renderMegaMenu();

      expect(await screen.findByRole('link', { name: 'Explore' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Customise navigation' })).not.toBeInTheDocument();
    });

    describe('reordering (any depth)', () => {
      it('renders the top-level sections in the stored order', async () => {
        renderMegaMenu({ customization: { ...EMPTY_NAV_CUSTOMIZATION, order: { __root__: ['cfg', 'explore'] } } });

        await screen.findByRole('link', { name: 'Administration' });
        const nav = within(screen.getByRole('list', { name: 'Navigation' }));
        const names = nav.getAllByRole('link').map((el) => el.textContent);
        expect(names.indexOf('Administration')).toBeLessThan(names.indexOf('Explore'));
      });

      it('offers move up/down controls on each top-level section while editing, disabled at the boundaries', async () => {
        const { user } = renderMegaMenu();

        // Home is never listed in the mega menu (reached via the logo), so Explore is first.
        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        expect(screen.getByRole('button', { name: 'Move Explore up' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Move Explore down' })).toBeEnabled();
      });

      it('moves a top-level section down and persists the order on Done', async () => {
        const { user } = renderMegaMenu();

        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        await user.click(await screen.findByRole('button', { name: 'Move Explore down' }));
        await user.click(screen.getByRole('button', { name: 'Done' }));

        expect(getStoredCustomization().order.__root__).toEqual([
          'alerting',
          'explore',
          'dashboards',
          'cfg',
          'starred',
          'bookmarks',
        ]);
      });

      it('moves a nested child among its siblings', async () => {
        const { user } = renderMegaMenu();

        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        await user.click(await screen.findByRole('button', { name: 'Expand section: Dashboards' }));
        await user.click(await screen.findByRole('button', { name: 'Move Snapshots up' }));
        await user.click(screen.getByRole('button', { name: 'Done' }));

        expect(getStoredCustomization().order['dashboards']).toEqual([
          'dashboards/new',
          'dashboards/snapshots',
          'dashboards/playlists',
        ]);
      });
    });

    describe('renaming (any depth)', () => {
      it('renames a top-level section via the prompt and persists it on Done', async () => {
        jest.spyOn(window, 'prompt').mockReturnValue('My Explore');
        const { user } = renderMegaMenu();

        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        await user.click(await screen.findByRole('button', { name: 'Rename Explore' }));
        expect(await screen.findByRole('link', { name: 'My Explore' })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Done' }));
        expect(getStoredCustomization().renamed).toEqual({ explore: 'My Explore' });

        jest.restoreAllMocks();
      });

      it('renames a nested child', async () => {
        jest.spyOn(window, 'prompt').mockReturnValue('My Playlists');
        const { user } = renderMegaMenu();

        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        await user.click(await screen.findByRole('button', { name: 'Expand section: Dashboards' }));
        await user.click(await screen.findByRole('button', { name: 'Rename Playlists' }));
        expect(await screen.findByRole('link', { name: 'My Playlists' })).toBeInTheDocument();

        jest.restoreAllMocks();
      });

      it('does not rename when the prompt is dismissed', async () => {
        jest.spyOn(window, 'prompt').mockReturnValue(null);
        const { user } = renderMegaMenu();

        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        await user.click(await screen.findByRole('button', { name: 'Rename Explore' }));

        expect(screen.queryByRole('button', { name: 'Rename Explore' })).toBeInTheDocument();

        jest.restoreAllMocks();
      });
    });

    describe('hiding (any depth)', () => {
      it('hides a top-level section, but shows it (greyed) while editing', async () => {
        const { user } = renderMegaMenu({ customization: { ...EMPTY_NAV_CUSTOMIZATION, hidden: ['explore'] } });

        expect(screen.queryByRole('link', { name: 'Explore' })).not.toBeInTheDocument();
        expect(await screen.findByRole('link', { name: 'Alerting' })).toBeInTheDocument();

        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        expect(await screen.findByRole('link', { name: 'Explore' })).toBeInTheDocument();
        expect(await screen.findByRole('button', { name: 'Show Explore' })).toBeInTheDocument();
      });

      it('offers the hide toggle on sections and children, but not create actions', async () => {
        const { user } = renderMegaMenu();

        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        expect(await screen.findByRole('button', { name: 'Hide Explore' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Hide Home' })).not.toBeInTheDocument();

        await user.click(await screen.findByRole('button', { name: 'Expand section: Dashboards' }));
        expect(await screen.findByRole('button', { name: 'Hide Playlists' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Hide New dashboard' })).not.toBeInTheDocument();
      });

      it('hides a child item — greyed while editing, removed from the nav after Done', async () => {
        const { user } = renderMegaMenu();

        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        await user.click(await screen.findByRole('button', { name: 'Expand section: Dashboards' }));
        await user.click(await screen.findByRole('button', { name: 'Hide Playlists' }));

        expect(reportInteraction).toHaveBeenCalledWith(
          'grafana_nav_item_hidden',
          expect.objectContaining({ path: '/playlists' })
        );

        await user.click(await screen.findByRole('button', { name: 'Show Playlists' }));
        await user.click(await screen.findByRole('button', { name: 'Hide Playlists' }));
        expect(await screen.findByRole('button', { name: 'Show Playlists' })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Done' }));
        expect(getStoredCustomization().hidden).toEqual(['dashboards/playlists']);
        expect(screen.queryByRole('link', { name: 'Playlists' })).not.toBeInTheDocument();
        expect(await screen.findByRole('link', { name: 'Snapshots' })).toBeInTheDocument();
      });

      it('discards changes on Cancel', async () => {
        const { user } = renderMegaMenu();

        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        await user.click(await screen.findByRole('button', { name: 'Hide Explore' }));
        await user.click(await screen.findByRole('button', { name: 'Cancel' }));

        expect(await screen.findByRole('link', { name: 'Explore' })).toBeInTheDocument();
      });
    });

    describe('edit-mode controls', () => {
      it('does not show reset to default until something is customised', async () => {
        const { user } = renderMegaMenu();

        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        expect(
          screen.queryByRole('button', { name: 'Reset navigation - show all items and reset order' })
        ).not.toBeInTheDocument();
      });

      it('stages a reset and only persists it on Done', async () => {
        const { user } = renderMegaMenu({ customization: { ...EMPTY_NAV_CUSTOMIZATION, hidden: ['explore'] } });

        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        await user.click(
          await screen.findByRole('button', { name: 'Reset navigation - show all items and reset order' })
        );
        // Staged, not saved — cancelling should leave the original hidden state untouched.
        await user.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(getStoredCustomization().hidden).toEqual(['explore']);

        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        await user.click(
          await screen.findByRole('button', { name: 'Reset navigation - show all items and reset order' })
        );
        await user.click(screen.getByRole('button', { name: 'Done' }));
        expect(getStoredCustomization().hidden).toEqual([]);
      });

      it('copies a shareable link reproducing the current customisation', async () => {
        const writeText = jest.spyOn(navigator.clipboard, 'writeText');
        const { user } = renderMegaMenu({ customization: { ...EMPTY_NAV_CUSTOMIZATION, hidden: ['explore'] } });

        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        await user.click(screen.getByRole('button', { name: 'Copy a shareable link to this navigation customisation' }));

        await waitFor(() => expect(writeText).toHaveBeenCalled());
        const [url] = writeText.mock.calls[0];
        const parsed = JSON.parse(new URL(url).searchParams.get('navCustom')!);
        expect(parsed.hidden).toEqual(['explore']);

        writeText.mockRestore();
      });

      it('reports a successful save', async () => {
        const { user } = renderMegaMenu();
        await user.click(await screen.findByRole('button', { name: 'Customise navigation' }));
        await user.click(await screen.findByRole('button', { name: 'Hide Explore' }));
        await user.click(screen.getByRole('button', { name: 'Done' }));

        expect(reportInteraction).toHaveBeenCalledWith(
          'grafana_nav_customise_saved',
          expect.objectContaining({ hiddenCount: 1 })
        );
      });
    });

    describe('sharing via URL', () => {
      it('seeds the customisation from a ?navCustom= query param', async () => {
        const navCustom = JSON.stringify({ ...EMPTY_NAV_CUSTOMIZATION, hidden: ['explore'] });

        renderMegaMenu({ initialEntries: [`/?navCustom=${navCustom}`] });

        await waitFor(() => expect(getStoredCustomization().hidden).toEqual(['explore']));
        expect(screen.queryByRole('link', { name: 'Explore' })).not.toBeInTheDocument();
        expect(await screen.findByRole('link', { name: 'Alerting' })).toBeInTheDocument();
      });
    });
  });

  describe('when starredFolders is enabled', () => {
    it('renders the starred dashboard', async () => {
      renderMegaMenu();

      await userEvent.click(await screen.findByRole('button', { name: 'Expand section: Starred' }));
      expect(await screen.findByRole('link', { name: STARRED_DASHBOARD.name })).toBeInTheDocument();
    });
  });
});
