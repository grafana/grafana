import { css } from '@emotion/css';
import { type DOMAttributes } from '@react-types/shared';
import { memo, forwardRef, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { type GrafanaTheme2, type NavModelItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { ScrollContainer, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { buildNavIndex, getEffectivePinnedIds, isPinned as isItemPinned } from 'app/core/navigation';
import { useNavLayout } from 'app/core/navigation/useNavLayout';
import { contextSrv } from 'app/core/services/context_srv';
import { useSelector } from 'app/types/store';

import { MegaMenuExtensionPoint } from './MegaMenuExtensionPoint';
import { MegaMenuHeader } from './MegaMenuHeader';
import { MegaMenuPrimaryList } from './MegaMenuPrimaryList';
import { NavPersonaMenu } from './NavPersonaMenu';
import { ShowMoreSection } from './ShowMoreSection';
import { enrichWithInteractionTracking, getActiveItem } from './utils';

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
    const state = chrome.useState();
    const customizableMenu = config.featureToggles.customizableMegaMenu ?? true;

    const canonicalItems = useMemo(
      () =>
        navTree
          .filter((item) => item.id !== 'profile' && item.id !== 'help' && item.id !== 'bookmarks')
          .map((item) => enrichWithInteractionTracking(item, state.megaMenuDocked)),
      [navTree, state.megaMenuDocked]
    );

    const { projected, layout, onTogglePin, onReorder, onApplyPersona, onOverflowExpandedChange } = useNavLayout(
      navTree,
      location.pathname
    );

    const navIndex = useMemo(() => buildNavIndex(navTree), [navTree]);
    const pinnedSet = useMemo(() => getEffectivePinnedIds(layout, navIndex), [layout, navIndex]);

    const { primaryItems, overflowItems, expandedOverflow } = useMemo(() => {
      if (!customizableMenu) {
        return {
          primaryItems: canonicalItems,
          overflowItems: [] as NavModelItem[],
          expandedOverflow: false,
        };
      }
      return {
        primaryItems: projected.primary.map((item) => enrichWithInteractionTracking(item, state.megaMenuDocked)),
        overflowItems: projected.overflow.map((item) => enrichWithInteractionTracking(item, state.megaMenuDocked)),
        expandedOverflow: projected.expandedOverflow,
      };
    }, [customizableMenu, canonicalItems, projected, state.megaMenuDocked]);

    const activeItem = getActiveItem(
      customizableMenu ? [...primaryItems, ...overflowItems] : canonicalItems,
      state.sectionNav.node,
      location.pathname
    );

    const handleDockedMenu = () => {
      chrome.setMegaMenuDocked(!state.megaMenuDocked);
      if (state.megaMenuDocked) {
        chrome.setMegaMenuOpen(false);
      }
    };

    const isPinned = useCallback(
      (id?: string) => {
        if (!customizableMenu || !id) {
          return false;
        }
        return isItemPinned(id, pinnedSet);
      },
      [customizableMenu, pinnedSet]
    );

    const onPinItem = useCallback(
      (item: NavModelItem) => {
        if (item.id && customizableMenu) {
          onTogglePin(item.id);
        }
      },
      [customizableMenu, onTogglePin]
    );

    return (
      <div data-testid={selectors.components.NavMenu.Menu} ref={ref} {...restProps}>
        <MegaMenuHeader handleDockedMenu={handleDockedMenu} onClose={onClose} />
        <nav className={styles.content}>
          <ScrollContainer height="100%" overflowX="hidden" showScrollIndicators>
            <>
              {customizableMenu && contextSrv.isSignedIn && (
                <NavPersonaMenu currentPersonaId={layout.personaId} onApplyPersona={onApplyPersona} />
              )}
              <ul className={styles.itemList} aria-label={t('navigation.megamenu.list-label', 'Navigation')}>
                <MegaMenuPrimaryList
                  items={primaryItems}
                  isPinned={isPinned}
                  onClick={state.megaMenuDocked ? undefined : onClose}
                  activeItem={activeItem}
                  onPin={onPinItem}
                  onReorder={customizableMenu ? onReorder : undefined}
                  enableDragAndDrop={customizableMenu}
                />
                {customizableMenu && (
                  <ShowMoreSection
                    items={overflowItems}
                    activeItem={activeItem}
                    defaultExpanded={expandedOverflow}
                    isPinned={isPinned}
                    onPin={onPinItem}
                    onClick={state.megaMenuDocked ? undefined : onClose}
                    onExpandedChange={onOverflowExpandedChange}
                  />
                )}
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

const getStyles = (theme: GrafanaTheme2) => ({
  content: css({
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    position: 'relative',
    whiteSpace: 'nowrap',
    width: MENU_WIDTH,
  }),
  itemList: css({
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    listStyle: 'none',
    overflowX: 'hidden',
    overflowY: 'unset',
    padding: theme.spacing(1, 1, 0, 0.5),
    width: MENU_WIDTH,
    gap: theme.spacing(0.25),
  }),
});
