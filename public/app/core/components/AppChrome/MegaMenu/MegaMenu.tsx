import { css } from '@emotion/css';
import { DragDropContext, Draggable, type DraggableProvided, Droppable, type DropResult } from '@hello-pangea/dnd';
import { type DOMAttributes } from '@react-types/shared';
import { memo, forwardRef } from 'react';

import { type GrafanaTheme2, type NavModelItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { useFlagGrafanaVisualDesignRefresh } from '@grafana/runtime/internal';
import { Icon, IconButton, ScrollContainer, Text, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useSyncStarredItemsInNav } from 'app/features/stars/hooks';

import { MegaMenuCustomiseControls } from './MegaMenuCustomiseControls';
import { MegaMenuExtensionPoint } from './MegaMenuExtensionPoint';
import { MegaMenuHeader } from './MegaMenuHeader';
import { MegaMenuItem } from './MegaMenuItem';
import { MegaMenuSkeleton } from './MegaMenuSkeleton';
import { useNavCustomization } from './hooks';

export const MENU_WIDTH = '320px';

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
      onReorderSection,
      isSaving,
    } = useNavCustomization();

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
        onPin={onPinItem}
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

    const navLabel = t('navigation.megamenu.list-label', 'Navigation');
    const pinnedListLabel = t('navigation.megamenu.pinned-list-label', 'Pinned');
    const pinnedKey = (link: NavModelItem) => `pinned-${link.id ?? link.url}`;
    const sectionKey = (link: NavModelItem) => `section-${link.id ?? link.text}`;

    const onPinnedDragEnd = (result: DropResult) => {
      if (result.destination) {
        onReorderPinned(result.source.index, result.destination.index);
      }
    };
    const onSectionDragEnd = (result: DropResult) => {
      if (result.destination) {
        onReorderSection(result.source.index, result.destination.index);
      }
    };

    // Pinned box: a subtle grey box of pinned items as a mini tree, duplicated from the nav. The
    // top-level blocks are drag-reorderable while editing.
    const renderPinnedBox = () =>
      pinnedNavItems.length > 0 && (
        <>
          <div className={styles.pinnedBox}>
            {editMode ? (
              <DragDropContext onDragEnd={onPinnedDragEnd}>
                <Droppable droppableId="megamenu-pinned">
                  {(dropProvided) => (
                    <ul
                      className={styles.list}
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
              <ul className={styles.list} aria-label={pinnedListLabel}>
                {pinnedNavItems.map((link) => renderNavItem(link, pinnedKey(link), true))}
              </ul>
            )}
          </div>
          <hr className={styles.pinnedDivider} />
        </>
      );

    // Top-level nav sections, drag-reorderable while editing.
    const renderSectionList = () =>
      editMode ? (
        <DragDropContext onDragEnd={onSectionDragEnd}>
          <Droppable droppableId="megamenu-sections">
            {(dropProvided) => (
              <ul
                className={styles.itemList}
                aria-label={navLabel}
                ref={dropProvided.innerRef}
                {...dropProvided.droppableProps}
              >
                {navItems.map((link, index) => (
                  <Draggable key={sectionKey(link)} draggableId={sectionKey(link)} index={index}>
                    {(dragProvided) => renderNavItem(link, sectionKey(link), false, dragProvided)}
                  </Draggable>
                ))}
                {dropProvided.placeholder}
              </ul>
            )}
          </Droppable>
        </DragDropContext>
      ) : (
        <ul className={styles.itemList} aria-label={navLabel}>
          {navItems.map((link) => renderNavItem(link))}
        </ul>
      );

    return (
      <div data-testid={selectors.components.NavMenu.Menu} ref={ref} {...restProps}>
        <MegaMenuHeader handleDockedMenu={handleDockedMenu} onClose={onClose} />
        <nav className={styles.content}>
          <div className={styles.scrollArea}>
            <ScrollContainer height="100%" overflowX="hidden" showScrollIndicators={!visualRefreshEnabled}>
              <>
                {isLoading ? (
                  <ul className={styles.itemList} aria-label={navLabel} aria-busy>
                    <MegaMenuSkeleton />
                  </ul>
                ) : canCustomise ? (
                  <>
                    {renderPinnedBox()}
                    {renderSectionList()}
                  </>
                ) : (
                  <ul className={styles.itemList} aria-label={navLabel}>
                    {navItems.map((link) => renderNavItem(link))}
                  </ul>
                )}
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
    list: css({
      display: 'flex',
      flexDirection: 'column',
      listStyleType: 'none',
      padding: 0,
      margin: 0,
    }),
    // Subtle grey box around the pinned items.
    pinnedBox: css({
      backgroundColor: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      margin: theme.spacing(1.5, 1.5, 1, 1.5),
      padding: theme.spacing(1),
    }),
    // Divider separating the pinned box from the rest of the nav.
    pinnedDivider: css({
      border: 'none',
      borderTop: `1px solid ${theme.colors.border.weak}`,
      margin: theme.spacing(0, 2, 1, 2),
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
    // Edit-mode footer: feedback on the left, the Reset/Cancel/Done controls on the right.
    editFooter: css({
      alignItems: 'center',
      borderTop: `1px solid ${theme.colors.border.weak}`,
      display: 'flex',
      flexShrink: 0,
      justifyContent: 'space-between',
      padding: theme.spacing(1.5, 2),
    }),
  };
};
