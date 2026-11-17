import { act, fireEvent } from '@testing-library/react';
import { useAsync } from 'react-use';
import { getWrapper, render, screen, waitFor, within } from 'test/test-utils';

import { EventBusSrv, store } from '@grafana/data';
import { setAppEvents, usePluginLinks } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { PortalContainer } from '@grafana/ui';
import { AppChromeService } from 'app/core/components/AppChrome/AppChromeService';
import { ExtensionSidebarContextProvider } from 'app/core/components/AppChrome/ExtensionSidebar/ExtensionSidebarProvider';
import {
  getRequestedExtensionSidebarDockSide,
  getRequestedExtensionSidebarPresentation,
  holdFloatingExtensionSidebar,
  isFloatingExtensionSidebarHeld,
  resetExtensionSidebarPresentationForTests,
} from 'app/core/components/AppChrome/ExtensionSidebar/extensionSidebarLayout';

import { AssistantToolbarButtons } from './AssistantToolbarButtons';

const FULLSCREEN_WORKSPACE_FLAG = 'assistant.fullscreenWorkspace';
const FLOATING_FLAG = 'grafana.extensionSidebarFloating';
const ASSISTANT_PLUGIN_ID = 'grafana-assistant-app';

jest.mock('@grafana/data', () => ({
  ...jest.requireActual('@grafana/data'),
  store: {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    getObject: jest.fn().mockImplementation((_key: string, defaultValue: unknown) => defaultValue),
    setObject: jest.fn(),
  },
}));

jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    // Read through, so the location service the test wrapper installs is the one both sides use.
    get locationService() {
      return actual.locationService;
    },
    usePluginLinks: jest.fn(),
  };
});

jest.mock('react-use', () => ({
  ...jest.requireActual('react-use'),
  useAsync: jest.fn(),
}));

const mockComponent = { title: 'Grafana Assistant', description: '', targets: [] };
const mockPluginMeta = { pluginId: ASSISTANT_PLUGIN_ID, addedComponents: [mockComponent] };

const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    value: jest.fn().mockImplementation(() => ({
      matches,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
    writable: true,
  });
};

/** A window `width` wide, for `useMediaQueryMinWidth`'s `(min-width: <n>px)` queries. */
const mockWindowWidth = (width: number) => {
  Object.defineProperty(window, 'matchMedia', {
    value: jest.fn().mockImplementation((query: string) => ({
      matches: width >= Number(/min-width:\s*(\d+)px/.exec(query)?.[1] ?? 0),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    })),
    writable: true,
  });
};

async function setFlags(flags: Record<string, boolean>) {
  // setTestFlags fires OpenFeature events that update React state; wrap in act() since the
  // component may still be mounted when this runs (RTL cleanup is a separate afterEach).
  await act(async () => {
    setTestFlags(flags);
  });
}

/** The Chat button renders in the top bar's Assistant buttons, which decide when it shows. */
function renderButtons(initialUrl = '/explore') {
  const chrome = new AppChromeService();
  const wrapper = getWrapper({
    grafanaContext: { chrome },
    renderWithRouter: true,
    historyOptions: { initialEntries: [initialUrl] },
  });
  return {
    chrome,
    ...render(
      <ExtensionSidebarContextProvider>
        {/* Where Grafana renders its overlays, as the app does. */}
        <PortalContainer />
        <AssistantToolbarButtons />
      </ExtensionSidebarContextProvider>,
      { wrapper }
    ),
  };
}

type User = ReturnType<typeof renderButtons>['user'];

/** Where the Assistant is asked to show: its presentation and the side it docks on. */
const placementNow = () => ({
  presentation: getRequestedExtensionSidebarPresentation(),
  side: getRequestedExtensionSidebarDockSide(),
});

const navigation = (chrome: AppChromeService) => {
  const { megaMenuDocked, megaMenuOpen } = chrome.state.getValue();
  return { docked: megaMenuDocked, open: megaMenuOpen };
};

async function openMenuWithKeyboard(user: User, button: HTMLElement) {
  button.focus();
  await user.keyboard('{ArrowDown}');
  return screen.findByRole('menu', { name: 'Grafana Assistant layout' });
}

