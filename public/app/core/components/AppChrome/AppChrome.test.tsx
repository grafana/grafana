import userEvent from '@testing-library/user-event';
import { KBarProvider } from 'kbar';
import { type ReactNode } from 'react';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';
import { render, screen, waitFor, act, getWrapper, within } from 'test/test-utils';

import { type NavModelItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config, locationService, setBackendSrv, useScopes } from '@grafana/runtime';
import { getCustomSearchHandler } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { DRAWER_INSIDE_ATTRIBUTE } from '@grafana/ui/internal';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';
import { HOME_NAV_ID } from 'app/core/reducers/navModel';
import { KioskMode } from 'app/types/dashboard';

import { backendSrv } from '../../services/backend_srv';
import { Page } from '../Page/Page';

import { AppChrome, EXTENSION_SIDEBAR_FLOATING_TESTID } from './AppChrome';
import {
  type ExtensionSidebarContextType,
  useExtensionSidebarContext,
} from './ExtensionSidebar/ExtensionSidebarProvider';

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    // A getter, because the test wrapper swaps the location service and a spread would keep the first one
    get locationService() {
      return actual.locationService;
    },
    usePluginLinks: jest.fn().mockReturnValue({ links: [] }),
    useScopes: jest.fn(),
  };
});

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

const setup = (children: ReactNode, { path, extraNav = [] }: { path?: string; extraNav?: NavModelItem[] } = {}) => {
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
    ...extraNav,
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

const administrationNav: NavModelItem[] = [
  {
    id: 'cfg',
    text: 'Administration',
    url: '/admin',
    children: [
      {
        id: 'cfg/general',
        text: 'General',
        url: '/admin/general',
        children: [
          { id: 'org-settings', text: 'Default preferences', url: '/org' },
          { id: 'plugin-page-grafana-advisor-app', text: 'Advisor', url: '/a/grafana-advisor-app/home' },
        ],
      },
      { id: 'cfg/plugins', text: 'Plugins and data', url: '/admin/plugins', children: [] },
      {
        id: 'cfg/access',
        text: 'Users and access',
        url: '/admin/access',
        children: [{ id: 'global-users', text: 'Users', url: '/admin/users' }],
      },
    ],
  },
];

describe('AppChrome', () => {
  beforeEach(() => {
    server.use(getCustomSearchHandler([]));
    mockUseMediaQueryMinWidth.mockReturnValue(false);
    mockUseExtensionSidebarContext.mockReturnValue(closedSidebarContext);
    mockUseScopes.mockReturnValue(undefined);
  });

  afterEach(() => {
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
        state: { enabled: true, drawerOpened: true, readOnly: false },
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

  describe('administration section nav', () => {
    const sectionNav = () => screen.findByRole('navigation', { name: 'Administration' });

    beforeEach(() => {
      mockUseMediaQueryMinWidth.mockReturnValue(true);
      setTestFlags({ 'grafana.navigationAdminSubNav': true });
    });

    afterEach(async () => {
      await act(async () => {
        setTestFlags({});
      });
    });

    it('lists the groups as plain headings over their destinations on an administration page', async () => {
      setup(<Page navId="org-settings">Children</Page>, { extraNav: administrationNav });

      const nav = within(await sectionNav());

      expect(nav.getByRole('heading', { name: 'General' })).toBeInTheDocument();
      expect(nav.getByRole('heading', { name: 'Users and access' })).toBeInTheDocument();
      expect(nav.queryByRole('link', { name: 'General' })).not.toBeInTheDocument();
      expect(nav.getByRole('link', { name: 'Advisor' })).toHaveAttribute('href', '/a/grafana-advisor-app/home');
      expect(nav.getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/admin/users');
    });

    it('marks the current page and no other', async () => {
      setup(<Page navId="org-settings">Children</Page>, { extraNav: administrationNav });

      const nav = within(await sectionNav());

      expect(nav.getByRole('link', { name: 'Default preferences' })).toHaveAttribute('aria-current', 'page');
      expect(nav.getByRole('link', { name: 'Advisor' })).not.toHaveAttribute('aria-current');
    });

    it('leaves out a group with no destinations', async () => {
      setup(<Page navId="org-settings">Children</Page>, { extraNav: administrationNav });

      const nav = within(await sectionNav());

      expect(nav.queryByRole('heading', { name: 'Plugins and data' })).not.toBeInTheDocument();
    });

    it('shows on the Administration landing page with nothing marked current', async () => {
      setup(<Page navId="cfg">Children</Page>, { extraNav: administrationNav });

      const nav = within(await sectionNav());

      expect(nav.getByRole('link', { name: 'Users' })).toBeInTheDocument();
      expect(nav.queryByRole('link', { current: 'page' })).not.toBeInTheDocument();
    });

    it('shows from the URL before the page has told the chrome where it is', async () => {
      setup(<div>Not yet a Page</div>, { extraNav: administrationNav, path: '/admin/users' });

      const nav = within(await sectionNav());

      expect(nav.getByRole('link', { name: 'Users', current: 'page' })).toBeInTheDocument();
    });

    it('follows the URL when navigating into Administration', async () => {
      setup(<div>Not yet a Page</div>, { extraNav: administrationNav, path: '/' });
      expect(screen.queryByRole('navigation', { name: 'Administration' })).not.toBeInTheDocument();

      act(() => locationService.push('/admin/users'));

      const nav = within(await sectionNav());
      expect(nav.getByRole('link', { name: 'Users', current: 'page' })).toBeInTheDocument();
    });

    it('shows on a group landing page', async () => {
      setup(<Page navId="cfg/general">Children</Page>, { extraNav: administrationNav });

      expect(await sectionNav()).toBeInTheDocument();
    });

    it('does not show on a page outside Administration', async () => {
      setup(<Page navId="child1">Children</Page>, { extraNav: administrationNav });

      expect(await screen.findByTestId('page-children')).toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: 'Administration' })).not.toBeInTheDocument();
    });

    it('does not show when the flag is off', async () => {
      setTestFlags({ 'grafana.navigationAdminSubNav': false });
      setup(<Page navId="org-settings">Children</Page>, { extraNav: administrationNav });

      expect(await screen.findByTestId('page-children')).toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: 'Administration' })).not.toBeInTheDocument();
    });

    it('does not show below the tablet width', async () => {
      mockUseMediaQueryMinWidth.mockReturnValue(false);
      setup(<Page navId="org-settings">Children</Page>, { extraNav: administrationNav });

      expect(await screen.findByTestId('page-children')).toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: 'Administration' })).not.toBeInTheDocument();
    });
  });
});
