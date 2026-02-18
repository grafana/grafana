import { css } from '@emotion/css';
import { DOMAttributes } from '@react-types/shared';
import { memo, forwardRef, useCallback, useState } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { usePatchUserPreferencesMutation } from '@grafana/api-clients/rtkq/legacy/preferences';
import { OpenAssistantButton, useAssistant } from '@grafana/assistant';
import { GrafanaTheme2, NavModelItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { ScrollContainer, useStyles2, Box, EmptyState } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { setBookmark } from 'app/core/reducers/navBarTree';
import { useDispatch, useSelector } from 'app/types/store';

import { MegaMenuControls } from './MegaMenuControls';
import { MegaMenuExtensionPoint } from './MegaMenuExtensionPoint';
import { MegaMenuHeader } from './MegaMenuHeader';
import { MegaMenuItem } from './MegaMenuItem';
import { usePinnedItems } from './hooks';
import { enrichWithInteractionTracking, findByUrl, getActiveItem } from './utils';

export const MENU_WIDTH = '300px';

export interface Props extends DOMAttributes {
  onClose: () => void;
}

export const MegaMenu = memo(
  forwardRef<HTMLDivElement, Props>(({ onClose, ...restProps }, ref) => {
    const rawNavTree = useSelector((state) => state.navBarTree);
    const styles = useStyles2(getStyles);
    const location = useLocation();
    const { chrome } = useGrafana();
    const dispatch = useDispatch();
    const state = chrome.useState();
    const [patchPreferences] = usePatchUserPreferencesMutation();
    const pinnedItems = usePinnedItems();
    const { isAvailable: isAssistantAvailable } = useAssistant();

    const [navTree, setFilteredNavTree] = useState<NavModelItem[]>(rawNavTree);
    const [menuFilterValue, setMenuFilterValue] = useState<string>('');

    // Remove profile + help from tree
    const navItems = navTree
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

    const handleDockedMenu = () => {
      chrome.setMegaMenuDocked(!state.megaMenuDocked);
      if (state.megaMenuDocked) {
        chrome.setMegaMenuOpen(false);
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

    const navItemHasMatch = (item: NavModelItem, filter: string): boolean => {
      return (
        item.text.toLowerCase().includes(filter.toLowerCase()) ||
        Boolean(item.children?.some((child) => navItemHasMatch(child, filter)))
      );
    };

    /**
     * Filter mega menu items based on filter from MegaMenuControls
     */
    const onFilterChange = (filterValue: string) => {
      setMenuFilterValue(filterValue);

      const initial: NavModelItem[] = [];
      const filteredNavTree = rawNavTree.reduce((acc, item) => {
        const thisItemHasMatches = navItemHasMatch(item, filterValue);
        if (!thisItemHasMatches) {
          return acc;
        }
        const filteredItem = {
          ...item,
          children: item.children?.filter((child) => navItemHasMatch(child, filterValue)),
        };
        acc.push(filteredItem);
        return acc;
      }, initial);
      setFilteredNavTree(filteredNavTree);
    };

    return (
      <div data-testid={selectors.components.NavMenu.Menu} ref={ref} {...restProps}>
        <MegaMenuHeader handleDockedMenu={handleDockedMenu} onClose={onClose} />
        <MegaMenuControls onFilterChange={onFilterChange} />

        <nav className={styles.content}>
          <ScrollContainer height="100%" overflowX="hidden" showScrollIndicators>
            <>
              <ul className={styles.itemList} aria-label={t('navigation.megamenu.list-label', 'Navigation')}>
                {navItems.length === 0 && (
                  <Box padding={1}>
                    <EmptyState
                      variant="not-found"
                      role="alert"
                      message={t('command-palette.empty-state.message', 'No results found')}
                    >
                      {isAssistantAvailable && (
                        <OpenAssistantButton
                          origin="grafana/command-palette-empty-state"
                          prompt={`Search for ${menuFilterValue}`}
                          title={t('command-palette.empty-state.button-title', 'Search with Grafana Assistant')}
                          onClick={() => setMenuFilterValue('')}
                        />
                      )}
                    </EmptyState>
                  </Box>
                )}
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
      padding: theme.spacing(0, 1, 2, 0.5),
      [theme.breakpoints.up('md')]: {
        width: MENU_WIDTH,
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
