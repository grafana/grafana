import { css, cx } from '@emotion/css';
import {
  FloatingFocusManager,
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  safePolygon,
  shift,
  useDismiss,
  useFloating,
  useHover,
  useInteractions,
  useRole,
} from '@floating-ui/react';
import {
  type ComponentType,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, type IconName, Menu, ToolbarButton, Tooltip, getPortalContainer, useStyles2 } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';
import { getModKey } from 'app/core/utils/browser';

import { useExtensionSidebarContext } from '../ExtensionSidebar/ExtensionSidebarProvider';
import {
  canPlaceExtensionSidebar,
  canPopOutExtensionSidebar,
  type ExtensionSidebarPlacement,
  getExtensionSidebarPlacement,
  isExtensionSidebarPoppedOut,
  popInExtensionSidebar,
  popOutExtensionSidebar,
  setExtensionSidebarPlacement,
  subscribeToExtensionSidebarPresentation,
} from '../ExtensionSidebar/extensionSidebarLayout';

import { ASSISTANT_PLUGIN_ID } from './assistantWorkspaceRoute';

/** Long enough that the pointer crossing the button on its way elsewhere does not open the menu. */
const MENU_OPEN_DELAY_MS = 300;

/** Where the Assistant shows: docked on either side of the page or below it, or floating over it. */
type AssistantLayout = ExtensionSidebarPlacement;

/**
 * What shares the window besides the page: the docked nav and the Assistant, the Assistant alone, or nothing. The
 * Assistant shows wherever Move Assistant put it, so the presets that show it leave its placement as it is.
 */
type ArrangePreset = 'with-navigation' | 'without-navigation' | 'page-only';

/** A part of the window, as a preset's tile draws it. */
type Pane = 'navigation' | 'page' | 'assistant';

/**
 * What a preset's tile draws: the panes side by side, left to right, and whether the Assistant floats over them or
 * runs below the page, past the nav.
 */
interface PresetDrawing {
  panes: readonly Pane[];
  assistantFloating?: boolean;
  assistantBelow?: boolean;
}

/**
 * The digit after ⌘⌥ (Ctrl+Alt elsewhere) that moves the Assistant, in the menu's order; Pop up follows on 5. Pressed
 * while the Assistant already shows there, a shortcut hides it, and the next press shows it there again. The
 * browser's own ⌘1-9 switches tabs, so the shortcuts add ⌥.
 */
const LAYOUT_SHORTCUT_DIGITS: Record<AssistantLayout, number> = { left: 1, right: 2, bottom: 3, floating: 4 };
const POP_UP_SHORTCUT_DIGIT = 5;
/** The digit after ⌘⌥⇧ that arranges the window, in the order of the tiles. Fixed, so it means the same everywhere. */
const PRESET_SHORTCUT_DIGITS: Record<ArrangePreset, number> = {
  'with-navigation': 1,
  'without-navigation': 2,
  'page-only': 3,
};

/** A layout shortcut: the digit pressed, and whether with Shift, for the presets. */
interface LayoutShortcut {
  digit: number;
  shift: boolean;
}

const isApplePlatform = () => getModKey() === '⌘';

/** As a macOS menu writes it, `⌘⌥1`, to keep the hint short; spelled out elsewhere. */
function formatLayoutShortcut({ digit, shift }: LayoutShortcut): string {
  return isApplePlatform() ? `⌘⌥${shift ? '⇧' : ''}${digit}` : `Ctrl+Alt+${shift ? 'Shift+' : ''}${digit}`;
}

function getLayoutShortcutAria({ digit, shift }: LayoutShortcut): string {
  return `${isApplePlatform() ? 'Meta' : 'Control'}+Alt+${shift ? 'Shift+' : ''}${digit}`;
}

