import { act } from '@testing-library/react';
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
  subscribeToExtensionSidebarPopOut,
  trackExtensionSidebarPopOut,
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

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginLinks: jest.fn(),
}));

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

function renderButton() {
  const chrome = new AppChromeService();
  const wrapper = getWrapper({ grafanaContext: { chrome } });
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

/** Where the Assistant is asked to show: its presentation and the side it docks on. */
const placementNow = () => ({
  presentation: getRequestedExtensionSidebarPresentation(),
  side: getRequestedExtensionSidebarDockSide(),
});

const navigation = (chrome: AppChromeService) => {
  const { megaMenuDocked, megaMenuOpen } = chrome.state.getValue();
  return { docked: megaMenuDocked, open: megaMenuOpen };
};

async function openMenuWithKeyboard(user: ReturnType<typeof renderButton>['user'], button: HTMLElement) {
  button.focus();
  await user.keyboard('{ArrowDown}');
  return screen.findByRole('menu', { name: 'Grafana Assistant layout' });
}

/** A group's items in order: its layouts to choose from, then its actions. */
const items = (menu: HTMLElement, group: 'Move Assistant' | 'Arrange window') => {
  const inGroup = within(within(menu).getByRole('group', { name: group }));
  return [...inGroup.queryAllByRole('menuitemradio'), ...inGroup.queryAllByRole('menuitem')];
};

/** A group's items, by name (a tile's is its label), and which of them is checked. */
const itemNames = (menu: HTMLElement, group: 'Move Assistant' | 'Arrange window') =>
  items(menu, group).map(
    (item) =>
      `${item.getAttribute('aria-label') ?? item.textContent}${item.getAttribute('aria-checked') === 'true' ? ' (checked)' : ''}`
  );

const presets = (menu: HTMLElement) => itemNames(menu, 'Arrange window');

const openButton = () => screen.getByRole('button', { name: 'Open Grafana Assistant' });

/** Moves focus down the keyboard-opened `menu` to `item`. */
async function focusDownTo(user: ReturnType<typeof renderButton>['user'], menu: HTMLElement, item: HTMLElement) {
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
async function chooseFromMenu(
  user: ReturnType<typeof renderButton>['user'],
  button: HTMLElement,
  role: 'menuitem' | 'menuitemradio',
  name: string | RegExp
) {
  button.focus();
  await user.keyboard('{ArrowDown}');
  const menu = await screen.findByRole('menu', { name: 'Grafana Assistant layout' });
  await focusDownTo(user, menu, within(menu).getByRole(role, { name }));
  await user.keyboard('{Enter}');
}

describe('AssistantToolbarButtons', () => {
  const useAsyncMock = jest.mocked(useAsync);

  beforeEach(async () => {
    jest.clearAllMocks();
    // Nothing stored, unless a test stores a choice; clearing mocks keeps a stubbed implementation.
    jest.mocked(store.get).mockReturnValue(undefined);
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

  it('renders nothing when the fullscreen workspace flag is off', async () => {
    await setFlags({ [FLOATING_FLAG]: true });

    renderButton();

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders nothing on small screens', () => {
    mockMatchMedia(false);

    renderButton();

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders nothing when the assistant plugin is not available', () => {
    useAsyncMock.mockReturnValue({ loading: false, value: new Map() });

    renderButton();

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it("fills the hidden Assistant's sparkle with the Assistant gradient", () => {
    renderButton();

    const gradient = document.getElementById('grafana-assistant-icon-gradient');
    expect(gradient?.tagName).toBe('linearGradient');
    expect(gradient?.querySelectorAll('stop')).toHaveLength(2);
    const iconWrapper = openButton().querySelector('svg')?.parentElement;
    const rules = Array.from(document.styleSheets).flatMap((sheet) =>
      Array.from(sheet.cssRules).map((rule) => rule.cssText)
    );
    expect(
      rules.some(
        (rule) =>
          rule.includes(`.${iconWrapper?.className} svg path`) && rule.includes('url(#grafana-assistant-icon-gradient)')
      )
    ).toBe(true);
  });

  it('replaces the Chat and Workspace buttons with one that shows and hides the Assistant', async () => {
    const { user } = renderButton();

    expect(screen.queryByText('Chat')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Workspace' })).not.toBeInTheDocument();
    // The plugin hides the button by this test id on its Workspace page.
    expect(openButton()).toHaveAttribute('data-testid', 'extension-toolbar-button-open');

    await user.click(openButton());
    const hideButton = screen.getByRole('button', { name: 'Hide Grafana Assistant' });
    expect(hideButton).toHaveAttribute('data-testid', 'extension-toolbar-button-close');

    await user.click(hideButton);
    expect(openButton()).toBeInTheDocument();
  });

  it('shows the floating Assistant a page holds hidden, which it reads as hidden', async () => {
    const { user } = renderButton();
    await chooseFromMenu(user, openButton(), 'menuitemradio', 'Floating');
    expect(screen.getByRole('button', { name: 'Hide Grafana Assistant' })).toBeInTheDocument();

    // A page with its own Assistant prompt, such as an empty dashboard, holds it hidden.
    act(() => {
      holdFloatingExtensionSidebar();
    });
    expect(openButton()).toHaveAttribute('data-testid', 'extension-toolbar-button-open');

    await user.click(openButton());

    expect(isFloatingExtensionSidebarHeld()).toBe(false);
    expect(screen.getByRole('button', { name: 'Hide Grafana Assistant' })).toBeInTheDocument();
  });

  it('closes the menu when clicked, so it does not cover the Assistant, until the pointer comes back', async () => {
    const { user } = renderButton();
    await user.hover(openButton());
    await screen.findByRole('menu', { name: 'Grafana Assistant layout' });

    await user.click(openButton());

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    const hideButton = screen.getByRole('button', { name: 'Hide Grafana Assistant' });
    await user.unhover(hideButton);
    await user.hover(hideButton);
    expect(await screen.findByRole('menu', { name: 'Grafana Assistant layout' })).toBeInTheDocument();
  });

  it('draws the placements in one frame: Bottom is Right turned, Floating a panel inside it', async () => {
    const { user } = renderButton();
    const menu = await openMenuWithKeyboard(user, openButton());
    const icon = (name: string) => within(menu).getByRole('menuitemradio', { name }).querySelector('svg');

    expect(icon('Left')).toHaveAttribute('data-testid', 'icon-web-section-alt');
    expect(icon('Right')).toHaveAttribute('data-testid', 'icon-web-section');
    expect(icon('Bottom')).toHaveAttribute('data-testid', 'icon-web-section');
    expect(getComputedStyle(icon('Bottom')!).transform).toBe('rotate(90deg)');
    expect(getComputedStyle(icon('Right')!).transform).toBe('');
    // Not the stack of layers Artifacts shows.
    expect(icon('Floating')).toHaveAttribute('data-testid', 'icon-gf-floating-panel');
  });

  it('checks the placement the user stored over the floating default', async () => {
    const stored: Record<string, string> = {
      'grafana.navigation.extensionSidebarPresentation': 'docked',
      'grafana.navigation.extensionSidebarDockSide': 'left',
    };
    jest.mocked(store.get).mockImplementation((key: string) => stored[key]);
    const { user } = renderButton();

    const menu = await openMenuWithKeyboard(user, openButton());

    expect(itemNames(menu, 'Move Assistant')).toEqual(['Left (checked)', 'Right', 'Bottom', 'Floating']);
  });

  it('opens the layout menu on hover without moving focus, with Floating checked by default', async () => {
    const { user } = renderButton();

    await user.hover(openButton());

    const menu = await screen.findByRole('menu', { name: 'Grafana Assistant layout' });
    // Nothing is stored, so the Assistant floats.
    expect(itemNames(menu, 'Move Assistant')).toEqual(['Left', 'Right', 'Bottom', 'Floating (checked)']);
    expect(menu).not.toContainElement(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  });

  it.each([
    ['Left', 'docked', 'left'],
    ['Right', 'docked', 'right'],
    ['Bottom', 'docked', 'bottom'],
  ] as const)('docks the Assistant on the %s, showing it if hidden', async (label, presentation, side) => {
    const { user } = renderButton();

    await chooseFromMenu(user, openButton(), 'menuitemradio', label);

    expect(getRequestedExtensionSidebarPresentation()).toBe(presentation);
    expect(getRequestedExtensionSidebarDockSide()).toBe(side);
    expect(screen.getByRole('button', { name: 'Hide Grafana Assistant' })).toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('floats the shown Assistant from a docked layout, checking the layout it shows in', async () => {
    const { user } = renderButton();
    await user.click(openButton());
    await chooseFromMenu(
      user,
      screen.getByRole('button', { name: 'Hide Grafana Assistant' }),
      'menuitemradio',
      'Right'
    );
    expect(getRequestedExtensionSidebarPresentation()).toBe('docked');

    const hideButton = screen.getByRole('button', { name: 'Hide Grafana Assistant' });
    hideButton.focus();
    await user.keyboard('{ArrowDown}');
    expect(await screen.findByRole('menuitemradio', { name: 'Right' })).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{Escape}');
    await chooseFromMenu(user, hideButton, 'menuitemradio', 'Floating');

    expect(getRequestedExtensionSidebarPresentation()).toBe('floating');
    expect(screen.getByRole('button', { name: 'Hide Grafana Assistant' })).toBeInTheDocument();
  });

  it('opens the menu with Down arrow, focusing its first item, and Escape returns focus to the button', async () => {
    const { user } = renderButton();
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
    const { user } = renderButton();
    await user.hover(openButton());
    await screen.findByRole('menu', { name: 'Grafana Assistant layout' });
    openButton().focus();

    await user.keyboard('{ArrowDown}');

    await waitFor(() => expect(screen.getByRole('menuitemradio', { name: 'Left' })).toHaveFocus());
  });

  it('offers presets that arrange the nav, the Assistant and the page, checking the current one', async () => {
    const { user } = renderButton();

    const menu = await openMenuWithKeyboard(user, openButton());

    // Floating until the user moves it, and hidden with the nav undocked: the page alone.
    expect(presets(menu)).toEqual([
      'Navigation and page with floating Assistant',
      'Page with floating Assistant',
      'Page only (checked)',
    ]);
  });

  it('names each preset tile in a tooltip above the menu, and Escape closes both at once', async () => {
    const { user } = renderButton();
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
    const { user } = renderButton();
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
    const { user } = renderButton();

    const menu = await openMenuWithKeyboard(user, openButton());

    expect(presets(menu)).toEqual(['Page with floating Assistant', 'Page only (checked)']);
  });

  it.each([
    ['Left', 'Navigation, Assistant and page'],
    ['Right', 'Navigation, page and Assistant'],
    ['Bottom', 'Navigation and page with Assistant below'],
    ['Floating', 'Navigation and page with floating Assistant'],
  ] as const)('docks and opens the nav and shows the Assistant where it was moved: %s', async (layout, presetName) => {
    const { user, chrome } = renderButton();
    await chooseFromMenu(user, openButton(), 'menuitemradio', layout);
    await user.click(screen.getByRole('button', { name: 'Hide Grafana Assistant' }));
    const placement = placementNow();

    await chooseFromMenu(user, openButton(), 'menuitemradio', presetName);

    expect(navigation(chrome)).toEqual({ docked: true, open: true });
    expect(placementNow()).toEqual(placement);
    const menu = await openMenuWithKeyboard(user, screen.getByRole('button', { name: 'Hide Grafana Assistant' }));
    expect(presets(menu).filter((item) => item.endsWith('(checked)'))).toEqual([`${presetName} (checked)`]);
  });

  it.each([
    ['Left', 'Assistant and page'],
    ['Right', 'Page and Assistant'],
    ['Bottom', 'Page with Assistant below'],
    ['Floating', 'Page with floating Assistant'],
  ] as const)('closes the nav and shows the Assistant where it was moved: %s', async (layout, presetName) => {
    const { user, chrome } = renderButton();
    act(() => {
      chrome.setMegaMenuDocked(true);
      chrome.setMegaMenuOpen(true);
    });
    await chooseFromMenu(user, openButton(), 'menuitemradio', layout);
    await user.click(screen.getByRole('button', { name: 'Hide Grafana Assistant' }));
    const placement = placementNow();

    await chooseFromMenu(user, openButton(), 'menuitemradio', presetName);

    expect(navigation(chrome)).toEqual({ docked: false, open: false });
    expect(placementNow()).toEqual(placement);
    const menu = await openMenuWithKeyboard(user, screen.getByRole('button', { name: 'Hide Grafana Assistant' }));
    expect(presets(menu).filter((item) => item.endsWith('(checked)'))).toEqual([`${presetName} (checked)`]);
  });

  it('checks no preset while the Assistant is hidden beside the docked nav', async () => {
    const { user, chrome } = renderButton();
    act(() => {
      chrome.setMegaMenuDocked(true);
      chrome.setMegaMenuOpen(true);
    });

    const menu = await openMenuWithKeyboard(user, openButton());

    expect(presets(menu).filter((item) => item.endsWith('(checked)'))).toEqual([]);
  });

  it('hides the Assistant and the nav to fill the window with the page', async () => {
    const { user, chrome } = renderButton();
    await user.click(openButton());
    act(() => {
      chrome.setMegaMenuDocked(true);
      chrome.setMegaMenuOpen(true);
    });

    await chooseFromMenu(
      user,
      screen.getByRole('button', { name: 'Hide Grafana Assistant' }),
      'menuitemradio',
      'Page only'
    );

    expect(navigation(chrome)).toEqual({ docked: false, open: false });
    expect(openButton()).toBeInTheDocument();
  });

  it('opens the Assistant in a new window while the Assistant can open one, showing it too', async () => {
    const onPopOut = jest.fn();
    const unsubscribe = subscribeToExtensionSidebarPopOut(onPopOut);
    const { user } = renderButton();
    const menu = await openMenuWithKeyboard(user, openButton());
    // The last of the ways to move the Assistant, as an action rather than a layout to check.
    expect(itemNames(menu, 'Move Assistant')).toEqual(['Left', 'Right', 'Bottom', 'Floating (checked)', 'Pop up']);
    expect(within(menu).queryByRole('separator')).not.toBeInTheDocument();
    await user.keyboard('{Escape}');

    await chooseFromMenu(user, openButton(), 'menuitemradio', 'Pop up');

    expect(onPopOut).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Hide Grafana Assistant' })).toBeInTheDocument();
    unsubscribe();
  });

  it('marks Pop up while the Assistant is in its own window, and brings it back to the layout chosen', async () => {
    const popIn = jest.fn();
    const stop = trackExtensionSidebarPopOut(popIn);
    const { user } = renderButton();
    const menu = await openMenuWithKeyboard(user, openButton());
    expect(itemNames(menu, 'Move Assistant')).toEqual(['Left', 'Right', 'Bottom', 'Floating', 'Pop up (checked)']);
    await user.keyboard('{Escape}');

    await chooseFromMenu(user, openButton(), 'menuitemradio', 'Right');

    expect(popIn).toHaveBeenCalledTimes(1);
    expect(placementNow()).toEqual({ presentation: 'docked', side: 'right' });
    act(() => stop());
  });

  it('brings the Assistant back from its own window with a layout shortcut', async () => {
    const popIn = jest.fn();
    const stop = trackExtensionSidebarPopOut(popIn);
    const { user } = renderButton();

    await user.keyboard('{Control>}{Alt>}1{/Alt}{/Control}');

    expect(popIn).toHaveBeenCalledTimes(1);
    expect(placementNow()).toEqual({ presentation: 'docked', side: 'left' });
    act(() => stop());
  });

  it('offers no new window while nothing can open one', async () => {
    const { user } = renderButton();

    await user.hover(openButton());

    const menu = await screen.findByRole('menu', { name: 'Grafana Assistant layout' });
    expect(within(menu).queryByRole('menuitem', { name: 'Pop up' })).not.toBeInTheDocument();
  });

  describe('shortcuts', () => {
    it('moves the Assistant with ctrl+alt and the digit of its layout, showing it', async () => {
      const { user } = renderButton();

      await user.keyboard('{Control>}{Alt>}2{/Alt}{/Control}');

      expect(placementNow()).toEqual({ presentation: 'docked', side: 'right' });
      expect(screen.getByRole('button', { name: 'Hide Grafana Assistant' })).toBeInTheDocument();

      await user.keyboard('{Control>}{Alt>}4{/Alt}{/Control}');

      expect(getRequestedExtensionSidebarPresentation()).toBe('floating');
    });

    it('opens the Assistant in a new window with ctrl+alt+5', async () => {
      const onPopOut = jest.fn();
      const unsubscribe = subscribeToExtensionSidebarPopOut(onPopOut);
      const { user } = renderButton();

      await user.keyboard('{Control>}{Alt>}5{/Alt}{/Control}');

      expect(onPopOut).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Hide Grafana Assistant' })).toBeInTheDocument();
      unsubscribe();
    });

    it('arranges the window with ctrl+alt+shift and the digit of its tile', async () => {
      const { user, chrome } = renderButton();

      await user.keyboard('{Control>}{Alt>}{Shift>}1{/Shift}{/Alt}{/Control}');

      expect(navigation(chrome)).toEqual({ docked: true, open: true });
      expect(screen.getByRole('button', { name: 'Hide Grafana Assistant' })).toBeInTheDocument();

      await user.keyboard('{Control>}{Alt>}{Shift>}3{/Shift}{/Alt}{/Control}');

      expect(navigation(chrome)).toEqual({ docked: false, open: false });
      expect(openButton()).toBeInTheDocument();
    });

    it('shows each shortcut beside its layout and on its tile', async () => {
      const { user } = renderButton();

      const menu = await openMenuWithKeyboard(user, openButton());

      expect(within(menu).getByRole('menuitemradio', { name: 'Right' })).toHaveTextContent('Ctrl+Alt+2');
      expect(within(menu).getByRole('menuitemradio', { name: 'Page only' })).toHaveAttribute(
        'aria-keyshortcuts',
        'Control+Alt+Shift+3'
      );
    });

    it('leaves ctrl+alt with a digit to a text field, where it types a character on some keyboards', async () => {
      const { user } = renderButton();
      const field = document.createElement('textarea');
      document.body.appendChild(field);
      field.focus();

      await user.keyboard('{Control>}{Alt>}2{/Alt}{/Control}');

      expect(placementNow().presentation).not.toBe('docked');
      expect(openButton()).toBeInTheDocument();
      field.remove();
    });
  });

  it('offers no layout menu while the sidebar cannot float, and keeps a tooltip instead', async () => {
    await setFlags({ [FULLSCREEN_WORKSPACE_FLAG]: true });
    const { user } = renderButton();

    await user.hover(openButton());

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Open Grafana Assistant');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
