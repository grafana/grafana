import userEvent from '@testing-library/user-event';
import { KBarProvider } from 'kbar';
import { type ReactNode } from 'react';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';
import { render, screen, waitFor, act, getWrapper } from 'test/test-utils';

import { selectors } from '@grafana/e2e-selectors';
import { config, setBackendSrv, useScopes } from '@grafana/runtime';
import { getCustomSearchHandler } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';
import { HOME_NAV_ID } from 'app/core/reducers/navModel';
import { useScopesServices } from 'app/features/scopes/ScopesContextProvider';
import { KioskMode } from 'app/types/dashboard';

import { backendSrv } from '../../services/backend_srv';
import { Page } from '../Page/Page';

import { AppChrome, EXTENSION_SIDEBAR_FLOATING_TESTID } from './AppChrome';
import {
  type ExtensionSidebarContextType,
  useExtensionSidebarContext,
} from './ExtensionSidebar/ExtensionSidebarProvider';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginLinks: jest.fn().mockReturnValue({ links: [] }),
  useScopes: jest.fn(),
}));

jest.mock('app/features/scopes/ScopesContextProvider', () => ({
  ...jest.requireActual('app/features/scopes/ScopesContextProvider'),
  useScopesServices: jest.fn(),
}));

jest.mock('app/core/hooks/useMediaQueryMinWidth');

jest.mock('./ExtensionSidebar/ExtensionSidebar', () => ({
  ...jest.requireActual('./ExtensionSidebar/ExtensionSidebar'),
  ExtensionSidebar: () => <div data-testid="ext-sidebar-stub" />,
}));

jest.mock('./ExtensionSidebar/ExtensionSidebarProvider', () => ({
  ...jest.requireActual('./ExtensionSidebar/ExtensionSidebarProvider'),
  useExtensionSidebarContext: jest.fn(),
}));

const mockUseMediaQueryMinWidth = jest.mocked(useMediaQueryMinWidth);
const mockUseExtensionSidebarContext = jest.mocked(useExtensionSidebarContext);
const mockUseScopes = jest.mocked(useScopes);
const mockUseScopesServices = jest.mocked(useScopesServices);

interface MockDashboardsServiceStateOverrides {
  loading?: boolean;
  forScopeNames?: string[];
  dashboards?: unknown[];
  scopeNavigations?: Array<{ title: string; url: string }>;
}

const makeScopesServicesWithContent = (
  overrides: MockDashboardsServiceStateOverrides = {}
): ReturnType<typeof useScopesServices> =>
  ({
    scopesService: {},
    scopesSelectorService: {},
    scopesDashboardsService: {
      stateObservable: { subscribe: () => ({ unsubscribe: () => {} }) },
      state: {
        loading: false,
        forScopeNames: ['scope-a'],
        dashboards: [],
        scopeNavigations: [{ title: 'Suggested dashboard', url: '/d/abc' }],
        searchQuery: '',
        filteredFolders: {},
        ...overrides,
      },
      changeSearchQuery: jest.fn(),
      updateFolder: jest.fn(),
      clearSearchQuery: jest.fn(),
    },
  }) as unknown as ReturnType<typeof useScopesServices>;

const closedSidebarContext: ExtensionSidebarContextType = {
  isOpen: false,
  dockedComponentId: undefined,
  setDockedComponentId: jest.fn(),
  availableComponents: new Map(),
  extensionSidebarWidth: 300,
  setExtensionSidebarWidth: jest.fn(),
};

const openSidebarContext: ExtensionSidebarContextType = {
  ...closedSidebarContext,
  isOpen: true,
  dockedComponentId: 'p/c/v',
};

setBackendSrv(backendSrv);
setupMockServer();

const setup = (children: ReactNode) => {
  config.bootData.navTree = [
    {
      id: HOME_NAV_ID,
      text: 'Home',
      url: '/',
    },
    {
      text: 'Section name',
      id: 'section',
      url: 'section',
      children: [
        { text: 'Child1', id: 'child1', url: 'section/child1' },
        { text: 'Child2', id: 'child2', url: 'section/child2' },
      ],
    },
    {
      text: 'Help',
      id: 'help',
    },
  ];

  const context = getGrafanaContextMock();
  const wrapper = getWrapper({ grafanaContext: context, renderWithRouter: true });

  const renderResult = render(
    <KBarProvider>
      <AppChrome>
        <div data-testid="page-children">{children}</div>
      </AppChrome>
    </KBarProvider>,
    { wrapper }
  );

  return { renderResult, context };
};