const isTextEntry = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/** The layout shortcut a key press makes, if any. Read from the key's position, as ⌥ and ⇧ change the character. */
function readLayoutShortcut(event: globalThis.KeyboardEvent): LayoutShortcut | undefined {
  const apple = isApplePlatform();
  const modifier = apple ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  if (!modifier || !event.altKey || event.repeat || event.defaultPrevented) {
    return undefined;
  }
  // Elsewhere Ctrl+Alt is AltGr, which types characters on many keyboards, so text fields keep it.
  if (!apple && isTextEntry(event.target)) {
    return undefined;
  }
  const digit = Number(/^Digit([1-5])$/.exec(event.code)?.[1]);
  return Number.isNaN(digit) ? undefined : { digit, shift: event.shiftKey };
}

/** How the open menu was opened: by hover it leaves focus where it is, with Down arrow it takes it. */
type MenuOpenedBy = 'hover' | 'keyboard';

interface Props {
  assistantComponentId: string;
  /** Whether the Assistant shows; held hidden by a page, it reads as closed. */
  isOpen: boolean;
  icon: ReactElement;
  className?: string;
}

/**
 * The top bar's Chat button. A click shows or hides the Assistant. While `grafana.extensionSidebarPlacements` and
 * floating's flag are on, hovering the button, or pressing Down arrow on it, opens a menu that moves the Assistant to the left,
 * right or bottom of the page, floats it, or, while the Assistant can, opens it in a new window, and presets that
 * arrange the nav and the Assistant together. Choosing a layout, or a preset that shows the Assistant, shows it if it
 * is hidden. A layout's shortcut, pressed while the Assistant already shows in that layout, hides it instead.
 */
