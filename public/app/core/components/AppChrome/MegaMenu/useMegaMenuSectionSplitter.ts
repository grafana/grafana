import { css, cx } from '@emotion/css';
import { type CSSProperties, type MouseEvent, type PointerEvent, useCallback, useRef, useState } from 'react';

import { type GrafanaTheme2, store } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDragStyles, useSplitter, useStyles2, useTheme2 } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';

/** The navigation's height above the plugin section, once the user has resized it. */
export const MEGA_MENU_NAV_HEIGHT_STORAGE_KEY = 'grafana.navigation.megaMenuNavHeight';

/** The smallest share of the menu the plugin section keeps when the user drags the handle down. */
const SECTION_MIN_HEIGHT = '25%';

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

/** Whether the user has folded the plugin section down to its heading. */
export const MEGA_MENU_SECTION_COLLAPSED_STORAGE_KEY = 'grafana.navigation.megaMenuSectionCollapsed';

function readStoredCollapsed(): boolean {
  try {
    return store.getBool(MEGA_MENU_SECTION_COLLAPSED_STORAGE_KEY, false);
  } catch {
    return false;
  }
}

/**
 * Whether the plugin section is folded to its heading at the bottom of the menu, and a setter the section calls from
 * its own heading. Remembered across page loads. Separate from the splitter, as the section needs it to render and the
 * splitter needs to know whether the section rendered.
 */
export function useMegaMenuSectionCollapsed(): [boolean, (collapsed: boolean) => void] {
  const [collapsed, setCollapsed] = useState(readStoredCollapsed);
  const onCollapsedChange = useCallback((next: boolean) => {
    setCollapsed(next);
    try {
      if (next) {
        store.set(MEGA_MENU_SECTION_COLLAPSED_STORAGE_KEY, 'true');
      } else {
        store.delete(MEGA_MENU_SECTION_COLLAPSED_STORAGE_KEY);
      }
    } catch {
      // Kept for this page load only.
    }
  }, []);
  return [collapsed, onCollapsedChange];
}

/**
 * Splits the mega menu between its navigation and the plugin section below it, with a resize handle between the two.
 * Until the user drags the handle, the navigation keeps its own height and the section takes the rest; dragging it,
 * or moving it with the arrow keys, sets the navigation's height, remembered across page loads, and a double-click
 * gives the navigation its own height back. The section keeps at least a quarter of the menu, so the navigation can
 * grow past its content to make room for its sections as they expand. Without a section, or while it renders nothing,
 * the navigation takes the whole menu and there is no handle. A collapsed section keeps only its heading, at the
 * bottom of the menu, and the navigation takes the rest; the menu shows a divider in place of the handle.
 */
export function useMegaMenuSectionSplitter(hasSection: boolean, collapsed: boolean) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const dragStyles = useStyles2(getDragStyles, 'middle');
  const [navHeight, setNavHeight] = useState(readStoredNavHeight);
  // The splitter also reports a size when the handle is only clicked; only a resize sets one.
  const resized = useRef(false);

  const { containerProps, primaryProps, secondaryProps, splitterProps } = useSplitter({
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

  // Longhands throughout, as the style switches between these as the section loads and folds.
  const navStyle: CSSProperties =
    hasSection && !collapsed
      ? {
          ...primaryProps.style,
          flexBasis: navHeight === undefined ? 'auto' : `${navHeight}px`,
          minHeight: theme.spacing(10),
        }
      : { ...primaryProps.style, flexGrow: 1, flexShrink: 1, flexBasis: 0, minHeight: 0, maxHeight: 'none' };

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
    splitterProps.onPointerDown(event);
  };

  return {
    containerProps: { ...containerProps, className: cx(containerProps.className, styles.container) },
    navProps: { ...primaryProps, style: navStyle },
    separatorProps: {
      ...splitterProps,
      onPointerDown: startResize,
      onDoubleClick: resetNavHeight,
      'aria-label': t('navigation.megamenu.section-resize', 'Resize navigation'),
      className: cx(dragStyles.dragHandleBaseHorizontal, styles.separator),
    },
    sectionProps: {
      ...secondaryProps,
      className: cx(secondaryProps.className, styles.section),
      // The splitter's minimum is the content's height; the section scrolls its own content instead. It also sets how
      // far the navigation can grow. Collapsed, the section is as tall as its heading.
      style: collapsed
        ? { ...secondaryProps.style, flexGrow: 0, flexShrink: 0, flexBasis: 'auto', minHeight: 0 }
        : { ...secondaryProps.style, minHeight: SECTION_MIN_HEIGHT },
      [SECTION_ATTRIBUTE]: '',
    },
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
    '&:empty': {
      display: 'none',
    },
  }),
});