/** A group's items in order. */
const items = (menu: HTMLElement, group: 'Move Assistant' | 'Arrange window') =>
  within(within(menu).getByRole('group', { name: group })).queryAllByRole('menuitemradio');

/** A group's items, by name (a tile's is its label), and which of them is checked. */
const itemNames = (menu: HTMLElement, group: 'Move Assistant' | 'Arrange window') =>
  items(menu, group).map(
    (item) =>
      `${item.getAttribute('aria-label') ?? item.textContent}${item.getAttribute('aria-checked') === 'true' ? ' (checked)' : ''}`
  );

const presets = (menu: HTMLElement) => itemNames(menu, 'Arrange window');

const openButton = () => screen.getByRole('button', { name: 'Open Grafana Assistant' });
const closeButton = () => screen.getByRole('button', { name: 'Close Grafana Assistant' });

/** Moves focus down the keyboard-opened `menu` to `item`. */
async function focusDownTo(user: User, menu: HTMLElement, item: HTMLElement) {
  await waitFor(() =>
    expect(menu).toContainElement(document.activeElement instanceof HTMLElement ? document.activeElement : null)
  );
  for (let step = 0; step < 10 && document.activeElement !== item; step++) {
    await user.keyboard('{ArrowDown}');
  }
  expect(item).toHaveFocus();
}

/**
 * Opens the menu from `button` with Down arrow and picks `name` with Enter. jsdom has no layout, so the pointer
 * cannot travel from the button into the hover-opened menu; the browser covers that path.
 */
async function chooseFromMenu(user: User, button: HTMLElement, name: string) {
  const menu = await openMenuWithKeyboard(user, button);
  await focusDownTo(user, menu, within(menu).getByRole('menuitemradio', { name }));
  await user.keyboard('{Enter}');
}