export function AssistantChatButton({ assistantComponentId, isOpen, icon, className }: Props) {
  const styles = useStyles2(getStyles);
  const { chrome } = useGrafana();
  const { megaMenuDocked, megaMenuOpen } = chrome.useState();
  // Below this the nav cannot stay docked (`useResponsiveDockedMegaMenu`), and the nav offers no dock button.
  const canDockNavigation = useMediaQueryMinWidth('xl');
  const { setDockedComponentId } = useExtensionSidebarContext();
  const layout = useAssistantLayout();
  // In its own window the Assistant is in none of the page's layouts; moving it to one brings it back first.
  const poppedOut = useSyncExternalStore(subscribeToExtensionSidebarPresentation, isExtensionSidebarPoppedOut);
  const canChangeLayout = canPlaceExtensionSidebar();
  const [menuOpenedBy, setMenuOpenedBy] = useState<MenuOpenedBy | undefined>(undefined);
  const menuOpen = menuOpenedBy !== undefined;
  // The menu's own setter for the item it focuses, so moving along the presets keeps its place in step.
  const focusMenuItem = useRef<((index: number) => void) | undefined>(undefined);
  // After a click the menu stays shut until the pointer leaves, so it does not cover the Assistant it showed.
  const [hoverPaused, setHoverPaused] = useState(false);
  // The button controls the menu itself, not the wrapper that positions it.
  const menuId = useId();

  const { refs, floatingStyles, context } = useFloating({
    open: menuOpen,
    // Hover opens it; hover and dismissal close it.
    onOpenChange: (open) => setMenuOpenedBy(open ? 'hover' : undefined),
    placement: 'bottom-end',
    middleware: [offset(8), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const hover = useHover(context, {
    enabled: canChangeLayout && !hoverPaused,
    delay: { open: MENU_OPEN_DELAY_MS },
    handleClose: safePolygon(),
  });
  const dismiss = useDismiss(context, { enabled: canChangeLayout });
  const role = useRole(context, { enabled: canChangeLayout, role: 'menu' });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, dismiss, role]);
  // Callbacks, so `refs` is read when React attaches the elements rather than while rendering.
  const setButtonElement = useCallback((element: HTMLButtonElement | null) => refs.setReference(element), [refs]);
  const setMenuElement = useCallback((element: HTMLDivElement | null) => refs.setFloating(element), [refs]);

  const show = () => {
    if (!isOpen) {
      setDockedComponentId(assistantComponentId);
    }
  };

  // Closed as the Chat button closes it, its own window included.
  const hide = () => {
    setMenuOpenedBy(undefined);
    setDockedComponentId(undefined);
  };

  const moveTo = (next: AssistantLayout) => {
    setMenuOpenedBy(undefined);
    if (poppedOut) {
      popInExtensionSidebar();
    }
    setExtensionSidebarPlacement(next);
    show();
  };

  const openInNewWindow = () => {
    setMenuOpenedBy(undefined);
    if (poppedOut) {
      return;
    }
    show();
    popOutExtensionSidebar();
  };

  const arrange = (preset: ArrangePreset) => {
    setMenuOpenedBy(undefined);
    const withNavigation = preset === 'with-navigation';
    // Docked first, so opening it persists; undocked first, as the nav's own dock button does.
    chrome.setMegaMenuDocked(withNavigation);
    chrome.setMegaMenuOpen(withNavigation);
    if (preset === 'page-only') {
      // Closed as the Chat button closes it, its own window included. Not popped in first: that tells the extension
      // the user moved it, so the layout the window floated would stay floating instead of docking again.
      setDockedComponentId(undefined);
      return;
    }
    // Brought back from its own window, as moving it does, and shown where Move Assistant put it.
    if (poppedOut) {
      popInExtensionSidebar();
    }
    show();
  };
  const preset = getArrangePreset(isOpen, megaMenuDocked && megaMenuOpen);

  /** Whether the shortcut does anything, so a key it ignores keeps its own meaning. */
  const onShortcut = ({ digit, shift }: LayoutShortcut): boolean => {
    if (shift) {
      const shortcutPreset = getArrangeOptions(canDockNavigation, layout).find(
        (option) => PRESET_SHORTCUT_DIGITS[option.value] === digit
      );
      if (shortcutPreset) {
        arrange(shortcutPreset.value);
      }
      return shortcutPreset !== undefined;
    }
    if (digit === POP_UP_SHORTCUT_DIGIT) {
      if (poppedOut && isOpen) {
        hide();
        return true;
      }
      if (!canPopOutExtensionSidebar()) {
        return false;
      }
      openInNewWindow();
      return true;
    }
    const shortcutLayout = getLayoutOptions().find((option) => LAYOUT_SHORTCUT_DIGITS[option.value] === digit);
    if (!shortcutLayout) {
      return false;
    }
    // In its own window the Assistant is in none of the page's layouts, so its layout's shortcut brings it back.
    if (isOpen && !poppedOut && layout === shortcutLayout.value) {
      hide();
    } else {
      moveTo(shortcutLayout.value);
    }
    return true;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' && canChangeLayout) {
      event.preventDefault();
      setMenuOpenedBy('keyboard');
    }
  };

  // Left and Right arrows move along the row of presets; the menu's own Left arrow would take focus off its items.
  const moveAlongPresets = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const row = event.currentTarget;
    const tiles = Array.from(row.querySelectorAll<HTMLElement>('[data-role="menuitem"]'));
    const next = tiles[tiles.findIndex((tile) => tile === event.target) + step];
    const items = row.closest('[role="menu"]')?.querySelectorAll('[data-role="menuitem"]:not([data-disabled])');
    if (next && items) {
      focusMenuItem.current?.(Array.from(items).indexOf(next));
    }
  };

  // Ahead of a focused preset's Tooltip, which would take Escape to close only itself; stopped as `useDismiss` does.
  const closeOnEscape = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      setMenuOpenedBy(undefined);
    }
  };

  // Held hidden by a page reads as hidden, so this shows it; opening releases the page's hold.
  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    setMenuOpenedBy(undefined);
    // Only a pointer click pauses hover: Enter or Space leave no pointer on the button to leave and resume it.
    if (event.detail > 0) {
      setHoverPaused(true);
    }
    setDockedComponentId(isOpen ? undefined : assistantComponentId);
  };

  return (
    <>
      {canChangeLayout && <LayoutShortcuts onShortcut={onShortcut} />}
      <ToolbarButton
        ref={setButtonElement}
        icon={icon}
        variant={isOpen ? 'active' : 'default'}
        className={className}
        data-testid={`extension-toolbar-button-${isOpen ? 'close' : 'open'}`}
        // With the layout menu, `aria-expanded` says whether the menu shows; `aria-pressed` says whether the
        // Assistant does.
        aria-expanded={isOpen}
        aria-pressed={isOpen}
        aria-label={
          isOpen
            ? t('navigation.extension-sidebar.assistant-close', 'Close Grafana Assistant')
            : t('navigation.extension-sidebar.assistant-open', 'Open Grafana Assistant')
        }
        aria-keyshortcuts={canChangeLayout ? 'ArrowDown' : undefined}
        // The menu opens on hover, so a tooltip would cover it.
        tooltip={
          canChangeLayout
            ? undefined
            : isOpen
              ? t('navigation.extension-sidebar.assistant-close-tooltip', 'Close Chat')
              : t('navigation.extension-sidebar.assistant-open-tooltip', 'Open Chat')
        }
        {...getReferenceProps({
          onKeyDown,
          onClick,
          onPointerLeave: () => setHoverPaused(false),
          'aria-controls': menuOpen ? menuId : undefined,
        })}
      >
        {t('navigation.extension-sidebar.assistant-label', 'Chat')}
      </ToolbarButton>
      {menuOpen && (
        // FloatingPortal keeps the menu in the tab order right after the button. Rendered where Grafana renders its
        // overlays, so the tooltips its preset tiles open there stack above it.
        <FloatingPortal root={getPortalContainer()}>
          {/* Closing with focus inside, e.g. via Escape, returns focus to the button. Hover closes don't move focus. */}
          <FloatingFocusManager context={context} modal={false} initialFocus={-1} returnFocus>
            <div
              ref={setMenuElement}
              className={styles.menu}
              style={floatingStyles}
              // Only positions the menu inside it, so it takes no role or name of its own: one menu, not two nested.
              {...getFloatingProps({
                role: 'presentation',
                'aria-labelledby': undefined,
                onKeyDownCapture: closeOnEscape,
              })}
            >
              <Menu
                // Down arrow on a hover-opened menu remounts it, so it takes focus as a keyboard-opened one does.
                key={menuOpenedBy}
                id={menuId}
                ariaLabel={t('navigation.assistant-toolbar-button.menu', 'Grafana Assistant layout')}
                // Tab and Shift+Tab close it, as they close Grafana's other menus, and focus goes back to the button.
                onClose={() => setMenuOpenedBy(undefined)}
                onOpen={(focusOnItem) => {
                  focusMenuItem.current = focusOnItem;
                  if (menuOpenedBy === 'hover') {
                    // The menu focuses its first item when it opens; -1 focuses none.
                    focusOnItem(-1);
                  }
                }}
              >
                <Menu.Group label={t('navigation.assistant-toolbar-button.move', 'Move Assistant')}>
                  {getLayoutOptions().map((option) => (
                    <Menu.Item
                      key={option.value}
                      label={option.label}
                      ariaLabel={option.label}
                      icon={option.icon}
                      role="menuitemradio"
                      ariaChecked={!poppedOut && layout === option.value}
                      className={cx(
                        styles.item,
                        option.iconTurned && styles.itemIconTurned,
                        !poppedOut && layout === option.value && styles.itemSelected
                      )}
                      component={getShortcutHint(LAYOUT_SHORTCUT_DIGITS[option.value])}
                      onClick={() => moveTo(option.value)}
                    />
                  ))}
                  {(poppedOut || canPopOutExtensionSidebar()) && (
                    <Menu.Item
                      label={t('navigation.assistant-toolbar-button.pop-up', 'Pop up')}
                      ariaLabel={t('navigation.assistant-toolbar-button.pop-up', 'Pop up')}
                      icon="external-link-alt"
                      role="menuitemradio"
                      ariaChecked={poppedOut}
                      className={cx(styles.item, poppedOut && styles.itemSelected)}
                      component={getShortcutHint(POP_UP_SHORTCUT_DIGIT)}
                      onClick={openInNewWindow}
                    />
                  )}
                </Menu.Group>
                <Menu.Group label={t('navigation.assistant-toolbar-button.arrange-window', 'Arrange window')}>
                  {/* One row of tiles, each drawing its layout, as a window-tiling menu shows its arrangements. */}
                  {/* Only lays the tiles out, so it takes no role; their Tooltip owns each tile's own key handler. */}
                  <div role="presentation" className={styles.presets} onKeyDown={moveAlongPresets}>
                    {getArrangeOptions(canDockNavigation, layout).map((option) => (
                      <PresetTile
                        key={option.value}
                        option={option}
                        checked={preset === option.value}
                        onClick={() => arrange(option.value)}
                      />
                    ))}
                  </div>
                </Menu.Group>
              </Menu>
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </>
  );
}

interface LayoutShortcutsProps {
  /** Returns whether the shortcut did anything. */
  onShortcut: (shortcut: LayoutShortcut) => boolean;
}

/** Listens for the layout shortcuts anywhere on the page while the menu can change the layout. */
function LayoutShortcuts({ onShortcut }: LayoutShortcutsProps) {
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      const shortcut = readLayoutShortcut(event);
      if (shortcut && onShortcut(shortcut)) {
        event.preventDefault();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onShortcut]);
  return null;
}

