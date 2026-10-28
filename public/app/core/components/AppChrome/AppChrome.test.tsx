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
import { DRAWER_INSIDE_ATTRIBUTE } from '@grafana/ui/internal';
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

const mockSidebarLifecycle = { mounts: 0, unmounts: 0 };

jest.mock('./ExtensionSidebar/ExtensionSidebar', () => ({
  ...jest.requireActual('./ExtensionSidebar/ExtensionSidebar'),
  ExtensionSidebar: function ExtensionSidebarStub() {
    const { useEffect } = jest.requireActual('react');
    useEffect(() => {
      mockSidebarLifecycle.mounts++;
      return () => {
        mockSidebarLifecycle.unmounts++;
      };
    }, []);
    return <div data-testid="ext-sidebar-stub" />;
  },
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
  floatingExtensionSidebarWidth: 480,
  setFloatingExtensionSidebarWidth: jest.fn(),
  presentation: 'docked',
  floatingHidden: false,
};

const openSidebarContext: ExtensionSidebarContextType = {
  ...closedSidebarContext,
  isOpen: true,
  dockedComponentId: 'p/c/v',
};

/** The declarations of the class rules on `element` (jsdom does not resolve `var()` in computed styles). */
const stylesFor = (element: Element) => {
  const selectors = new Set(Array.from(element.classList, (className) => `.${className}`));
  return Array.from(document.styleSheets)
    .flatMap((sheet) => Array.from(sheet.cssRules))
    .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule && selectors.has(rule.selectorText))
    .map((rule) => rule.style.cssText)
    .join('\n');
};

setBackendSrv(backendSrv);
setupMockServer();

const setup = (children: ReactNode, { path }: { path?: string } = {}) => {
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
  const wrapper = getWrapper({
    grafanaContext: context,
    renderWithRouter: true,
    historyOptions: path ? { initialEntries: [path] } : undefined,
  });

  const tree = (
    <KBarProvider>
      <AppChrome>
        <div data-testid="page-children">{children}</div>
      </AppChrome>
    </KBarProvider>
  );
  const renderResult = render(tree, { wrapper });

  return { renderResult, context, rerender: () => renderResult.rerender(tree) };
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
      // Mocked with real scoped content so the drawer would render something if the flag gate in
      // AppChrome.tsx were removed - without this, useScopesServices() returns undefined and
      // ScopesDashboards bails out on its own !scopeServices check regardless of the flag, so this
      // test would pass even if that gate were deleted.
      mockUseScopesServices.mockReturnValue(makeScopesServicesWithContent({ dashboards: [], scopeNavigations: [] }));

      await act(async () => {
        setTestFlags({ 'grafana.scopesDashboardsMegaMenu': true });
      });

      setup(<Page navId="child1">Children</Page>);

      await waitFor(() => {
        expect(screen.queryByTestId('scopes-dashboards-container')).not.toBeInTheDocument();
      });
    });

    it('gates the drawer container and left padding on the scopesDashboardsMegaMenu flag when there is real scoped content', async () => {
      // dashboards/scopeNavigations are deliberately left empty: a non-empty combination would make
      // useAutoOpenMegaMenuForScopedContent open the mega menu once the flag below flips on, and the
      // mega menu renders its own ScopesDashboardsMegaMenuSection with this exact same test id, which
      // would make the "absent" assertion below meaningless. forScopeNames alone is still enough to
      // exercise the drawer/padding gate, which doesn't care about dashboard content at all.
      mockUseScopesServices.mockReturnValue(makeScopesServicesWithContent({ dashboards: [], scopeNavigations: [] }));

      setup(<Page navId="child1">Children</Page>);

      const mainContent = document.getElementById('pageContent')!;

      await screen.findByTestId('scopes-dashboards-container');
      await waitFor(() => {
        expect(parseFloat(getComputedStyle(mainContent).paddingLeft)).toBeGreaterThan(0);
      });

      await act(async () => {
        setTestFlags({ 'grafana.scopesDashboardsMegaMenu': true });
      });

      await waitFor(() => {
        expect(screen.queryByTestId('scopes-dashboards-container')).not.toBeInTheDocument();
      });
      await waitFor(() => {
        expect(parseFloat(getComputedStyle(mainContent).paddingLeft) || 0).toBe(0);
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

    it('does not re-open the mega menu when returning to the same scope after a real disable/enable cycle', async () => {
      // Regression test for returning to a still-applied scope: forScopeNames/dashboards never
      // actually change for this case (fetchDashboards only re-runs when the applied scopes
      // change), so the "seen" key never moves either. Matches the old docked drawer this
      // replaces: drawerOpened only gets recomputed when fetchDashboards actually re-runs.
      mockUseScopesServices.mockReturnValue(makeScopesServicesWithContent());
      const { context } = setup(<Page navId="child1">Children</Page>);

      await waitFor(() => {
        expect(context.chrome.state.getValue().megaMenuOpen).toBe(true);
      });

      act(() => {
        context.chrome.setMegaMenuOpen(false, false);
      });
      expect(context.chrome.state.getValue().megaMenuOpen).toBe(false);

      // Scopes become genuinely disabled (e.g. navigated to a non-scoped page) - wait past the
      // 100ms debounce so this is a real disable, not just a transient flap.
      mockUseScopes.mockReturnValue({ state: { enabled: false } } as ReturnType<typeof useScopes>);
      act(() => {
        context.chrome.update({ actions: [] });
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      // Same scope re-enables (e.g. navigated back) - must NOT force the menu open again.
      mockUseScopes.mockReturnValue({ state: { enabled: true } } as ReturnType<typeof useScopes>);
      act(() => {
        context.chrome.update({ actions: [] });
      });

      expect(context.chrome.state.getValue().megaMenuOpen).toBe(false);
    });

    it('still opens for a genuinely different scope after the previous one was closed and disabled', async () => {
      mockUseScopesServices.mockReturnValue(makeScopesServicesWithContent({ forScopeNames: ['scope-a'] }));
      const { context } = setup(<Page navId="child1">Children</Page>);

      await waitFor(() => {
        expect(context.chrome.state.getValue().megaMenuOpen).toBe(true);
      });

      act(() => {
        context.chrome.setMegaMenuOpen(false, false);
      });

      mockUseScopes.mockReturnValue({ state: { enabled: false } } as ReturnType<typeof useScopes>);
      act(() => {
        context.chrome.update({ actions: [] });
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      // A different scope's content arrives this time - this is genuinely new, so it must open.
      mockUseScopes.mockReturnValue({ state: { enabled: true } } as ReturnType<typeof useScopes>);
      mockUseScopesServices.mockReturnValue(makeScopesServicesWithContent({ forScopeNames: ['scope-b'] }));
      act(() => {
        context.chrome.update({ actions: [] });
      });

      await waitFor(() => {
        expect(context.chrome.state.getValue().megaMenuOpen).toBe(true);
      });
    });

    it('re-opens when the same scope is cleared and then re-applied', async () => {
      // Regression test: clearing the scope selection genuinely resets forScopeNames to [] (a real
      // fetchDashboards([]) call, not just a transient flap), so re-applying the *same* scope
      // afterwards must be treated as fresh content again, not blocked by the previously-seen key.
      mockUseScopesServices.mockReturnValue(makeScopesServicesWithContent({ forScopeNames: ['scope-a'] }));
      const { context } = setup(<Page navId="child1">Children</Page>);

      await waitFor(() => {
        expect(context.chrome.state.getValue().megaMenuOpen).toBe(true);
      });

      act(() => {
        context.chrome.setMegaMenuOpen(false, false);
      });
      expect(context.chrome.state.getValue().megaMenuOpen).toBe(false);

      // Scope selection cleared - fetchDashboards([]) resets forScopeNames/dashboards for real.
      mockUseScopesServices.mockReturnValue(
        makeScopesServicesWithContent({ forScopeNames: [], dashboards: [], scopeNavigations: [] })
      );
      act(() => {
        context.chrome.update({ actions: [] });
      });
      expect(context.chrome.state.getValue().megaMenuOpen).toBe(false);

      // The same scope is re-applied and genuinely re-fetched - must open again.
      mockUseScopesServices.mockReturnValue(makeScopesServicesWithContent({ forScopeNames: ['scope-a'] }));
      act(() => {
        context.chrome.update({ actions: [] });
      });

      await waitFor(() => {
        expect(context.chrome.state.getValue().megaMenuOpen).toBe(true);
      });
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

    it('never opens the mega menu in kiosk mode, even with content', async () => {
      // The effect itself checks `!chromeless` (not a conditional mount - see the next test for why).
      mockUseScopesServices.mockReturnValue(
        makeScopesServicesWithContent({ forScopeNames: [], dashboards: [], scopeNavigations: [] })
      );
      const { context } = setup(<Page navId="child1">Children</Page>);

      act(() => {
        context.chrome.update({ kioskMode: KioskMode.Full });
      });

      mockUseScopesServices.mockReturnValue(makeScopesServicesWithContent());
      act(() => {
        context.chrome.update({ actions: [] });
      });

      expect(context.chrome.state.getValue().megaMenuOpen).toBe(false);
    });

    it('leaving kiosk mode does not reopen a menu the user closed', async () => {
      // Regression test: AutoOpenMegaMenuForScopedContent used to be mounted conditionally on
      // !chromeless, so entering/leaving kiosk mode unmounted and remounted it, resetting
      // lastContentKeyRef and making already-seen content look new again on the way out.
      mockUseScopesServices.mockReturnValue(makeScopesServicesWithContent());
      const { context } = setup(<Page navId="child1">Children</Page>);

      await waitFor(() => {
        expect(context.chrome.state.getValue().megaMenuOpen).toBe(true);
      });

      act(() => {
        context.chrome.setMegaMenuOpen(false, false);
      });

      act(() => {
        context.chrome.update({ kioskMode: KioskMode.Full });
      });
      act(() => {
        context.chrome.update({ kioskMode: undefined });
      });

      expect(context.chrome.state.getValue().megaMenuOpen).toBe(false);
    });

    it('does not re-open a closed menu when the same content key is re-emitted unchanged', async () => {
      // Protects the `scopeContentKey !== lastContentKeyRef.current` comparison specifically: a
      // fresh mock return value here has the same forScopeNames/dashboards values (same computed
      // scopeContentKey string) but a different object reference, so the effect's deps genuinely
      // change and it re-runs - without the seen-key comparison, that re-run would force the menu
      // back open even though this is the exact same content already shown once.
      mockUseScopesServices.mockReturnValue(makeScopesServicesWithContent());
      const { context } = setup(<Page navId="child1">Children</Page>);

      await waitFor(() => {
        expect(context.chrome.state.getValue().megaMenuOpen).toBe(true);
      });

      act(() => {
        context.chrome.setMegaMenuOpen(false, false);
      });
      expect(context.chrome.state.getValue().megaMenuOpen).toBe(false);

      mockUseScopesServices.mockReturnValue(makeScopesServicesWithContent());
      act(() => {
        context.chrome.update({ actions: [] });
      });

      expect(context.chrome.state.getValue().megaMenuOpen).toBe(false);
    });

    it('does not open the mega menu when scopes are not enabled on the current page', async () => {
      // e.g. a page that never mounts a ScopesVariable (Explore) while content is still lingering in
      // ScopesDashboardsService from a scope applied earlier via the URL - opening here would show
      // an empty section, since ScopesDashboardsMegaMenuSection also gates on (debounced) enabled.
      mockUseScopes.mockReturnValue({ state: { enabled: false } } as ReturnType<typeof useScopes>);
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

    it('does not force-close the mega menu when the scope is cleared while it is open', async () => {
      mockUseScopesServices.mockReturnValue(makeScopesServicesWithContent());
      const { context } = setup(<Page navId="child1">Children</Page>);

      await waitFor(() => {
        expect(context.chrome.state.getValue().megaMenuOpen).toBe(true);
      });

      // Scope cleared - forScopeNames empties out, so hasScopedDashboardsContent goes false. The
      // hook only ever opens the menu, never closes it, so this must not force it shut again.
      mockUseScopesServices.mockReturnValue(
        makeScopesServicesWithContent({ forScopeNames: [], dashboards: [], scopeNavigations: [] })
      );
      act(() => {
        context.chrome.update({ actions: [] });
      });

      expect(context.chrome.state.getValue().megaMenuOpen).toBe(true);
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

    it('switches between docked and floating presentation without remounting the extension', async () => {
      mockUseMediaQueryMinWidth.mockReturnValue(true);
      mockSidebarLifecycle.mounts = 0;
      mockSidebarLifecycle.unmounts = 0;
      const { rerender } = setup(<Page navId="child1">Children</Page>);
      const stub = await screen.findByTestId('ext-sidebar-stub');
      const mainContent = document.getElementById('pageContent')!;
      const dockedClassName = mainContent.className;

      mockUseExtensionSidebarContext.mockReturnValue({ ...openSidebarContext, presentation: 'floating' });
      rerender();
      expect(screen.getByTestId('ext-sidebar-stub')).toBe(stub);
      expect(mainContent.className).not.toBe(dockedClassName);

      mockUseExtensionSidebarContext.mockReturnValue(openSidebarContext);
      rerender();
      expect(screen.getByTestId('ext-sidebar-stub')).toBe(stub);
      expect(mockSidebarLifecycle).toEqual({ mounts: 1, unmounts: 0 });
    });

    it.each(['/explore', '/'])('floats over the page on a non-dashboard route (%s)', async (path) => {
      mockUseMediaQueryMinWidth.mockReturnValue(true);
      mockUseExtensionSidebarContext.mockReturnValue({ ...openSidebarContext, presentation: 'floating' });
      setup(<Page navId="child1">Children</Page>, { path });

      await screen.findByTestId('ext-sidebar-stub');
      const mainContent = document.getElementById('pageContent')!;
      // The floating sidebar overlays the page, so the page keeps its full size.
      expect(stylesFor(mainContent)).not.toContain('padding-bottom');
      expect(screen.queryByTestId(EXTENSION_SIDEBAR_FLOATING_TESTID)).not.toBeInTheDocument();
    });

    it('floats above drawers but below modals, and leaves the docked sidebar under drawers', async () => {
      mockUseMediaQueryMinWidth.mockReturnValue(true);
      const { rerender } = setup(<Page navId="child1">Children</Page>);
      const container = (await screen.findByTestId('ext-sidebar-stub')).parentElement!;
      expect(stylesFor(container)).toContain('z-index: 1001');

      mockUseExtensionSidebarContext.mockReturnValue({ ...openSidebarContext, presentation: 'floating' });
      rerender();
      // Drawers and their mask sit at modalBackdrop (1050), modal dialogs at modal (1060).
      expect(stylesFor(container)).toContain('z-index: 1051');
    });

    it('keeps the docked minimum width off the floating sidebar', async () => {
      mockUseMediaQueryMinWidth.mockReturnValue(true);
      const { rerender } = setup(<Page navId="child1">Children</Page>);
      const container = (await screen.findByTestId('ext-sidebar-stub')).parentElement!;
      expect(container.style.minWidth).toBe('460px');

      mockUseExtensionSidebarContext.mockReturnValue({ ...openSidebarContext, presentation: 'floating' });
      rerender();
      expect(container.style.minWidth).toBe('');
    });

    it('marks only the floating sidebar as inside open drawers', async () => {
      mockUseMediaQueryMinWidth.mockReturnValue(true);
      const { rerender } = setup(<Page navId="child1">Children</Page>);
      const container = (await screen.findByTestId('ext-sidebar-stub')).parentElement!;
      expect(container).not.toHaveAttribute(DRAWER_INSIDE_ATTRIBUTE);

      mockUseExtensionSidebarContext.mockReturnValue({ ...openSidebarContext, presentation: 'floating' });
      rerender();
      expect(container).toHaveAttribute(DRAWER_INSIDE_ATTRIBUTE);
    });

    it('renders the sidebar docked, not floating, on larger screens', async () => {
      mockUseMediaQueryMinWidth.mockReturnValue(true);
      setup(<Page navId="child1">Children</Page>);

      await screen.findByTestId('ext-sidebar-stub');
      expect(screen.queryByTestId(EXTENSION_SIDEBAR_FLOATING_TESTID)).not.toBeInTheDocument();
    });
  });
});
