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
import { useScopesServices } from 'app/features/scopes/ScopesContextProvider';
import { KioskMode } from 'app/types/dashboard';

import { backendSrv } from '../../services/backend_srv';
import { Page } from '../Page/Page';

import { AppChrome, EXTENSION_SIDEBAR_FLOATING_TESTID } from './AppChrome';
import { DOCKED_LOCAL_STORAGE_KEY, MEGA_MENU_PEEK_CLOSE_DELAY, MEGA_MENU_PEEK_OPEN_DELAY } from './AppChromeService';
import {
  type ExtensionSidebarContextType,
  useExtensionSidebarContext,
} from './ExtensionSidebar/ExtensionSidebarProvider';
import { DOCK_MENU_BUTTON_ID } from './MegaMenu/MegaMenuHeader';

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
  extensionSidebarHeight: 320,
  setExtensionSidebarHeight: jest.fn(),
  floatingExtensionSidebarWidth: 480,
  setFloatingExtensionSidebarWidth: jest.fn(),
  presentation: 'docked',
  dockSide: 'right',
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

  describe('mega menu toggle', () => {
    const PEEK_AND_DOCK_FLAG = 'grafana.megaMenuPeekAndDock';
    const homeLogoTestId = selectors.components.Breadcrumbs.breadcrumb('Home');

    // jsdom has no PointerEvent. Browsers do, and with it the menu's outside-press handling also swallows the click.
    class TestPointerEvent extends MouseEvent {
      readonly pointerType: string;
      readonly pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerType = init.pointerType ?? 'mouse';
        this.pointerId = init.pointerId ?? 1;
      }
    }
    const enablePointerEvents = () => {
      if (typeof window.PointerEvent === 'undefined') {
        Object.defineProperty(window, 'PointerEvent', { value: TestPointerEvent, configurable: true, writable: true });
      }
    };

    const setupWithFakeTimers = (children: ReactNode = 'Children') => {
      jest.useFakeTimers();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      return { user, ...setup(<Page navId="child1">{children}</Page>) };
    };

    // Long enough for react-aria's focus restore, which waits a frame, and for the dialog's 500ms refocus.
    const AFTER_FOCUS_TIMERS = 1000;

    beforeEach(() => {
      window.localStorage.clear();
    });

    afterEach(() => {
      jest.useRealTimers();
      window.localStorage.clear();
      if (window.PointerEvent === TestPointerEvent) {
        Reflect.deleteProperty(window, 'PointerEvent');
      }
    });

    describe('with grafana.megaMenuPeekAndDock off', () => {
      it('sits after the home logo and opens the menu only when clicked', async () => {
        const { user } = setupWithFakeTimers();
        const toggle = await screen.findByRole('button', { name: 'Main menu' });
        expect(screen.getByTestId(homeLogoTestId).compareDocumentPosition(toggle)).toBe(
          Node.DOCUMENT_POSITION_FOLLOWING
        );

        await user.hover(toggle);
        act(() => jest.advanceTimersByTime(MEGA_MENU_PEEK_OPEN_DELAY));
        expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument();

        await user.click(toggle);
        expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeInTheDocument();
      });

      it('closes the menu on a press outside it, which the page does not get', async () => {
        enablePointerEvents();
        const onPageClick = jest.fn();
        const { user } = setupWithFakeTimers(<button onClick={onPageClick}>Page button</button>);
        await user.click(await screen.findByRole('button', { name: 'Main menu' }));
        expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Page button' }));

        expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument();
        expect(onPageClick).not.toHaveBeenCalled();
      });

      it('keeps the footer dock button and the header close button', async () => {
        mockUseMediaQueryMinWidth.mockReturnValue(true);
        setup(<Page navId="child1">Children</Page>);

        // The docked menu is shown with CSS only on wide screens, which jsdom does not apply.
        expect(await screen.findByRole('button', { name: 'Close menu', hidden: true })).toBeInTheDocument();
        // Below the xl breakpoint the dock button is display: none, which leaves it no accessible name in jsdom.
        expect(document.getElementById(DOCK_MENU_BUTTON_ID)).toHaveAttribute('aria-label', 'Undock menu');
        // The docked header names Grafana beside the logo.
        expect(screen.getByText('Grafana')).toBeInTheDocument();
      });
    });

    describe('with grafana.megaMenuPeekAndDock on', () => {
      beforeEach(async () => {
        await act(async () => {
          setTestFlags({ [PEEK_AND_DOCK_FLAG]: true });
        });
      });

      it('opens the menu over the page while the pointer rests on the toggle, without moving focus', async () => {
        const { user } = setupWithFakeTimers();
        const pageContent = document.getElementById('pageContent')!;
        act(() => pageContent.focus());

        await user.hover(await screen.findByRole('button', { name: 'Main menu' }));
        expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument();
        act(() => jest.advanceTimersByTime(MEGA_MENU_PEEK_OPEN_DELAY));

        expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Main menu' })).toHaveAttribute('aria-expanded', 'true');
        expect(pageContent).toHaveFocus();
      });

      it('closes the peeking menu once the pointer leaves the toggle and the menu, and keeps focus in place', async () => {
        const { user } = setupWithFakeTimers();
        const pageContent = document.getElementById('pageContent')!;
        act(() => pageContent.focus());
        const toggle = await screen.findByRole('button', { name: 'Main menu' });
        await user.hover(toggle);
        act(() => jest.advanceTimersByTime(MEGA_MENU_PEEK_OPEN_DELAY));
        const menu = screen.getByRole('dialog', { name: 'Navigation' });

        // Crossing from the toggle to the menu keeps it open.
        await user.unhover(toggle);
        await user.hover(menu);
        act(() => jest.advanceTimersByTime(MEGA_MENU_PEEK_CLOSE_DELAY));
        expect(menu).toBeInTheDocument();

        await user.unhover(menu);
        act(() => jest.advanceTimersByTime(MEGA_MENU_PEEK_CLOSE_DELAY));
        expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument();
        act(() => jest.advanceTimersByTime(AFTER_FOCUS_TIMERS));
        expect(pageContent).toHaveFocus();
      });

      it('lets a press outside a peeking menu through to the page, and closes the menu', async () => {
        enablePointerEvents();
        const onPageClick = jest.fn();
        const { user } = setupWithFakeTimers(<button onClick={onPageClick}>Page button</button>);
        await user.hover(await screen.findByRole('button', { name: 'Main menu' }));
        act(() => jest.advanceTimersByTime(MEGA_MENU_PEEK_OPEN_DELAY));
        expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeInTheDocument();

        // Before the pointer has been away long enough to close the menu.
        await user.click(screen.getByRole('button', { name: 'Page button' }));

        expect(onPageClick).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument();
      });

      describe('from a docked menu that is closed', () => {
        const originalInnerWidth = window.innerWidth;
        const setInnerWidth = (value: number) =>
          Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value });

        beforeEach(() => {
          mockUseMediaQueryMinWidth.mockReturnValue(true);
          // The service docks the menu again only where the window is wide enough, as it does at startup.
          setInnerWidth(1920);
        });

        afterEach(() => {
          setInnerWidth(originalInnerWidth);
        });

        const setupDockedAndClosed = async () => {
          const result = setupWithFakeTimers();
          await screen.findByRole('button', { name: 'Close menu', hidden: true });
          // As the Assistant workspace does: it closes the docked menu without storing that, to open it on exit.
          act(() => result.context.chrome.setMegaMenuOpen(false, false));
          return result;
        };

        const peek = async (user: ReturnType<typeof userEvent.setup>) => {
          const toggle = screen.getByRole('button', { name: 'Main menu' });
          await user.hover(toggle);
          act(() => jest.advanceTimersByTime(MEGA_MENU_PEEK_OPEN_DELAY));
          return { toggle, menu: screen.getByRole('dialog', { name: 'Navigation' }) };
        };

        it('docks the menu again once the peek ends', async () => {
          const { user, context } = await setupDockedAndClosed();
          const { toggle } = await peek(user);
          expect(context.chrome.state.getValue()).toMatchObject({ megaMenuDocked: false, megaMenuOpen: true });

          await user.unhover(toggle);
          act(() => jest.advanceTimersByTime(MEGA_MENU_PEEK_CLOSE_DELAY));

          expect(context.chrome.state.getValue()).toMatchObject({ megaMenuDocked: true, megaMenuOpen: false });
        });

        it('docks the menu again once the menu a press kept open closes', async () => {
          const { user, context } = await setupDockedAndClosed();
          const { menu } = await peek(user);

          await user.pointer({ keys: '[MouseLeft]', target: menu });
          await user.keyboard('{Escape}');

          expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument();
          expect(context.chrome.state.getValue()).toMatchObject({ megaMenuDocked: true, megaMenuOpen: false });
        });

        it('leaves focus where it was', async () => {
          const { user } = await setupDockedAndClosed();
          const pageContent = document.getElementById('pageContent')!;
          act(() => pageContent.focus());

          await peek(user);
          act(() => jest.advanceTimersByTime(AFTER_FOCUS_TIMERS));

          expect(pageContent).toHaveFocus();
        });
      });

      it('keeps a peeking menu open once something in it is pressed', async () => {
        const { user } = setupWithFakeTimers();
        await user.hover(await screen.findByRole('button', { name: 'Main menu' }));
        act(() => jest.advanceTimersByTime(MEGA_MENU_PEEK_OPEN_DELAY));
        const menu = screen.getByRole('dialog', { name: 'Navigation' });

        await user.pointer({ keys: '[MouseLeft>]', target: menu });
        await user.unhover(menu);
        act(() => jest.advanceTimersByTime(MEGA_MENU_PEEK_CLOSE_DELAY));

        expect(menu).toBeInTheDocument();
      });

      it('opens the menu over the page on narrower screens, and keeps a peeking menu open when clicked', async () => {
        const { user } = setupWithFakeTimers();
        const toggle = await screen.findByRole('button', { name: 'Main menu' });
        await user.hover(toggle);
        act(() => jest.advanceTimersByTime(MEGA_MENU_PEEK_OPEN_DELAY));

        await user.click(toggle);
        await user.unhover(toggle);
        act(() => jest.advanceTimersByTime(MEGA_MENU_PEEK_CLOSE_DELAY));

        expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeInTheDocument();
      });

      it('moves focus into a peeking menu a click keeps open, as a click that opens the menu does', async () => {
        const { user } = setupWithFakeTimers();
        const toggle = await screen.findByRole('button', { name: 'Main menu' });
        const focusedInMenu = () => {
          const menu = screen.getByRole('dialog', { name: 'Navigation' });
          const focused = document.activeElement;
          return focused && focused !== menu && menu.contains(focused) ? focused.outerHTML : undefined;
        };
        await user.click(toggle);
        const focusedByClickOpen = focusedInMenu();
        expect(focusedByClickOpen).toBeDefined();
        await user.keyboard('{Escape}');
        await user.unhover(toggle);
        await user.hover(toggle);
        act(() => jest.advanceTimersByTime(MEGA_MENU_PEEK_OPEN_DELAY));
        expect(toggle).toHaveFocus();

        await user.click(toggle);

        expect(focusedInMenu()).toBe(focusedByClickOpen);
      });

      it('docks the menu when the toggle is clicked on wide screens, and the same spot closes it again', async () => {
        mockUseMediaQueryMinWidth.mockReturnValue(true);
        window.localStorage.setItem(DOCKED_LOCAL_STORAGE_KEY, 'false');
        const user = userEvent.setup();
        const { context } = setup(<Page navId="child1">Children</Page>);

        await user.click(await screen.findByRole('button', { name: 'Main menu' }));

        expect(context.chrome.state.getValue()).toMatchObject({ megaMenuDocked: true, megaMenuOpen: true });
        expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument();
        // The docked menu is shown with CSS only on wide screens, which jsdom does not apply.
        const close = screen.getByRole('button', { name: 'Close menu', hidden: true });
        expect(close).toHaveFocus();
        // It sits after the logo, where the top bar toggle was.
        expect(screen.getAllByTestId(homeLogoTestId)[0].compareDocumentPosition(close)).toBe(
          Node.DOCUMENT_POSITION_FOLLOWING
        );
        // The header toggle docks and closes the menu, so the footer has no dock button.
        expect(document.getElementById(DOCK_MENU_BUTTON_ID)).not.toBeInTheDocument();
        // The logo is enough beside the toggle, so the header has no Grafana title.
        expect(screen.queryByText('Grafana')).not.toBeInTheDocument();

        await user.click(close);

        expect(context.chrome.state.getValue()).toMatchObject({ megaMenuDocked: false, megaMenuOpen: false });
        expect(screen.getByRole('button', { name: 'Main menu' })).toHaveFocus();
      });

      it('docks a peeking menu when the toggle is clicked on wide screens', async () => {
        mockUseMediaQueryMinWidth.mockReturnValue(true);
        window.localStorage.setItem(DOCKED_LOCAL_STORAGE_KEY, 'false');
        enablePointerEvents();
        const { user, context } = setupWithFakeTimers();
        const toggle = await screen.findByRole('button', { name: 'Main menu' });
        await user.hover(toggle);
        act(() => jest.advanceTimersByTime(MEGA_MENU_PEEK_OPEN_DELAY));
        expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeInTheDocument();

        await user.click(toggle);

        expect(context.chrome.state.getValue()).toMatchObject({ megaMenuDocked: true, megaMenuOpen: true });
        expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument();
        act(() => jest.advanceTimersByTime(AFTER_FOCUS_TIMERS));
        expect(screen.getByRole('button', { name: 'Close menu', hidden: true })).toHaveFocus();
      });

      it('says a click docks the menu while the pointer is on the toggle, only where it can dock', async () => {
        mockUseMediaQueryMinWidth.mockReturnValue(true);
        window.localStorage.setItem(DOCKED_LOCAL_STORAGE_KEY, 'false');
        const { user } = setupWithFakeTimers();
        const toggle = await screen.findByRole('button', { name: 'Main menu' });
        expect(screen.queryByRole('tooltip', { name: 'Click to dock' })).not.toBeInTheDocument();

        await user.hover(toggle);

        expect(screen.getByRole('tooltip', { name: 'Click to dock' })).toBeInTheDocument();

        // The tooltip follows the pointer as any other does, so it goes once the pointer moves into the menu.
        act(() => jest.advanceTimersByTime(MEGA_MENU_PEEK_OPEN_DELAY));
        await user.unhover(toggle);
        await user.hover(screen.getByRole('dialog', { name: 'Navigation' }));

        expect(screen.queryByRole('tooltip', { name: 'Click to dock' })).not.toBeInTheDocument();
      });

      it('offers no docking on narrower screens', async () => {
        const { user } = setupWithFakeTimers();
        await user.hover(await screen.findByRole('button', { name: 'Main menu' }));
        act(() => jest.advanceTimersByTime(MEGA_MENU_PEEK_OPEN_DELAY));

        expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeInTheDocument();
        expect(screen.queryByRole('tooltip', { name: 'Click to dock' })).not.toBeInTheDocument();
      });

      it('does not open the menu again under the pointer that closed it, until the pointer leaves the toggle', async () => {
        mockUseMediaQueryMinWidth.mockReturnValue(true);
        const { user } = setupWithFakeTimers();
        await user.click(await screen.findByRole('button', { name: 'Close menu', hidden: true }));

        // The top bar toggle appears where the pointer already rests.
        const toggle = screen.getByRole('button', { name: 'Main menu' });
        await user.hover(toggle);
        act(() => jest.advanceTimersByTime(MEGA_MENU_PEEK_OPEN_DELAY));
        expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument();

        await user.unhover(toggle);
        await user.hover(toggle);
        act(() => jest.advanceTimersByTime(MEGA_MENU_PEEK_OPEN_DELAY));
        expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeInTheDocument();
      });

      it('sits after the home logo, as with the toggle off', async () => {
        setup(<Page navId="child1">Children</Page>);
        const toggle = await screen.findByRole('button', { name: 'Main menu' });

        expect(screen.getByTestId(homeLogoTestId).compareDocumentPosition(toggle)).toBe(
          Node.DOCUMENT_POSITION_FOLLOWING
        );
      });
    });
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
      mockUseScopesServices.mockReturnValue(makeScopesServicesWithContent({ scopeNavigations: [] }));

      await act(async () => {
        setTestFlags({ 'grafana.scopesDashboardsMegaMenu': true });
      });

      setup(<Page navId="child1">Children</Page>);

      await waitFor(() => {
        expect(screen.queryByTestId('scopes-dashboards-container')).not.toBeInTheDocument();
      });
    });

    it('gates the drawer container and left padding on the scopesDashboardsMegaMenu flag when there is real scoped content', async () => {
      // scopeNavigations is deliberately left empty: a non-empty list would make
      // useAutoOpenMegaMenuForScopedContent open the mega menu once the flag below flips on, and the
      // mega menu renders its own ScopesDashboardsMegaMenuSection with this exact same test id, which
      // would make the "absent" assertion below meaningless. forScopeNames alone is still enough to
      // exercise the drawer/padding gate, which doesn't care about dashboard content at all.
      mockUseScopesServices.mockReturnValue(makeScopesServicesWithContent({ scopeNavigations: [] }));

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
      mockUseScopesServices.mockReturnValue(makeScopesServicesWithContent({ forScopeNames: [], scopeNavigations: [] }));
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
      // *previous* scope's scopeNavigations in place until the fetch resolves - that
      // stale data must not be misread as "the new scope has content".
      mockUseScopesServices.mockReturnValue(makeScopesServicesWithContent({ forScopeNames: [], scopeNavigations: [] }));
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
          scopeNavigations: [],
        })
      );
      act(() => {
        context.chrome.update({ actions: [] });
      });

      expect(context.chrome.state.getValue().megaMenuOpen).toBe(false);
    });

    it('does not re-open the mega menu when returning to the same scope after a real disable/enable cycle', async () => {
      // Regression test for returning to a still-applied scope: forScopeNames/scopeNavigations never
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

      // Scope selection cleared - fetchDashboards([]) resets forScopeNames/scopeNavigations for real.
      mockUseScopesServices.mockReturnValue(makeScopesServicesWithContent({ forScopeNames: [], scopeNavigations: [] }));
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
      mockUseScopesServices.mockReturnValue(makeScopesServicesWithContent({ forScopeNames: [], scopeNavigations: [] }));
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
      // fresh mock return value here has the same forScopeNames/scopeNavigations values (same computed
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
      mockUseScopesServices.mockReturnValue(makeScopesServicesWithContent({ forScopeNames: [], scopeNavigations: [] }));
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
      mockUseScopesServices.mockReturnValue(makeScopesServicesWithContent({ forScopeNames: [], scopeNavigations: [] }));
      act(() => {
        context.chrome.update({ actions: [] });
      });

      expect(context.chrome.state.getValue().megaMenuOpen).toBe(true);
    });

    it('does not open the mega menu when the flag is off, even with content', async () => {
      await act(async () => {
        setTestFlags({ 'grafana.scopesDashboardsMegaMenu': false });
      });
      mockUseScopesServices.mockReturnValue(makeScopesServicesWithContent({ forScopeNames: [], scopeNavigations: [] }));
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
      expect(container.style.minWidth).toBe('360px');

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

    describe('docked on the left', () => {
      const dockedLeftContext: ExtensionSidebarContextType = { ...openSidebarContext, dockSide: 'left' };

      it('sits between the docked nav and the page, below the header, resized from its right edge', async () => {
        mockUseMediaQueryMinWidth.mockReturnValue(true); // forces the mega menu docked + open
        mockUseExtensionSidebarContext.mockReturnValue(dockedLeftContext);
        setup(<Page navId="child1">Children</Page>);
        const container = (await screen.findByTestId('ext-sidebar-stub')).parentElement!;
        const mainContent = document.getElementById('pageContent')!;

        const sidebarStyles = stylesFor(container);
        expect(sidebarStyles).toContain('left: 320px');
        expect(sidebarStyles).toContain('right: auto');
        // Below the whole header, one 48px level on this page.
        expect(sidebarStyles).toContain('top: 48px');
        // The page starts past the nav and the sidebar, and keeps its full width.
        const pageStyles = stylesFor(mainContent);
        expect(pageStyles).toContain('padding-left: calc(320px + 300px)');
        expect(pageStyles).not.toContain('max-width');
        // Only the edge that faces the page resizes it.
        expect(container.querySelector('[style*="right: -7px"]')).toBeInTheDocument();
        expect(container.querySelector('[style*="left: -7px"]')).not.toBeInTheDocument();
        expect(container.style.minWidth).toBe('360px');
      });

      it('starts at the window edge when the nav is not docked', async () => {
        mockUseMediaQueryMinWidth.mockReturnValue(true);
        mockUseExtensionSidebarContext.mockReturnValue(dockedLeftContext);
        const { context, rerender } = setup(<Page navId="child1">Children</Page>);
        const container = (await screen.findByTestId('ext-sidebar-stub')).parentElement!;

        act(() => context.chrome.setMegaMenuOpen(false));
        rerender();

        expect(stylesFor(container)).toContain('left: 0px');
        expect(stylesFor(document.getElementById('pageContent')!)).toContain('padding-left: calc(0px + 300px)');
      });

      it('is a full-width overlay on small screens, which takes nothing from the page', async () => {
        mockUseMediaQueryMinWidth.mockReturnValue(false);
        mockUseExtensionSidebarContext.mockReturnValue(dockedLeftContext);
        setup(<Page navId="child1">Children</Page>);

        await screen.findByTestId('ext-sidebar-stub');
        expect(screen.getByTestId(EXTENSION_SIDEBAR_FLOATING_TESTID)).toBeInTheDocument();
        expect(stylesFor(document.getElementById('pageContent')!)).not.toContain('300px');
      });

      it('moves between the sides and floating without remounting the extension', async () => {
        mockUseMediaQueryMinWidth.mockReturnValue(true);
        mockSidebarLifecycle.mounts = 0;
        mockSidebarLifecycle.unmounts = 0;
        const { rerender } = setup(<Page navId="child1">Children</Page>);
        const stub = await screen.findByTestId('ext-sidebar-stub');

        for (const next of [
          { presentation: 'floating' as const },
          { dockSide: 'left' as const },
          { dockSide: 'bottom' as const },
          {},
        ]) {
          mockUseExtensionSidebarContext.mockReturnValue({ ...openSidebarContext, ...next });
          rerender();
          expect(screen.getByTestId('ext-sidebar-stub')).toBe(stub);
        }
        expect(mockSidebarLifecycle).toEqual({ mounts: 1, unmounts: 0 });
      });
    });

    describe('docked at the bottom', () => {
      const dockedBottomContext: ExtensionSidebarContextType = { ...openSidebarContext, dockSide: 'bottom' };

      it('sits below the page from the docked nav to the right edge, resized from its top edge', async () => {
        mockUseMediaQueryMinWidth.mockReturnValue(true); // forces the mega menu docked + open
        mockUseExtensionSidebarContext.mockReturnValue(dockedBottomContext);
        setup(<Page navId="child1">Children</Page>);
        const container = (await screen.findByTestId('ext-sidebar-stub')).parentElement!;

        const sidebarStyles = stylesFor(container);
        expect(sidebarStyles).toContain('left: 320px');
        expect(sidebarStyles).toContain('right: 0');
        expect(sidebarStyles).toContain('top: auto');
        expect(container.style.height).toBe('320px');
        expect(container.style.width).toBe('auto');
        // The page ends where the sidebar starts, and keeps its width.
        const pageStyles = stylesFor(document.getElementById('pageContent')!);
        expect(pageStyles).toContain('max-height: calc(100% - 320px)');
        expect(pageStyles).not.toContain('max-width');
        expect(pageStyles).not.toContain('300px');
        // Only the edge that faces the page resizes it, within bounds on its height alone.
        expect(container.querySelector('[style*="top: -7px"]')).toBeInTheDocument();
        expect(container.querySelector('[style*="left: -7px"]')).not.toBeInTheDocument();
        expect(container.style.minHeight).toBe('240px');
        expect(container.style.minWidth).toBe('');
        expect(container.style.maxWidth).toBe('');
      });

      it('starts at the window edge when the nav is not docked', async () => {
        mockUseMediaQueryMinWidth.mockReturnValue(true);
        mockUseExtensionSidebarContext.mockReturnValue(dockedBottomContext);
        const { context, rerender } = setup(<Page navId="child1">Children</Page>);
        const container = (await screen.findByTestId('ext-sidebar-stub')).parentElement!;

        act(() => context.chrome.setMegaMenuOpen(false));
        rerender();

        expect(stylesFor(container)).toContain('left: 0px');
      });

      it("scrolls the page inside its card, so the card's bottom edge stays in view above the sidebar", async () => {
        await act(async () => {
          setTestFlags({ 'grafana.visualDesignRefresh': true });
        });
        mockUseMediaQueryMinWidth.mockReturnValue(true);
        mockUseExtensionSidebarContext.mockReturnValue(dockedBottomContext);
        const { rerender } = setup(<Page navId="child1">Children</Page>);
        await screen.findByTestId('ext-sidebar-stub');
        const card = screen.getByTestId('page-children').firstElementChild!;

        expect(stylesFor(card)).toContain('overflow: auto');
        expect(stylesFor(card)).toContain('min-height: 0');

        // Docked on the right, the page area reaches the window's bottom, and the page grows as before.
        mockUseExtensionSidebarContext.mockReturnValue(openSidebarContext);
        rerender();
        expect(stylesFor(card)).not.toContain('overflow');
        expect(stylesFor(card)).not.toContain('min-height');
      });

      it('is a full-width overlay on small screens, which takes nothing from the page', async () => {
        mockUseMediaQueryMinWidth.mockReturnValue(false);
        mockUseExtensionSidebarContext.mockReturnValue(dockedBottomContext);
        setup(<Page navId="child1">Children</Page>);

        await screen.findByTestId('ext-sidebar-stub');
        expect(screen.getByTestId(EXTENSION_SIDEBAR_FLOATING_TESTID)).toBeInTheDocument();
        expect(stylesFor(document.getElementById('pageContent')!)).not.toContain('max-height');
      });

      it('keeps the Return to previous button above it', async () => {
        mockUseMediaQueryMinWidth.mockReturnValue(true);
        mockUseExtensionSidebarContext.mockReturnValue(dockedBottomContext);
        const { context, rerender } = setup(<Page navId="child1">Children</Page>);
        await screen.findByTestId('ext-sidebar-stub');
        act(() => context.chrome.setReturnToPrevious({ title: 'Dashboards', href: '/dashboards' }));
        const returnToPrevious = () => screen.getByTestId(selectors.components.ReturnToPrevious.buttonGroup);

        // 32px above the 320px tall dock.
        expect(stylesFor(returnToPrevious())).toContain('bottom: calc(32px + 320px)');

        // Docked on the right, the window's bottom edge is the page's.
        mockUseExtensionSidebarContext.mockReturnValue(openSidebarContext);
        rerender();
        expect(stylesFor(returnToPrevious())).toContain('bottom: 32px');
      });
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

    it('shows from the URL before the page has told the chrome where it is, with nothing marked current', async () => {
      setup(<div>Not yet a Page</div>, { extraNav: administrationNav, path: '/admin/users' });

      const nav = within(await sectionNav());

      expect(nav.getByRole('link', { name: 'Users' })).toBeInTheDocument();
      expect(nav.queryByRole('link', { current: 'page' })).not.toBeInTheDocument();
    });

    it('follows the URL when navigating into Administration', async () => {
      setup(<div>Not yet a Page</div>, { extraNav: administrationNav, path: '/' });
      expect(screen.queryByRole('navigation', { name: 'Administration' })).not.toBeInTheDocument();

      act(() => locationService.push('/admin/users'));

      expect(await sectionNav()).toBeInTheDocument();
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