interface LayoutOption {
  value: AssistantLayout;
  label: string;
  icon: IconName;
  /** Shows the icon turned a quarter clockwise. */
  iconTurned?: boolean;
}

function getLayoutOptions(): LayoutOption[] {
  return [
    { value: 'left', label: t('navigation.assistant-toolbar-button.left', 'Left'), icon: 'web-section-alt' },
    { value: 'right', label: t('navigation.assistant-toolbar-button.right', 'Right'), icon: 'web-section' },
    // Grafana has no icon with the panel at the bottom; the right one, turned, puts it there in the same glyph.
    {
      value: 'bottom',
      label: t('navigation.assistant-toolbar-button.bottom', 'Bottom'),
      icon: 'web-section',
      iconTurned: true,
    },
    {
      value: 'floating',
      label: t('navigation.assistant-toolbar-button.floating', 'Floating'),
      icon: 'gf-floating-panel',
    },
  ];
}

interface ArrangeOption {
  value: ArrangePreset;
  /** Names what the window shows, left to right, as the tile draws it. */
  label: string;
  drawing: PresetDrawing;
}

/** The presets, drawn and named for where the Assistant shows, without the nav one where the nav cannot stay docked. */
function getArrangeOptions(canDockNavigation: boolean, layout: AssistantLayout): ArrangeOption[] {
  const [withNavigation, withoutNavigation] = getAssistantPresets(layout);
  return [
    ...(canDockNavigation ? [withNavigation] : []),
    withoutNavigation,
    {
      value: 'page-only',
      label: t('navigation.assistant-toolbar-button.page-only', 'Page only'),
      drawing: { panes: ['page'] },
    },
  ];
}