describe('AppChrome', () => {
  beforeEach(() => {
    server.use(getCustomSearchHandler([]));
    mockUseMediaQueryMinWidth.mockReturnValue(false);
    mockUseExtensionSidebarContext.mockReturnValue(closedSidebarContext);
    mockUseScopes.mockReturnValue(undefined);
  });

  afterEach(async () => {
    // Wrap in act() because setTestFlags fires OpenFeature events that trigger React state updates
    // while the component may still be mounted (RTL's own cleanup afterEach runs after this one).
    await act(async () => {
      setTestFlags({});
    });
    jest.clearAllMocks();
  });

  it('should create a skip link to skip to main content', async () => {
    setup(<Page navId="child1">Children</Page>);
    expect(await screen.findByRole('link', { name: 'Skip to main content' })).toBeInTheDocument();
  });

  it('should focus the skip link on initial tab before carrying on with normal tab order', async () => {
    setup(<Page navId="child1">Children</Page>);
    await userEvent.keyboard('{tab}');
    const skipLink = await screen.findByRole('link', { name: 'Skip to main content' });
    expect(skipLink).toHaveFocus();
    await userEvent.keyboard('{tab}');
    expect(await screen.findByTestId(selectors.components.Breadcrumbs.breadcrumb('Home'))).toHaveFocus();
  });

  it('should move focus to main content on every skip link activation', async () => {
    setup(<Page navId="child1">Children</Page>);
    const skipLink = await screen.findByRole('link', { name: 'Skip to main content' });
    const mainContent = document.getElementById('pageContent')!;

    await userEvent.click(skipLink);
    expect(mainContent).toHaveFocus();

    // Tab away, then activate the skip link a second time
    await userEvent.tab();
    expect(mainContent).not.toHaveFocus();

    await userEvent.click(skipLink);
    expect(mainContent).toHaveFocus();
  });

  it('should not render a skip link if the page is chromeless', async () => {
    const { context } = setup(<Page navId="child1">Children</Page>);
    act(() => {
      context.chrome.update({
        chromeless: true,
      });
    });
    waitFor(() => {
      expect(screen.queryByRole('link', { name: 'Skip to main content' })).not.toBeInTheDocument();
    });
  });

  describe('scopes dashboard drawer padding', () => {
    beforeEach(() => {
      mockUseScopes.mockReturnValue({
        state: { enabled: true, drawerOpened: true },
      } as ReturnType<typeof useScopes>);
    });

    it('should apply left padding when scopes drawer is open', async () => {
      setup(<Page navId="child1">Children</Page>);

      const mainContent = document.getElementById('pageContent')!;
      await waitFor(() => {
        expect(parseFloat(getComputedStyle(mainContent).paddingLeft)).toBeGreaterThan(0);
      });
    });

    it('should not apply left padding in kiosk mode when scopes drawer is open', async () => {
      const { context } = setup(<Page navId="child1">Children</Page>);

      const mainContent = document.getElementById('pageContent')!;
      await waitFor(() => {
        expect(parseFloat(getComputedStyle(mainContent).paddingLeft)).toBeGreaterThan(0);
      });

      act(() => {
        context.chrome.update({ kioskMode: KioskMode.Full });
      });

      await waitFor(() => {
        expect(parseFloat(getComputedStyle(mainContent).paddingLeft) || 0).toBe(0);
      });
    });

    it('does not render the docked drawer when the mega-menu flag is on', async () => {
      await act(async () => {
        setTestFlags({ 'grafana.scopesDashboardsMegaMenu': true });
      });

      setup(<Page navId="child1">Children</Page>);

      await waitFor(() => {
        expect(screen.queryByTestId('scopes-dashboards-container')).not.toBeInTheDocument();
      });
    });
  });

  describe('scopes dashboards mega menu section', () => {
    beforeEach(async () => {
      mockUseScopes.mockReturnValue({ state: { enabled: true } } as ReturnType<typeof useScopes>);
      await act(async () => {
        setTestFlags({ 'grafana.scopesDashboardsMegaMenu': true });
      });
    });

    it('hides the section in kiosk mode', async () => {
      mockUseMediaQueryMinWidth.mockReturnValue(true); // forces the mega menu docked + open
      mockUseScopesServices.mockReturnValue(makeScopesServicesWithContent());
      const { context } = setup(<Page navId="child1">Children</Page>);

      await screen.findByTestId('scopes-dashboards-container');

      act(() => {
        context.chrome.update({ kioskMode: KioskMode.Full });
      });

      await waitFor(() => {
        expect(screen.queryByTestId('scopes-dashboards-container')).not.toBeInTheDocument();
      });
    });

    it('opens a closed mega menu when scoped content appears', async () => {
      mockUseScopesServices.mockReturnValue(
        makeScopesServicesWithContent({ forScopeNames: [], dashboards: [], scopeNavigations: [] })
      );
      const { context } = setup(<Page navId="child1">Children</Page>);

      expect(context.chrome.state.getValue().megaMenuOpen).toBe(false);

      mockUseScopesServices.mockReturnValue(makeScopesServicesWithContent());
      act(() => {
        // Harmless unrelated update - forces a re-render so AppChrome re-reads the new mock above.
        context.chrome.update({ actions: [] });
      });

      await waitFor(() => {
        expect(context.chrome.state.getValue().megaMenuOpen).toBe(true);
      });
    });

    it('does not open while the new scope is still loading, even with stale leftover content from the previous scope', async () => {
      // fetchDashboards() advances forScopeNames + loading:true synchronously but leaves the
      // *previous* scope's dashboards/scopeNavigations in place until the fetch resolves - that
      // stale data must not be misread as "the new scope has content".
      mockUseScopesServices.mockReturnValue(
        makeScopesServicesWithContent({ forScopeNames: [], dashboards: [], scopeNavigations: [] })
      );
      const { context } = setup(<Page navId="child1">Children</Page>);

      expect(context.chrome.state.getValue().megaMenuOpen).toBe(false);

      // New scope's forScopeNames has advanced and it's loading, but scopeNavigations is still
      // the old scope's stale data.
      mockUseScopesServices.mockReturnValue(
        makeScopesServicesWithContent({ loading: true, forScopeNames: ['scope-b'] })
      );
      act(() => {
        context.chrome.update({ actions: [] });
      });

      expect(context.chrome.state.getValue().megaMenuOpen).toBe(false);

      // Fetch resolves with genuinely empty content for the new scope.
      mockUseScopesServices.mockReturnValue(
        makeScopesServicesWithContent({
          loading: false,
          forScopeNames: ['scope-b'],
          dashboards: [],
          scopeNavigations: [],
        })
      );
      act(() => {
        context.chrome.update({ actions: [] });
      });

      expect(context.chrome.state.getValue().megaMenuOpen).toBe(false);
    });

    it('does not re-open the mega menu on unrelated re-renders once content has already been seen', async () => {
      // DashboardSceneRenderer's edit-mode effect flips drawerOpened via toggleDrawer() on
      // entering/exiting edit mode - that re-render must never be mistaken for new scoped content
      // arriving and re-open a menu the user just closed.
      mockUseScopesServices.mockReturnValue(makeScopesServicesWithContent());
      const { context } = setup(<Page navId="child1">Children</Page>);

      await waitFor(() => {
        expect(context.chrome.state.getValue().megaMenuOpen).toBe(true);
      });

      act(() => {
        context.chrome.setMegaMenuOpen(false, false);
      });
      expect(context.chrome.state.getValue().megaMenuOpen).toBe(false);

      act(() => {
        context.chrome.update({ actions: [] });
      });

      expect(context.chrome.state.getValue().megaMenuOpen).toBe(false);
    });

    it('does not open the mega menu when the flag is off, even with content', async () => {
      await act(async () => {
        setTestFlags({ 'grafana.scopesDashboardsMegaMenu': false });
      });
      mockUseScopesServices.mockReturnValue(
        makeScopesServicesWithContent({ forScopeNames: [], dashboards: [], scopeNavigations: [] })
      );
      const { context } = setup(<Page navId="child1">Children</Page>);

      mockUseScopesServices.mockReturnValue(makeScopesServicesWithContent());
      act(() => {
        context.chrome.update({ actions: [] });
      });

      expect(context.chrome.state.getValue().megaMenuOpen).toBe(false);
    });
  });

  describe('extension sidebar mobile floating', () => {
    beforeEach(() => {
      mockUseExtensionSidebarContext.mockReturnValue(openSidebarContext);
    });

    it('renders the sidebar as a full-width floating overlay on small screens', async () => {
      mockUseMediaQueryMinWidth.mockReturnValue(false);
      setup(<Page navId="child1">Children</Page>);

      await screen.findByTestId('ext-sidebar-stub');
      expect(screen.getByTestId(EXTENSION_SIDEBAR_FLOATING_TESTID)).toBeInTheDocument();
    });

    it('renders the sidebar docked, not floating, on larger screens', async () => {
      mockUseMediaQueryMinWidth.mockReturnValue(true);
      setup(<Page navId="child1">Children</Page>);

      await screen.findByTestId('ext-sidebar-stub');
      expect(screen.queryByTestId(EXTENSION_SIDEBAR_FLOATING_TESTID)).not.toBeInTheDocument();
    });
  });
});
