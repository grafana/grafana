import { css } from '@emotion/css';
import { DragDropContext, Draggable, type DraggableProvided, Droppable, type DropResult } from '@hello-pangea/dnd';
import { type DOMAttributes } from '@react-types/shared';
import { memo, forwardRef } from 'react';

import { type GrafanaTheme2, type NavModelItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { useFlagGrafanaVisualDesignRefresh } from '@grafana/runtime/internal';
import { Icon, IconButton, ScrollContainer, Switch, Text, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useSyncStarredItemsInNav } from 'app/features/stars/hooks';

import { MegaMenuCustomiseControls } from './MegaMenuCustomiseControls';
import { MegaMenuExtensionPoint } from './MegaMenuExtensionPoint';
import { MegaMenuHeader } from './MegaMenuHeader';
import { MegaMenuItem } from './MegaMenuItem';
import { MegaMenuSkeleton } from './MegaMenuSkeleton';
import { useNavCustomization } from './hooks';

export const MENU_WIDTH = '300px';

// id on the unpinned-items list so the collapse toggle can reference it via aria-controls.
const UNPINNED_ITEMS_ID = 'megamenu-unpinned-items';
// id linking the "only show pinned items" switch to its label.
const ONLY_PINNED_ID = 'megamenu-only-pinned';

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
      isHideable,
      isHidden,
      onToggleHidden,
      editMode,
      canReset,
      onEnterEditMode,
      onCancelEdit,
      onSaveEdit,
      onResetToDefault,
      onReorderPinned,
      isSaving,
      unpinnedCollapsible,
      showUnpinnedItems,
      setUnpinnedExpanded,
      onlyShowPinned,
      onToggleOnlyShowPinned,
    } = useNavCustomization();

    const onPinnedDragEnd = (result: DropResult) => {
      if (result.destination) {
        onReorderPinned(result.source.index, result.destination.index);
      }
    };

    const handleDockedMenu = () => {
      chrome.setMegaMenuDocked(!state.megaMenuDocked);
      if (state.megaMenuDocked) {
        chrome.setMegaMenuOpen(false);
      }
    };

    const renderNavItem = (
      link: NavModelItem,
      key: string = link.text,
      pinned = false,
      draggableProvided?: DraggableProvided
    ) => (
      <MegaMenuItem
        key={key}
        link={link}
        isPinned={pinned ? () => true : isPinned}
        onClick={state.megaMenuDocked ? undefined : onClose}
        activeItem={activeItem}
        // Pinned-area controls unpin (remove); normal-nav controls pin (add).
        onPin={(item) => onPinItem(item, pinned)}
        editMode={editMode}
        isHideable={isHideable}
        isHidden={isHidden}
        onToggleHidden={onToggleHidden}
        ancestorHidden={false}
        pinned={pinned}
        canCustomise={canCustomise}
        draggableProvided={draggableProvided}
        loadingChildren={link.id === 'starred' && starredItemsLoading}
        childrenLoadError={link.id === 'starred' && starredItemsError}
      />
    );

    const pinnedListLabel = t('navigation.megamenu.pinned-list-label', 'Pinned');
    const pinnedKey = (link: NavModelItem) => `pinned-${link.id ?? link.url}`;

    // Customised layout: the pinned block (if any), then the collapsible rest. While editing, the
    // pinned block is drag-and-drop reorderable (top-level blocks only).
    const renderCustomisableItems = () => (
      <>
        {pinnedNavItems.length > 0 && (
          <>
            <li>
              {editMode ? (
                <DragDropContext onDragEnd={onPinnedDragEnd}>
                  <Droppable droppableId="megamenu-pinned">
                    {(dropProvided) => (
                      <ul
                        className={styles.pinnedList}
                        aria-label={pinnedListLabel}
                        ref={dropProvided.innerRef}
                        {...dropProvided.droppableProps}
                      >
                        {pinnedNavItems.map((link, index) => (
                          <Draggable key={pinnedKey(link)} draggableId={pinnedKey(link)} index={index}>
                            {(dragProvided) => renderNavItem(link, pinnedKey(link), true, dragProvided)}
                          </Draggable>
                        ))}
                        {dropProvided.placeholder}
                      </ul>
                    )}
                  </Droppable>
                </DragDropContext>
              ) : (
                <ul className={styles.pinnedList} aria-label={pinnedListLabel}>
                  {pinnedNavItems.map((link) => renderNavItem(link, pinnedKey(link), true))}
                </ul>
              )}
            </li>
            {(unpinnedCollapsible || showUnpinnedItems) && <li className={styles.divider} aria-hidden="true" />}
          </>
        )}
        {/* Collapse toggle sits at the top of the unpinned list, below the pinned divider. */}
        {unpinnedCollapsible && (
          <li>
            <button
              type="button"
              className={styles.unpinnedToggle}
              onClick={() => setUnpinnedExpanded(!showUnpinnedItems)}
              aria-expanded={showUnpinnedItems}
              aria-controls={UNPINNED_ITEMS_ID}
            >
              <Icon name={showUnpinnedItems ? 'angle-up' : 'angle-down'} size="lg" />
              <Text color="secondary">{t('navigation.megamenu.all-items', 'All items')}</Text>
            </button>
          </li>
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
                    renderCustomisableItems()
                  ) : (
                    navItems.map((link) => renderNavItem(link))
                  )}
                </ul>
                <MegaMenuExtensionPoint />
              </>
            </ScrollContainer>
          </div>
          {canCustomise && !editMode && (
            <button type="button" className={styles.customiseButton} onClick={onEnterEditMode}>
              <Icon name="sliders-v-alt" size="lg" />
              <Text color="secondary">{t('navigation.megamenu.customise', 'Customise menu')}</Text>
            </button>
          )}
          {editMode && (
            <div className={styles.editFooter}>
              {/* Always shown while editing, but disabled until something is pinned (with nothing
                  pinned it would hide the whole menu). */}
              <div className={styles.onlyPinnedRow}>
                <label htmlFor={ONLY_PINNED_ID}>
                  <Text color="secondary">{t('navigation.megamenu.only-pinned', 'Only show pinned items')}</Text>
                </label>
                <Switch
                  id={ONLY_PINNED_ID}
                  value={onlyShowPinned}
                  onChange={onToggleOnlyShowPinned}
                  disabled={pinnedNavItems.length === 0}
                />
              </div>
              <div className={styles.controlsRow}>
                {/* Feedback placeholder — not wired up yet. */}
                <IconButton
                  name="comment-alt-message"
                  tooltip={t('navigation.megamenu.feedback', 'Feedback')}
                  variant="secondary"
                />
                <MegaMenuCustomiseControls
                  canReset={canReset}
                  onResetToDefault={onResetToDefault}
                  onCancelEdit={onCancelEdit}
                  onSaveEdit={onSaveEdit}
                  saving={isSaving}
                />
              </div>
            </div>
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
    // Collapse toggle at the top of the unpinned list (below the pinned divider).
    unpinnedToggle: css({
      alignItems: 'center',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      display: 'flex',
      flexShrink: 0,
      gap: theme.spacing(1),
      padding: theme.spacing(1, 2),
      width: '100%',
      '&:hover': {
        background: theme.colors.action.hover,
      },
      '&:focus-visible': {
        outline: `2px solid ${theme.colors.primary.main}`,
        outlineOffset: '-2px',
      },
    }),
    // Customise entry point, pinned to the bottom of the menu as a footer button.
    customiseButton: css({
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
    // Footer holding the edit-mode controls (feedback, then the only-show-pinned switch) — distinct
    // from the full-width nav rows above it.
    editFooter: css({
      borderTop: `1px solid ${theme.colors.border.weak}`,
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      gap: theme.spacing(1.5),
      padding: theme.spacing(1.5, 2),
    }),
    // Feedback on the left, the Reset/Cancel/Done controls on the right, on one line.
    controlsRow: css({
      alignItems: 'center',
      display: 'flex',
      justifyContent: 'space-between',
    }),
    onlyPinnedRow: css({
      alignItems: 'center',
      display: 'flex',
      gap: theme.spacing(1),
      justifyContent: 'space-between',
    }),
  };
};