/** The two presets that show the Assistant, as they look where it shows; docked on the left, it follows the nav. */
function getAssistantPresets(layout: AssistantLayout): [ArrangeOption, ArrangeOption] {
  switch (layout) {
    case 'left':
      return [
        {
          value: 'with-navigation',
          label: t('navigation.assistant-toolbar-button.navigation-assistant-page', 'Navigation, Assistant and page'),
          drawing: { panes: ['navigation', 'assistant', 'page'] },
        },
        {
          value: 'without-navigation',
          label: t('navigation.assistant-toolbar-button.assistant-page', 'Assistant and page'),
          drawing: { panes: ['assistant', 'page'] },
        },
      ];
    case 'right':
      return [
        {
          value: 'with-navigation',
          label: t('navigation.assistant-toolbar-button.navigation-page-assistant', 'Navigation, page and Assistant'),
          drawing: { panes: ['navigation', 'page', 'assistant'] },
        },
        {
          value: 'without-navigation',
          label: t('navigation.assistant-toolbar-button.page-assistant', 'Page and Assistant'),
          drawing: { panes: ['page', 'assistant'] },
        },
      ];
    case 'bottom':
      return [
        {
          value: 'with-navigation',
          label: t(
            'navigation.assistant-toolbar-button.navigation-page-assistant-below',
            'Navigation and page with Assistant below'
          ),
          drawing: { panes: ['navigation', 'page'], assistantBelow: true },
        },
        {
          value: 'without-navigation',
          label: t('navigation.assistant-toolbar-button.page-assistant-below', 'Page with Assistant below'),
          drawing: { panes: ['page'], assistantBelow: true },
        },
      ];
    case 'floating':
      return [
        {
          value: 'with-navigation',
          label: t(
            'navigation.assistant-toolbar-button.navigation-page-floating-assistant',
            'Navigation and page with floating Assistant'
          ),
          drawing: { panes: ['navigation', 'page'], assistantFloating: true },
        },
        {
          value: 'without-navigation',
          label: t('navigation.assistant-toolbar-button.page-floating-assistant', 'Page with floating Assistant'),
          drawing: { panes: ['page'], assistantFloating: true },
        },
      ];
  }
}

