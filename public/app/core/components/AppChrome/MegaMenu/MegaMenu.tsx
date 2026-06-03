import { css } from '@emotion/css';
import { type DOMAttributes } from '@react-types/shared';
import { memo, forwardRef, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { usePatchUserPreferencesMutation } from '@grafana/api-clients/internal/rtkq/legacy/preferences/user';
import { type GrafanaTheme2, type NavModelItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { ScrollContainer, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { filterNavTreeByJobRole } from 'app/core/navigation/jobRoleNav';
import { setBookmark } from 'app/core/reducers/navBarTree';
import { useDispatch, useSelector } from 'app/types/store';

import { clampMegaMenuWidth } from '../AppChromeService';

import { MegaMenuExtensionPoint } from './MegaMenuExtensionPoint';
import { MegaMenuHeader } from './MegaMenuHeader';
import { MegaMenuItem } from './MegaMenuItem';
import { useNavbarPreferences } from './hooks';
import { enrichWithInteractionTracking, findByUrl, getActiveItem } from './utils';

export const MENU_WIDTH = '300px';

export interface Props extends DOMAttributes {
  onClose: () => void;
}

export const MegaMenu = memo(
  forwardRef<HTMLDivElement, Props>(({ onClose, ...restProps }, ref) => {
    const navTree = useSelector((state) => state.navBarTree);
    const styles = useStyles2(getStyles);
    const location = useLocation();
    const { chrome } = useGrafana();
    const dispatch = useDispatch();
    const state = chrome.useState();
    const [patchPreferences] = usePatchUserPreferencesMutation();
    const { pinnedItems, jobRole, isLoading } = useNavbarPreferences();
    const resolvedJobRole = jobRole ?? config.bootData?.user?.navbar?.jobRole;
    const filteredNavTree = config.featureToggles.jobRoleNavPresets
      ? isLoading && !resolvedJobRole
        ? []
        : filterNavTreeByJobRole(navTree, resolvedJobRole)
      : navTree;

    // Remove profile + help from tree
    const navItems = filteredNavTree
      .filter((item) => item.id !== 'profile' && item.id !== 'help')
      .map((item) => enrichWithInteractionTracking(item, state.megaMenuDocked));

    const bookmarksItem = navItems.find((item) => item.id === 'bookmarks');
    if (bookmarksItem) {
      // Add children to the bookmarks section
      bookmarksItem.children = pinnedItems.reduce((acc: NavModelItem[], url) => {
        const item = findByUrl(navItems, url);
        if (!item) {
          return acc;
        }
        const newItem = {
          id: item.id,
          text: item.text,
          url: item.url,
          parentItem: { id: 'bookmarks', text: 'Bookmarks' },
        };
        acc.push(enrichWithInteractionTracking(newItem, state.megaMenuDocked));
        return acc;
      }, []);
    }

    const activeItem = getActiveItem(navItems, state.sectionNav.node, location.pathname);
    const hideNavItems = Boolean(config.featureToggles.simplifiedNavigation);

    const handleDockedMenu = () => {
      chrome.setMegaMenuDocked(!state.megaMenuDocked);
      if (state.megaMenuDocked) {
        chrome.setMegaMenuOpen(false);
      }
    };

    // Drag-to-resize the docked menu. During the drag we update the CSS variable
    // directly (cheap, no re-render) and only commit to chrome state on release.
    const resizeWidthRef = useRef(state.megaMenuWidth);
    const onResizeMouseDown = (event: React.MouseEvent) => {
      event.preventDefault();
      const onMove = (moveEvent: MouseEvent) => {
        const width = clampMegaMenuWidth(moveEvent.clientX);
        resizeWidthRef.current = width;
        document.documentElement.style.setProperty('--grafana-mega-menu-width', `${width}px`);
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.removeProperty('user-select');
        document.body.style.removeProperty('cursor');
        chrome.setMegaMenuWidth(resizeWidthRef.current);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
    };
    const onResizeKeyDown = (event: React.KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        chrome.setMegaMenuWidth(state.megaMenuWidth - 16);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        chrome.setMegaMenuWidth(state.megaMenuWidth + 16);
      }
    };

    const isPinned = useCallback(
      (url?: string) => {
        if (!url || !pinnedItems?.length) {
          return false;
        }
        return pinnedItems?.includes(url);
      },
      [pinnedItems]
    );

    const onPinItem = (item: NavModelItem) => {
      const { url } = item;
      if (url) {
        const isSaved = isPinned(url);
        const newItems = isSaved ? pinnedItems.filter((i) => url !== i) : [...pinnedItems, url];
        const interactionName = isSaved ? 'grafana_nav_item_unpinned' : 'grafana_nav_item_pinned';
        reportInteraction(interactionName, {
          path: url,
        });
        patchPreferences({
          patchPrefsCmd: {
            navbar: {
              bookmarkUrls: newItems,
            },
          },
        }).then((data) => {
          if (!data.error) {
            dispatch(setBookmark({ item: item, isSaved: !isSaved }));
          }
        });
      }
    };

    return (
      <div data-testid={selectors.components.NavMenu.Menu} ref={ref} {...restProps}>
        <MegaMenuHeader handleDockedMenu={handleDockedMenu} onClose={onClose} />
        {!hideNavItems && (
          <nav className={styles.content}>
            <ScrollContainer height="100%" overflowX="hidden" showScrollIndicators>
              <>
                <ul className={styles.itemList} aria-label={t('navigation.megamenu.list-label', 'Navigation')}>
                  {navItems.map((link) => (
                    <MegaMenuItem
                      key={link.text}
                      link={link}
                      isPinned={isPinned}
                      onClick={state.megaMenuDocked ? undefined : onClose}
                      activeItem={activeItem}
                      onPin={onPinItem}
                    />
                  ))}
                </ul>
                <MegaMenuExtensionPoint />
              </>
            </ScrollContainer>
          </nav>
        )}
        {state.megaMenuDocked && (
          <button
            type="button"
            aria-label={t('navigation.megamenu.resize', 'Resize menu')}
            className={styles.resizeHandle}
            onMouseDown={onResizeMouseDown}
            onKeyDown={onResizeKeyDown}
          />
        )}
      </div>
    );
  })
);

MegaMenu.displayName = 'MegaMenu';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    content: css({
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      flexGrow: 1,
      position: 'relative',
    }),
    mobileHeader: css({
      display: 'flex',
      justifyContent: 'space-between',
      padding: theme.spacing(1, 1, 1, 2),
      borderBottom: `1px solid ${theme.colors.border.weak}`,

      [theme.breakpoints.up('md')]: {
        display: 'none',
      },
    }),
    itemList: css({
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      listStyleType: 'none',
      padding: theme.spacing(1, 1, 2, 0.5),
      [theme.breakpoints.up('md')]: {
        width: '100%',
      },
    }),
    resizeHandle: css({
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      width: 6,
      padding: 0,
      border: 'none',
      background: 'transparent',
      cursor: 'col-resize',
      zIndex: 3,
      '&:hover': {
        background: theme.colors.primary.main,
      },
      '&:focus-visible': {
        outline: `2px solid ${theme.colors.primary.main}`,
        outlineOffset: '-2px',
      },
    }),
    dockMenuButton: css({
      display: 'none',
      position: 'relative',
      top: theme.spacing(1),

      [theme.breakpoints.up('xl')]: {
        display: 'inline-flex',
      },
    }),
  };
};
