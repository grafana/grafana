import { css, cx } from '@emotion/css';
import {
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  useCallback,
  useSyncExternalStore,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';

import { type GrafanaTheme2, store } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDragStyles, useSplitter, useStyles2, useTheme2 } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';

/** The navigation's height above the plugin section, once the user has resized it. */
export const MEGA_MENU_NAV_HEIGHT_STORAGE_KEY = 'grafana.navigation.megaMenuNavHeight';

/**
 * The height each pane keeps when the user drags the handle all the way, in theme spacing units: 160px, room for a few
 * navigation items above, or the section's heading, a search field and a few rows below. The same fixed height both
 * ways, so the limits match and are the same on every screen; the section folds to its heading for less.
 */
const PANE_MIN_SPACING = 20;

/**
 * The share of the menu, in percent, that the section opens to at least while the user has not resized the navigation.
 * A long navigation otherwise takes all but the section's minimum.
 */
const SECTION_OPEN_SHARE = 30;

/** The keys the splitter resizes with, in a column. */
const RESIZE_KEYS = new Set(['ArrowUp', 'ArrowDown']);

/** On the plugin section's region, so the layout can tell whether the section shows anything. */
const SECTION_ATTRIBUTE = 'data-mega-menu-section';

function readStoredNavHeight(): number | undefined {
  try {
    const stored = Number(store.get(MEGA_MENU_NAV_HEIGHT_STORAGE_KEY));
    return Number.isFinite(stored) && stored > 0 ? stored : undefined;
  } catch {
    // Blocked storage throws on access; the navigation keeps its own height.
    return undefined;
  }
}

function storeNavHeight(height: number | undefined): void {
  try {
    if (height === undefined) {
      store.delete(MEGA_MENU_NAV_HEIGHT_STORAGE_KEY);
    } else {
      store.set(MEGA_MENU_NAV_HEIGHT_STORAGE_KEY, String(height));
    }
  } catch {
    // Kept for this page load only.
  }
}

/** Whether the plugin section is folded down to its heading: `'false'` once the user unfolds it, folded otherwise. */
export const MEGA_MENU_SECTION_COLLAPSED_STORAGE_KEY = 'grafana.navigation.megaMenuSectionCollapsed';

// The section starts folded, so it adds only its heading to the menu until the user opens it.
function readStoredCollapsed(): boolean {
  try {
    return store.getBool(MEGA_MENU_SECTION_COLLAPSED_STORAGE_KEY, true);
  } catch {
    return true;
  }
}

/**
 * Whether the plugin section is folded to its heading at the bottom of the menu, and a setter the section calls from
 * its own heading. Folded until the user unfolds it, and remembered across page loads. Separate from the splitter, as the section needs it to render and the
 * splitter needs to know whether the section rendered.
 */
export function useMegaMenuSectionCollapsed(): [boolean, (collapsed: boolean) => void] {
  const [collapsed, setCollapsed] = useState(readStoredCollapsed);
  const onCollapsedChange = useCallback((next: boolean) => {
    setCollapsed(next);
    try {
      store.set(MEGA_MENU_SECTION_COLLAPSED_STORAGE_KEY, String(next));
    } catch {
      // Kept for this page load only.
    }
  }, []);
  return [collapsed, onCollapsedChange];
}

/**
 * Splits the mega menu between its navigation and the plugin section below it, with a resize handle between the two.
 * Until the user drags the handle, the navigation keeps its own height, up to what leaves the section 30% of the menu,
 * and the section takes the rest; dragging it, or moving it with the arrow keys, sets the navigation's height,
 * remembered across page loads, and a double-click gives the navigation its own height back. Either pane keeps at
 * least 160px while dragged. Without a section, or while it renders nothing, the navigation takes the whole menu and
 * there is no handle. A collapsed section keeps only its heading, at the bottom of the menu, and the navigation takes
 * the rest; the menu shows a divider in place of the handle.
 */