/**
 * The preset the whole window is arranged in now, if any, wherever the Assistant shows: at most one, as each takes the
 * nav as docked or not.
 */
function getArrangePreset(assistantShown: boolean, navigationDocked: boolean): ArrangePreset | undefined {
  if (!assistantShown) {
    return navigationDocked ? undefined : 'page-only';
  }
  return navigationDocked ? 'with-navigation' : 'without-navigation';
}

interface PresetTileProps {
  option: ArrangeOption;
  checked: boolean;
  onClick: () => void;
}

/** A preset as a tile that draws the window it arranges, named by its tooltip, with a check while it is current. */
function PresetTile({ option, checked, onClick }: PresetTileProps) {
  const styles = useStyles2(getStyles);
  const shortcut: LayoutShortcut = { digit: PRESET_SHORTCUT_DIGITS[option.value], shift: true };
  return (
    <Tooltip
      content={
        <>
          {option.label} <span className={styles.shortcutHint}>{formatLayoutShortcut(shortcut)}</span>
        </>
      }
      placement="bottom"
    >
      <button
        type="button"
        role="menuitemradio"
        aria-checked={checked}
        aria-label={option.label}
        aria-keyshortcuts={getLayoutShortcutAria(shortcut)}
        // How the menu finds its items for arrow keys, as `Menu.Item` marks its own; it sets their tab order too.
        data-role="menuitem"
        className={cx(styles.tile, checked && styles.tileChecked)}
        onClick={onClick}
      >
        {option.drawing.panes.map((pane) =>
          // Below the page: a column of the page over the Assistant, beside the nav's full height.
          pane === 'page' && option.drawing.assistantBelow ? (
            <span key={pane} className={styles.paneColumn}>
              <span className={cx(styles.pane, styles.panes.page)} />
              <span className={cx(styles.pane, styles.assistantBelow)}>
                <Icon name="ai-sparkle" size="xs" />
              </span>
            </span>
          ) : (
            <span key={pane} className={cx(styles.pane, styles.panes[pane])}>
              {pane === 'assistant' && <Icon name="ai-sparkle" size="xs" />}
            </span>
          )
        )}
        {option.drawing.assistantFloating && (
          <span className={cx(styles.pane, styles.floatingAssistant)}>
            <Icon name="ai-sparkle" size="xs" />
          </span>
        )}
        {checked && (
          <span className={styles.tileCheck}>
            <Icon name="check" size="xs" />
          </span>
        )}
      </button>
    </Tooltip>
  );
}

/** The layout the Assistant shows in, or, while it is hidden, the one it opens in. */
function useAssistantLayout(): AssistantLayout {
  return useSyncExternalStore(subscribeToExtensionSidebarPresentation, () =>
    getExtensionSidebarPlacement(ASSISTANT_PLUGIN_ID)
  );
}

