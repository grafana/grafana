import { css } from '@emotion/css';
import { type DOMAttributes } from '@react-types/shared';
import { memo, forwardRef } from 'react';

import { type GrafanaTheme2, type NavModelItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { useFlagGrafanaVisualDesignRefresh } from '@grafana/runtime/internal';
import { Icon, ScrollContainer, Text, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useSyncStarredItemsInNav } from 'app/features/stars/hooks';

import { MegaMenuExtensionPoint } from './MegaMenuExtensionPoint';
import { MegaMenuHeader } from './MegaMenuHeader';
import { MegaMenuItem } from './MegaMenuItem';
import { MegaMenuSkeleton } from './MegaMenuSkeleton';
import { useNavCustomization } from './hooks';

export const MENU_WIDTH = '300px';

// id on the unpinned-items list so the collapse toggle can reference it via aria-controls.
const UNPINNED_ITEMS_ID = 'megamenu-unpinned-items';

export interface Props extends DOMAttributes {
  onClose: () => void;
}

export const MegaMenu = memo(
  forwardRef<HTMLDivElement, Props>(({ onClose, ...restProps }, ref) => {
    const styles = useStyles2(getStyles);
    const visualRefreshEnabled = useFlagGrafanaVisualDesignRefresh();
    const { chrome } = useGrafana();
    const state = chrome.useState();
    const { isLoading: starredItemsLoading, isError: starredItemsError } = useSyncStarredItemsInNav();

    const {
      canCustomise,
      isLoading,
      navItems,
      pinnedNavItems,
      activeItem,
      isPinned,
      onPinItem,
      unpinnedCollapsible,
      showUnpinnedItems,
      setUnpinnedExpanded,
    } = useNavCustomization();

    const handleDockedMenu = () => {
      chrome.setMegaMenuDocked(!state.megaMenuDocked);
      if (state.megaMenuDocked) {
        chrome.setMegaMenuOpen(false);
      }
    };

    const renderNavItem = (link: NavModelItem, key: string = link.text, pinned = false) => (
      <MegaMenuItem
        key={key}
        link={link}
        isPinned={pinned ? () => true : isPinned}
        onClick={state.megaMenuDocked ? undefined : onClose}
        activeItem={activeItem}
        // Pinned-area controls unpin (remove); normal-nav controls pin (add).
        onPin={(item) => onPinItem(item, pinned)}
        pinned={pinned}
        canCustomise={canCustomise}
        loadingChildren={link.id === 'starred' && starredItemsLoading}
        childrenLoadError={link.id === 'starred' && starredItemsError}
      />
    );

    // Pinned layout: the pinned block (if any), then the collapsible rest.
    const renderPinnedLayout = () => (
      <>
        {pinnedNavItems.length > 0 && (
          <>
            <li>
              <ul className={styles.pinnedList} aria-label={t('navigation.megamenu.pinned-list-label', 'Pinned')}>
                {pinnedNavItems.map((link) => renderNavItem(link, `pinned-${link.id ?? link.url}`, true))}
              </ul>
            </li>
            {showUnpinnedItems && <li className={styles.divider} aria-hidden="true" />}
          </>
        )}
        {showUnpinnedItems && (
          <li>
            <ul id={UNPINNED_ITEMS_ID} className={styles.pinnedList}>
              {navItems.map((link) => renderNavItem(link))}
            </ul>
          </li>
        )}
      </>
    );

    return (
      <div data-testid={selectors.components.NavMenu.Menu} ref={ref} {...restProps}>
        <MegaMenuHeader handleDockedMenu={handleDockedMenu} onClose={onClose} />
        <nav className={styles.content}>
          <div className={styles.scrollArea}>
            <ScrollContainer height="100%" overflowX="hidden" showScrollIndicators={!visualRefreshEnabled}>
              <>
                <ul
                  className={styles.itemList}
                  aria-label={t('navigation.megamenu.list-label', 'Navigation')}
                  aria-busy={isLoading || undefined}
                >
                  {isLoading ? (
                    <MegaMenuSkeleton />
                  ) : canCustomise ? (
                    renderPinnedLayout()
                  ) : (
                    navItems.map((link) => renderNavItem(link))
                  )}
                </ul>
                <MegaMenuExtensionPoint />
              </>
            </ScrollContainer>
          </div>
          {unpinnedCollapsible && (
            <button
              type="button"
              className={styles.unpinnedToggle}
              onClick={() => setUnpinnedExpanded(!showUnpinnedItems)}
              aria-expanded={showUnpinnedItems}
              aria-controls={UNPINNED_ITEMS_ID}
            >
              <Icon name={showUnpinnedItems ? 'angle-up' : 'angle-down'} size="lg" />
              <Text color="secondary">
                {showUnpinnedItems
                  ? t('navigation.megamenu.hide-unpinned-items', 'Hide unpinned items')
                  : t('navigation.megamenu.show-unpinned-items', 'Show unpinned items')}
              </Text>
            </button>
          )}
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
    scrollArea: css({
      flex: 1,
      minHeight: 0,
    }),
    itemList: css({
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      listStyleType: 'none',
      padding: theme.spacing(1, 1, 2, 0.5),
      [theme.breakpoints.up('md')]: {
        width: MENU_WIDTH,
      },
    }),
    divider: css({
      listStyleType: 'none',
      borderTop: `1px solid ${theme.colors.border.weak}`,
      margin: theme.spacing(1, 1, 1, 0.5),
    }),
    pinnedList: css({
      display: 'flex',
      flexDirection: 'column',
      listStyleType: 'none',
      padding: 0,
      margin: 0,
    }),
    // Pinned to the bottom of the menu as a footer, with a divider separating it from the list.
    unpinnedToggle: css({
      alignItems: 'center',
      background: 'none',
      border: 'none',
      borderTop: `1px solid ${theme.colors.border.weak}`,
      cursor: 'pointer',
      display: 'flex',
      flexShrink: 0,
      gap: theme.spacing(1),
      padding: theme.spacing(1.5, 2),
      width: '100%',
      '&:hover': {
        background: theme.colors.action.hover,
      },
      '&:focus-visible': {
        outline: `2px solid ${theme.colors.primary.main}`,
        outlineOffset: '-2px',
      },
    }),
  };
};