export function useMegaMenuSectionSplitter(hasSection: boolean, collapsed: boolean) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const dragStyles = useStyles2(getDragStyles, 'middle');
  const [navHeight, setNavHeight] = useState(readStoredNavHeight);
  // The splitter also reports a size when the handle is only clicked; only a resize sets one.
  const resized = useRef(false);
  // While the handle is pressed, so the splitter measures the navigation's whole range rather than its opening limit.
  const [resizing, setResizing] = useState(false);

  const {
    containerProps,
    primaryProps,
    secondaryProps: { ref: sectionRef, ...secondaryProps },
    splitterProps,
  } = useSplitter({
    direction: 'column',
    usePixels: true,
    pixelPane: 'primary',
    handleSize: 'lg',
    initialSize: navHeight,
    onResizing: () => {
      resized.current = true;
    },
    onSizeChanged: (_fraction, navPixels) => {
      if (!resized.current) {
        return;
      }
      resized.current = false;
      const height = Math.round(navPixels);
      setNavHeight(height);
      storeNavHeight(height);
    },
  });

  // Whether the section shows anything: a plugin can render nothing, for example for a user who cannot use it.
  const subscribeToSection = useCallback(
    (onChange: () => void) => {
      const section = sectionRef.current;
      if (!hasSection || !section) {
        return () => {};
      }
      const observer = new MutationObserver(onChange);
      observer.observe(section, { childList: true });
      return () => observer.disconnect();
    },
    [hasSection, sectionRef]
  );
  const sectionFilled = useSyncExternalStore(subscribeToSection, () => sectionRef.current?.firstChild != null);

  const openingLimit = navHeight === undefined && !resizing;

  // Longhands throughout, as the style switches between these as the section loads and folds.
  const navStyle: CSSProperties =
    hasSection && !collapsed
      ? {
          ...primaryProps.style,
          flexBasis: navHeight === undefined ? 'auto' : `${navHeight}px`,
          minHeight: theme.spacing(PANE_MIN_SPACING),
          ...(openingLimit && {
            maxHeight: `calc(${100 - SECTION_OPEN_SHARE}% - ${splitterProps.style.height})`,
          }),
        }
      : { ...primaryProps.style, flexGrow: 1, flexShrink: 1, flexBasis: 0, minHeight: 0, maxHeight: 'none' };

  // Lifted before the splitter measures the navigation, which it does as the handle is pressed. Rendered at once, as
  // the measurement runs in the same event.
  const liftOpeningLimit = () => {
    if (openingLimit) {
      flushSync(() => setResizing(true));
    }
  };
  const endResize = () => setResizing(false);

  const resetNavHeight = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    resized.current = false;
    setNavHeight(undefined);
    storeNavHeight(undefined);
    // The splitter sizes the pane directly while dragging, so the rendered style may not have changed.
    primaryProps.ref.current?.style.setProperty('flex-basis', 'auto');
  };

  // A press that selects text, or starts dragging text already selected (as the previous drag can leave it), has the
  // browser cancel the pointer mid-drag: the splitter never hears the release, and the height is not kept.
  const startResize = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    liftOpeningLimit();
    splitterProps.onPointerDown(event);
  };

  return {
    containerProps: { ...containerProps, className: cx(containerProps.className, styles.container) },
    navProps: { ...primaryProps, style: navStyle },
    separatorProps: {
      ...splitterProps,
      onPointerDown: startResize,
      onPointerUp: (event: PointerEvent<HTMLDivElement>) => {
        splitterProps.onPointerUp(event);
        endResize();
      },
      onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
        if (RESIZE_KEYS.has(event.key)) {
          liftOpeningLimit();
        }
        splitterProps.onKeyDown(event);
      },
      onKeyUp: (event: KeyboardEvent<HTMLDivElement>) => {
        splitterProps.onKeyUp(event);
        endResize();
      },
      onBlur: () => {
        splitterProps.onBlur();
        endResize();
      },
      onDoubleClick: resetNavHeight,
      'aria-label': t('navigation.megamenu.section-resize', 'Resize navigation'),
      className: cx(dragStyles.dragHandleBaseHorizontal, styles.separator),
    },
    sectionProps: {
      ...secondaryProps,
      ref: sectionRef,
      className: cx(secondaryProps.className, styles.section),
      // The splitter's minimum is the content's height; the section scrolls its own content instead. It also sets how
      // far the navigation can grow. Collapsed, the section is as tall as its heading.
      style: collapsed
        ? { ...secondaryProps.style, flexGrow: 0, flexShrink: 0, flexBasis: 'auto', minHeight: 0 }
        : { ...secondaryProps.style, minHeight: theme.spacing(PANE_MIN_SPACING) },
      [SECTION_ATTRIBUTE]: '',
    },
    /** Whether the section is in the menu and shows something. */
    sectionShown: hasSection && sectionFilled,
  };
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    minHeight: 0,
    // A plugin that renders nothing (for example, an Assistant the user cannot use) leaves the section empty, which
    // hides it and the handle, and gives the navigation the whole menu.
    [`&:has(> [${SECTION_ATTRIBUTE}]:empty)`]: {
      '& > [role="separator"], & > hr': {
        display: 'none',
      },
      '& > :first-child': {
        flex: '1 1 0 !important',
        maxHeight: 'none !important',
      },
    },
  }),
  separator: css({
    flexShrink: 0,
    // A touch drag resizes rather than scrolls the menu, which would also cancel it.
    touchAction: 'none',
    '&:focus-visible': {
      ...getFocusStyles(theme, true),
      borderRadius: theme.shape.radius.default,
    },
  }),
  section: css({
    flexDirection: 'column',
    overflow: 'hidden',
    // Room below its last row, so its hover band does not run into the menu's edge.
    paddingBottom: theme.spacing(1),
    '&:empty': {
      display: 'none',
    },
  }),
});