/** An item's shortcut at its end, small and dimmed, lined up down the menu. */
function ShortcutHint({ digit }: { digit: number }) {
  const styles = useStyles2(getStyles);
  return (
    <span className={cx(styles.itemEnd, styles.shortcutHint)} aria-hidden>
      {formatLayoutShortcut({ digit, shift: false })}
    </span>
  );
}

// `Menu.Item` renders its `component` without props, so each hint is a component of its own, made once.
const shortcutHints = new Map<number, ComponentType>();
function getShortcutHint(digit: number): ComponentType {
  let Hint = shortcutHints.get(digit);
  if (!Hint) {
    Hint = function LayoutShortcutHint() {
      return <ShortcutHint digit={digit} />;
    };
    shortcutHints.set(digit, Hint);
  }
  return Hint;
}

const getStyles = (theme: GrafanaTheme2) => ({
  menu: css({
    zIndex: theme.zIndex.portal,
  }),
  // Room on the right for the shortcut.
  item: css({
    paddingRight: theme.spacing(7),
  }),
  // The current layout, as the nav marks the current page; it stays marked under the pointer.
  itemSelected: css({
    '&, &:hover, &:focus-visible': {
      background: theme.flags.visualDesignRefresh ? theme.colors.accent.subtleBackground : theme.colors.action.selected,
    },
    '@media (forced-colors: active)': {
      outline: '1px solid Highlight',
    },
  }),
  // The item's leading icon: `Menu.Item` lays it out first in its row.
  itemIconTurned: css({
    '& > div > svg:first-child': {
      transform: 'rotate(90deg)',
    },
  }),
  itemEnd: css({
    position: 'absolute',
    right: theme.spacing(1.5),
    top: '50%',
    transform: 'translateY(-50%)',
  }),
  shortcutHint: css({
    ...theme.typography.bodySmall,
    color: theme.colors.text.disabled,
    marginLeft: theme.spacing(0.5),
  }),
  presets: css({
    display: 'flex',
    gap: theme.spacing(1),
    padding: theme.spacing(0.5, 1, 1),
  }),
  // A window in miniature: as wide as eight grid units and as tall as five.
  tile: css({
    position: 'relative',
    display: 'flex',
    gap: theme.spacing(0.25),
    width: theme.spacing(8),
    height: theme.spacing(5),
    padding: theme.spacing(0.5),
    background: 'none',
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    color: theme.colors.text.secondary,
    cursor: 'pointer',
    '&:hover': {
      background: theme.colors.action.hover,
      borderColor: theme.colors.border.strong,
    },
    '&:focus-visible': getFocusStyles(theme),
  }),
  tileChecked: css({
    borderColor: theme.colors.primary.border,
    '&:hover': {
      borderColor: theme.colors.primary.border,
    },
  }),
  // The check marks the current preset by shape, not only by the border's colour.
  tileCheck: css({
    position: 'absolute',
    top: theme.spacing(-0.75),
    right: theme.spacing(-0.75),
    display: 'flex',
    padding: theme.spacing(0.25),
    borderRadius: theme.shape.radius.circle,
    background: theme.colors.primary.main,
    color: theme.colors.primary.contrastText,
  }),
  pane: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.shape.radius.sm,
  }),
  panes: {
    navigation: css({
      flex: '0 0 18%',
      background: theme.colors.border.medium,
    }),
    page: css({
      flex: 1,
      border: `1px solid ${theme.colors.border.medium}`,
    }),
    assistant: css({
      flex: '0 0 32%',
      background: theme.colors.border.medium,
    }),
  },
  // The page over the Assistant docked below it, as wide as the page.
  paneColumn: css({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.25),
  }),
  assistantBelow: css({
    flex: '0 0 40%',
    background: theme.colors.border.medium,
  }),
  // Over the page, inside its bottom corner.
  floatingAssistant: css({
    position: 'absolute',
    right: theme.spacing(1),
    bottom: theme.spacing(1),
    width: '32%',
    height: '50%',
    background: theme.colors.border.medium,
    boxShadow: theme.shadows.z1,
  }),
});
