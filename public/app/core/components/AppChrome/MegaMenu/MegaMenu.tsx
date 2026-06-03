import { css } from '@emotion/css';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { type DOMAttributes } from '@react-types/shared';
import { memo, forwardRef, useCallback, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';
import { useLocalStorage } from 'react-use';

import { type GrafanaTheme2, type NavModelItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { config, reportInteraction } from '@grafana/runtime';
import { ScrollContainer, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { buildNavIndex, getEffectivePinnedIds, isPinned as isItemPinned } from 'app/core/navigation';
import { useNavLayout } from 'app/core/navigation/useNavLayout';
import { useSelector } from 'app/types/store';

import { MegaMenuExtensionPoint } from './MegaMenuExtensionPoint';
import { MegaMenuHeader } from './MegaMenuHeader';
import { MegaMenuItem } from './MegaMenuItem';
import { NavDropCelebration } from './NavDropCelebration';
import { ShowMoreSection } from './ShowMoreSection';
import {
  applySectionOrder,
  enrichWithInteractionTracking,
  getActiveItem,
  getSectionId,
  SECTION_ORDER_STORAGE_KEY,
} from './utils';

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
    const [sectionOrder, setSectionOrder] = useLocalStorage<string[]>(SECTION_ORDER_STORAGE_KEY, []);
    const navRef = useRef<HTMLElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const [celebration, setCelebration] = useState<{ top: number; key: number } | null>(null);

    const canonicalItems = useMemo(
      () =>
        navTree
          .filter((item) => item.id !== 'profile' && item.id !== 'help' && item.id !== 'bookmarks')
          .map((item) => enrichWithInteractionTracking(item, state.megaMenuDocked)),
      [navTree, state.megaMenuDocked]
    );

    const { projected, layout, onTogglePin, onOverflowExpandedChange } = useNavLayout(navTree, location.pathname);

    const navIndex = useMemo(() => buildNavIndex(navTree), [navTree]);
    const pinnedSet = useMemo(() => getEffectivePinnedIds(layout, navIndex), [layout, navIndex]);

    const { primaryItems, overflowItems, expandedOverflow } = useMemo<{
      primaryItems: NavModelItem[];
      overflowItems: NavModelItem[];
      expandedOverflow: boolean;
    }>(() => {
      if (!customizableMenu) {
        return {
          primaryItems: canonicalItems,
          overflowItems: [],
          expandedOverflow: false,
        };
      }
      return {
        primaryItems: projected.primary.map((item) => enrichWithInteractionTracking(item, state.megaMenuDocked)),
        overflowItems: projected.overflow.map((item) => enrichWithInteractionTracking(item, state.megaMenuDocked)),
        expandedOverflow: projected.expandedOverflow,
      };
    }, [customizableMenu, canonicalItems, projected, state.megaMenuDocked]);

    // user-defined section order is persisted to local storage and applied on top of the projected list
    const orderedPrimaryItems = useMemo(
      () => applySectionOrder(primaryItems, sectionOrder ?? []),
      [primaryItems, sectionOrder]
    );

    const activeItem = getActiveItem(
      customizableMenu ? [...orderedPrimaryItems, ...overflowItems] : orderedPrimaryItems,
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

    const clearCelebration = useCallback(() => setCelebration(null), []);

    const showCelebrationAtElement = useCallback((element: HTMLElement | null | undefined) => {
      const navEl = navRef.current;
      if (!navEl || !element) {
        setCelebration((prev) => ({ top: 48, key: (prev?.key ?? 0) + 1 }));
        return;
      }
      const navRect = navEl.getBoundingClientRect();
      const rowRect = element.getBoundingClientRect();
      setCelebration((prev) => ({
        top: rowRect.top - navRect.top + rowRect.height / 2,
        key: (prev?.key ?? 0) + 1,
      }));
    }, []);

    const showCelebrationForNavId = useCallback(
      (navId: string) => {
        const row = navRef.current?.querySelector(`[data-nav-item-id="${CSS.escape(navId)}"]`);
        showCelebrationAtElement(row as HTMLElement | null);
      },
      [showCelebrationAtElement]
    );

    const showCelebrationAtIndex = useCallback(
      (destinationIndex: number) => {
        const listEl = listRef.current;
        if (!listEl) {
          showCelebrationAtElement(null);
          return;
        }
        const sectionRows = Array.from(listEl.children).filter((child) => child.tagName === 'LI');
        showCelebrationAtElement(sectionRows[destinationIndex] as HTMLElement | undefined);
      },
      [showCelebrationAtElement]
    );

    const onPinItem = useCallback(
      (item: NavModelItem) => {
        if (item.id && customizableMenu) {
          onTogglePin(item.id);
          showCelebrationForNavId(item.id);
        }
      },
      [customizableMenu, onTogglePin, showCelebrationForNavId]
    );

    const onDragEnd = (result: DropResult) => {
      const { source, destination } = result;
      if (!destination || destination.index === source.index) {
        return;
      }
      const newOrder = orderedPrimaryItems.map(getSectionId);
      const [moved] = newOrder.splice(source.index, 1);
      newOrder.splice(destination.index, 0, moved);
      setSectionOrder(newOrder);
      showCelebrationAtIndex(destination.index);
      reportInteraction('grafana_navigation_sections_reordered', {
        itemId: moved,
        fromIndex: source.index,
        toIndex: destination.index,
      });
    };

    return (
      <div data-testid={selectors.components.NavMenu.Menu} ref={ref} {...restProps}>
        <MegaMenuHeader handleDockedMenu={handleDockedMenu} onClose={onClose} />
        <nav ref={navRef} className={styles.content}>
          {celebration !== null && (
            <NavDropCelebration
              key={celebration.key}
              top={celebration.top}
              onComplete={clearCelebration}
            />
          )}
          <ScrollContainer height="100%" overflowX="hidden" showScrollIndicators>
            <>
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="mega-menu-sections" direction="vertical">
                  {(droppableProvided) => (
                    <ul
                      className={styles.itemList}
                      aria-label={t('navigation.megamenu.list-label', 'Navigation')}
                      ref={(element) => {
                        listRef.current = element;
                        droppableProvided.innerRef(element);
                      }}
                      {...droppableProvided.droppableProps}
                    >
                      {orderedPrimaryItems.map((link, index) => (
                        <Draggable
                          key={getSectionId(link)}
                          draggableId={getSectionId(link)}
                          index={index}
                          disableInteractiveElementBlocking
                        >
                          {(draggableProvided, snapshot) => (
                            <MegaMenuItem
                              link={link}
                              isPinned={isPinned}
                              onClick={state.megaMenuDocked ? undefined : onClose}
                              activeItem={activeItem}
                              onPin={onPinItem}
                              draggableProvided={draggableProvided}
                              isDragging={snapshot.isDragging}
                            />
                          )}
                        </Draggable>
                      ))}
                      {droppableProvided.placeholder}
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
                  )}
                </Droppable>
              </DragDropContext>
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
    overflow: 'visible',
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
