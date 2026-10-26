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
