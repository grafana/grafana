import userEvent from '@testing-library/user-event';
import { KBarProvider } from 'kbar';
import { type ReactNode } from 'react';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';
import { render, screen, waitFor, act, getWrapper } from 'test/test-utils';

import { config, setBackendSrv, useScopes } from '@grafana/runtime';
import { getCustomSearchHandler } from '@grafana/test-utils/handlers';
import server, { setupMockServer } from '@grafana/test-utils/server';
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
    expect(await screen.findByRole('button', { name: 'Main menu' })).toHaveFocus();
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

    it('renders the sidebar docked, not floating, on larger screens', async () => {
      mockUseMediaQueryMinWidth.mockReturnValue(true);
      setup(<Page navId="child1">Children</Page>);

      await screen.findByTestId('ext-sidebar-stub');
      expect(screen.queryByTestId(EXTENSION_SIDEBAR_FLOATING_TESTID)).not.toBeInTheDocument();
    });
  });
});