describe('AssistantChatButton', () => {
  const useAsyncMock = jest.mocked(useAsync);

  beforeEach(async () => {
    jest.clearAllMocks();
    // Nothing stored, unless a test stores a choice; clearing mocks keeps a stubbed implementation.
    jest.mocked(store.get).mockReturnValue(undefined);
    window.sessionStorage.clear();
    resetExtensionSidebarPresentationForTests();
    mockMatchMedia(true); // large screen by default
    useAsyncMock.mockReturnValue({ loading: false, value: new Map([[mockPluginMeta.pluginId, mockPluginMeta]]) });
    (usePluginLinks as jest.Mock).mockReturnValue({
      links: [{ pluginId: mockPluginMeta.pluginId, title: mockComponent.title }],
      isLoading: false,
    });
    setAppEvents(new EventBusSrv());
    await setFlags({ [FULLSCREEN_WORKSPACE_FLAG]: true, [FLOATING_FLAG]: true });
  });

  afterEach(async () => {
    await setFlags({});
  });

  it('opens the layout menu from the Chat button, beside the Workspace button', async () => {
    const { user } = renderButtons();

    expect(openButton()).toHaveTextContent('Chat');
    expect(screen.getByRole('button', { name: 'Workspace' })).toBeInTheDocument();

    const menu = await openMenuWithKeyboard(user, openButton());

    expect(itemNames(menu, 'Move Assistant')).toEqual(['Left', 'Right', 'Bottom', 'Floating (checked)']);
  });

  it('says whether the menu shows with aria-expanded, and whether the Assistant does with aria-pressed', async () => {
    const { user } = renderButtons();
    expect(openButton()).toHaveAttribute('aria-haspopup', 'menu');
    expect(openButton()).toHaveAttribute('aria-expanded', 'false');
    expect(openButton()).toHaveAttribute('aria-pressed', 'false');

    await openMenuWithKeyboard(user, openButton());
    expect(openButton()).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');

    await user.click(openButton());
    expect(closeButton()).toHaveAttribute('aria-pressed', 'true');
    expect(closeButton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows the floating Assistant a page holds hidden, which it reads as hidden', async () => {
    const { user } = renderButtons();
    await chooseFromMenu(user, openButton(), 'Floating');
    expect(closeButton()).toBeInTheDocument();

    // A page with its own Assistant prompt, such as an empty dashboard, holds it hidden.
    act(() => {
      holdFloatingExtensionSidebar();
    });
    expect(openButton()).toHaveAttribute('data-testid', 'extension-toolbar-button-open');

    await user.click(openButton());

    expect(isFloatingExtensionSidebarHeld()).toBe(false);
    expect(closeButton()).toBeInTheDocument();
  });

  it('closes the menu when clicked, so it does not cover the Assistant, until the pointer comes back', async () => {
    const { user } = renderButtons();
    await user.hover(openButton());
    await screen.findByRole('menu', { name: 'Grafana Assistant layout' });

    await user.click(openButton());

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await user.unhover(closeButton());
    await user.hover(closeButton());
    expect(await screen.findByRole('menu', { name: 'Grafana Assistant layout' })).toBeInTheDocument();
  });

  it('draws the placements in one frame: Bottom is Right turned, Floating a panel inside it', async () => {
    const { user } = renderButtons();
    const menu = await openMenuWithKeyboard(user, openButton());
    const icon = (name: string) => within(menu).getByRole('menuitemradio', { name }).querySelector('svg');

    expect(icon('Left')).toHaveAttribute('data-testid', 'icon-web-section-alt');
    expect(icon('Right')).toHaveAttribute('data-testid', 'icon-web-section');
    expect(icon('Bottom')).toHaveAttribute('data-testid', 'icon-web-section');
    expect(getComputedStyle(icon('Bottom')!).transform).toBe('rotate(90deg)');
    expect(getComputedStyle(icon('Right')!).transform).toBe('');
    expect(icon('Floating')).toHaveAttribute('data-testid', 'icon-gf-floating-panel');
  });

  it('checks the placement the user stored over the floating default', async () => {
    const stored: Record<string, string> = {
      'grafana.navigation.extensionSidebarPresentation': 'docked',
      'grafana.navigation.extensionSidebarDockSide': 'left',
    };
    jest.mocked(store.get).mockImplementation((key: string) => stored[key]);
    const { user } = renderButtons();

    const menu = await openMenuWithKeyboard(user, openButton());

    expect(itemNames(menu, 'Move Assistant')).toEqual(['Left (checked)', 'Right', 'Bottom', 'Floating']);
  });

  it('opens the layout menu on hover without moving focus', async () => {
    const { user } = renderButtons();

    await user.hover(openButton());

    const menu = await screen.findByRole('menu', { name: 'Grafana Assistant layout' });
    expect(menu).not.toContainElement(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  });

  it.each([
    ['Left', 'left'],
    ['Right', 'right'],
    ['Bottom', 'bottom'],
  ] as const)('docks the Assistant on the %s, showing it if hidden', async (label, side) => {
    const { user } = renderButtons();

    await chooseFromMenu(user, openButton(), label);

    expect(placementNow()).toEqual({ presentation: 'docked', side });
    expect(closeButton()).toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('floats the shown Assistant from a docked layout, checking the layout it shows in', async () => {
    const { user } = renderButtons();
    await user.click(openButton());
    await chooseFromMenu(user, closeButton(), 'Right');
    expect(getRequestedExtensionSidebarPresentation()).toBe('docked');

    const menu = await openMenuWithKeyboard(user, closeButton());
    expect(within(menu).getByRole('menuitemradio', { name: 'Right' })).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{Escape}');
    await chooseFromMenu(user, closeButton(), 'Floating');

    expect(getRequestedExtensionSidebarPresentation()).toBe('floating');
    expect(closeButton()).toBeInTheDocument();
  });

  it('opens the menu with Down arrow, focusing its first item, and Escape returns focus to the button', async () => {
    const { user } = renderButtons();
    openButton().focus();

    await user.keyboard('{ArrowDown}');

    const menu = await screen.findByRole('menu', { name: 'Grafana Assistant layout' });
    await waitFor(() => expect(within(menu).getByRole('menuitemradio', { name: 'Left' })).toHaveFocus());
    await user.keyboard('{ArrowDown}');
    expect(within(menu).getByRole('menuitemradio', { name: 'Right' })).toHaveFocus();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(openButton()).toHaveFocus();
  });

  it('moves focus into a hover-opened menu with Down arrow', async () => {
    const { user } = renderButtons();
    await user.hover(openButton());
    await screen.findByRole('menu', { name: 'Grafana Assistant layout' });
    openButton().focus();

    await user.keyboard('{ArrowDown}');

    await waitFor(() => expect(screen.getByRole('menuitemradio', { name: 'Left' })).toHaveFocus());
  });

  it('offers presets that arrange the nav, the Assistant and the page, checking the current one', async () => {
    const { user } = renderButtons();

    const menu = await openMenuWithKeyboard(user, openButton());

    // Floating until the user moves it, and hidden with the nav undocked: the page alone.
    expect(presets(menu)).toEqual([
      'Navigation and page with floating Assistant',
      'Page with floating Assistant',
      'Page only (checked)',
    ]);
  });

  it('names each preset tile in a tooltip above the menu, and Escape closes both at once', async () => {
    const { user } = renderButtons();
    const menu = await openMenuWithKeyboard(user, openButton());
    await focusDownTo(user, menu, items(menu, 'Arrange window')[0]);

    const tooltip = await screen.findByRole('tooltip');

    expect(tooltip).toHaveTextContent('Navigation and page with floating Assistant');
    // Both where Grafana renders its overlays, the tooltip after the menu, so it stacks above it.
    const overlays = document.getElementById('grafana-portal-container');
    expect(overlays).toContainElement(menu);
    expect(overlays).toContainElement(tooltip);
    expect(menu.compareDocumentPosition(tooltip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(openButton()).toHaveFocus();
  });

  it('moves along the row of presets with Left and Right arrows, and Down arrow carries on from there', async () => {
    const { user } = renderButtons();
    const menu = await openMenuWithKeyboard(user, openButton());
    const [first, second, third] = items(menu, 'Arrange window');
    await focusDownTo(user, menu, first);

    await user.keyboard('{ArrowRight}');
    expect(second).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(third).toHaveFocus();
    // The row ends there.
    await user.keyboard('{ArrowRight}');
    expect(third).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(second).toHaveFocus();
    await user.keyboard('{ArrowDown}');

    expect(third).toHaveFocus();
    expect(screen.getByRole('menu', { name: 'Grafana Assistant layout' })).toBe(menu);
  });

  it('offers no navigation preset where the nav cannot stay docked', async () => {
    mockWindowWidth(1100);
    const { user } = renderButtons();

    const menu = await openMenuWithKeyboard(user, openButton());

    expect(presets(menu)).toEqual(['Page with floating Assistant', 'Page only (checked)']);
  });

  it.each([
    ['Left', 'Navigation, Assistant and page'],
    ['Right', 'Navigation, page and Assistant'],
    ['Bottom', 'Navigation and page with Assistant below'],
    ['Floating', 'Navigation and page with floating Assistant'],
  ] as const)('docks and opens the nav and shows the Assistant where it was moved: %s', async (layout, presetName) => {
    const { user, chrome } = renderButtons();
    await chooseFromMenu(user, openButton(), layout);
    await user.click(closeButton());
    const placement = placementNow();

    await chooseFromMenu(user, openButton(), presetName);

    expect(navigation(chrome)).toEqual({ docked: true, open: true });
    expect(placementNow()).toEqual(placement);
    const menu = await openMenuWithKeyboard(user, closeButton());
    expect(presets(menu).filter((item) => item.endsWith('(checked)'))).toEqual([`${presetName} (checked)`]);
  });

  it.each([
    ['Left', 'Assistant and page'],
    ['Right', 'Page and Assistant'],
    ['Bottom', 'Page with Assistant below'],
    ['Floating', 'Page with floating Assistant'],
  ] as const)('closes the nav and shows the Assistant where it was moved: %s', async (layout, presetName) => {
    const { user, chrome } = renderButtons();
    act(() => {
      chrome.setMegaMenuDocked(true);
      chrome.setMegaMenuOpen(true);
    });
    await chooseFromMenu(user, openButton(), layout);
    await user.click(closeButton());
    const placement = placementNow();

    await chooseFromMenu(user, openButton(), presetName);

    expect(navigation(chrome)).toEqual({ docked: false, open: false });
    expect(placementNow()).toEqual(placement);
    const menu = await openMenuWithKeyboard(user, closeButton());
    expect(presets(menu).filter((item) => item.endsWith('(checked)'))).toEqual([`${presetName} (checked)`]);
  });

  it('checks no preset while the Assistant is hidden beside the docked nav', async () => {
    const { user, chrome } = renderButtons();
    act(() => {
      chrome.setMegaMenuDocked(true);
      chrome.setMegaMenuOpen(true);
    });

    const menu = await openMenuWithKeyboard(user, openButton());

    expect(presets(menu).filter((item) => item.endsWith('(checked)'))).toEqual([]);
  });

  it('hides the Assistant and the nav to fill the window with the page', async () => {
    const { user, chrome } = renderButtons();
    await user.click(openButton());
    act(() => {
      chrome.setMegaMenuDocked(true);
      chrome.setMegaMenuOpen(true);
    });

    await chooseFromMenu(user, closeButton(), 'Page only');

    expect(navigation(chrome)).toEqual({ docked: false, open: false });
    expect(openButton()).toBeInTheDocument();
  });

  describe('shortcuts', () => {
    it('moves the Assistant with ctrl+alt and the digit of its layout, showing it', async () => {
      const { user } = renderButtons();

      await user.keyboard('{Control>}{Alt>}2{/Alt}{/Control}');

      expect(placementNow()).toEqual({ presentation: 'docked', side: 'right' });
      expect(closeButton()).toBeInTheDocument();

      await user.keyboard('{Control>}{Alt>}4{/Alt}{/Control}');

      expect(getRequestedExtensionSidebarPresentation()).toBe('floating');
    });

    it('arranges the window with ctrl+alt+shift and the digit of its tile', async () => {
      const { user, chrome } = renderButtons();

      await user.keyboard('{Control>}{Alt>}{Shift>}1{/Shift}{/Alt}{/Control}');

      expect(navigation(chrome)).toEqual({ docked: true, open: true });
      expect(closeButton()).toBeInTheDocument();

      await user.keyboard('{Control>}{Alt>}{Shift>}3{/Shift}{/Alt}{/Control}');

      expect(navigation(chrome)).toEqual({ docked: false, open: false });
      expect(openButton()).toBeInTheDocument();
    });

    it('leaves a digit with no layout or tile to the page', () => {
      renderButtons();
      const press = (digit: number, shiftKey: boolean) =>
        fireEvent.keyDown(document.body, {
          code: `Digit${digit}`,
          key: `${digit}`,
          ctrlKey: true,
          altKey: true,
          shiftKey,
        });

      // `fireEvent` returns false once a listener prevents the default.
      expect(press(5, false)).toBe(true);
      expect(press(4, true)).toBe(true);
      expect(press(2, false)).toBe(false);
    });

    it('shows each shortcut beside its layout and on its tile', async () => {
      const { user } = renderButtons();

      const menu = await openMenuWithKeyboard(user, openButton());

      expect(within(menu).getByRole('menuitemradio', { name: 'Right' })).toHaveTextContent('Ctrl+Alt+2');
      expect(within(menu).getByRole('menuitemradio', { name: 'Page only' })).toHaveAttribute(
        'aria-keyshortcuts',
        'Control+Alt+Shift+3'
      );
    });

    it('leaves ctrl+alt with a digit to a text field, where it types a character on some keyboards', async () => {
      const { user } = renderButtons();
      const field = document.createElement('textarea');
      document.body.appendChild(field);
      field.focus();

      await user.keyboard('{Control>}{Alt>}2{/Alt}{/Control}');

      expect(placementNow().presentation).not.toBe('docked');
      expect(openButton()).toBeInTheDocument();
      field.remove();
    });

    it('are off on the Assistant Workspace page, where Exit Workspace replaces the Chat button', async () => {
      const { user } = renderButtons(`/a/${ASSISTANT_PLUGIN_ID}/workspace`);
      expect(screen.getByRole('button', { name: 'Exit Workspace' })).toBeInTheDocument();

      await user.keyboard('{Control>}{Alt>}2{/Alt}{/Control}');

      expect(placementNow()).toEqual({ presentation: 'floating', side: 'right' });
    });
  });

  it('offers no layout menu while the sidebar cannot float, and keeps the Chat tooltip instead', async () => {
    await setFlags({ [FULLSCREEN_WORKSPACE_FLAG]: true });
    const { user } = renderButtons();

    await user.hover(openButton());

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Open Chat');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(openButton()).not.toHaveAttribute('aria-haspopup');
  });
});
