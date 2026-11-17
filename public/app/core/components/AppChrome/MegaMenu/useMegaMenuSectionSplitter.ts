import { css, cx } from '@emotion/css';
import { type CSSProperties, type MouseEvent, type PointerEvent, useRef, useState } from 'react';

import { type GrafanaTheme2, store } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDragStyles, useSplitter, useStyles2, useTheme2 } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';

/** The navigation's height above the plugin section, once the user has resized it. */
export const MEGA_MENU_NAV_HEIGHT_STORAGE_KEY = 'grafana.navigation.megaMenuNavHeight';

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

/**
 * Splits the mega menu between its navigation and the plugin section below it, with a resize handle between the two.
 * Until the user drags the handle, the navigation keeps its own height and the section takes the rest; dragging it,
 * or moving it with the arrow keys, sets the navigation's height, remembered across page loads, and a double-click
 * gives the navigation its own height back. The navigation never grows past its content, and the section keeps its
 * minimum. Without a section, or while it renders nothing, the navigation takes the whole menu and there is no handle.
 */
export function useMegaMenuSectionSplitter(hasSection: boolean) {
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

  const navStyle: CSSProperties = hasSection
    ? {
        ...primaryProps.style,
        flexBasis: navHeight === undefined ? 'auto' : `${navHeight}px`,
        minHeight: theme.spacing(10),
        maxHeight: 'max-content',
      }
    : { flex: '1 1 0', minHeight: 0 };

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
      // The splitter's minimum is the content's height; the section scrolls its own content instead.
      style: { ...secondaryProps.style, minHeight: `min(${theme.spacing(30)}, 50%)` },
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
      '& > [role="separator"]': {
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
