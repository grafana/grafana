import { css } from '@emotion/css';
import { DragDropContext, Draggable, type DraggableProvided, Droppable, type DropResult } from '@hello-pangea/dnd';
import { type DOMAttributes } from '@react-types/shared';
import { memo, forwardRef } from 'react';

import { type GrafanaTheme2, type NavModelItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { useFlagGrafanaVisualDesignRefresh } from '@grafana/runtime/internal';
import { Icon, ScrollContainer, Text, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useSyncStarredItemsInNav } from 'app/features/stars/hooks';

import { MegaMenuCustomiseControls } from './MegaMenuCustomiseControls';
import { MegaMenuExtensionPoint } from './MegaMenuExtensionPoint';
import { MegaMenuHeader } from './MegaMenuHeader';
import { MegaMenuItem } from './MegaMenuItem';
import { MegaMenuPinnedItem } from './MegaMenuPinnedItem';
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
      pinnedEntries,
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

    const renderNavItem = (link: NavModelItem, key: string = link.text, draggableProvided?: DraggableProvided) => (
      <MegaMenuItem
        key={key}
        link={link}
        isPinned={isPinned}
        onClick={state.megaMenuDocked ? undefined : onClose}
        activeItem={activeItem}
        onPin={onPinItem}
        editMode={editMode}
        isHideable={isHideable}
        isHidden={isHidden}
        onToggleHidden={onToggleHidden}
        ancestorHidden={false}
        canCustomise={canCustomise}
        draggableProvided={draggableProvided}
        loadingChildren={link.id === 'starred' && starredItemsLoading}
        childrenLoadError={link.id === 'starred' && starredItemsError}
      />
    );

    const navLabel = t('navigation.megamenu.list-label', 'Navigation');
    const pinnedListLabel = t('navigation.megamenu.pinned-list-label', 'Pinned');
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

    // Unpin a pinned entry by toggling its url off (only the url is used when customisation is on).
    const onUnpin = (url: string) => onPinItem({ text: '', url });

    const renderPinnedEntry = (entry: (typeof pinnedEntries)[number], draggableProvided?: DraggableProvided) => (
      <MegaMenuPinnedItem
        key={entry.url}
        entry={entry}
        activeItem={activeItem}
        editMode={editMode}
        onUnpin={() => onUnpin(entry.url)}
        onClick={state.megaMenuDocked ? undefined : onClose}
        draggableProvided={draggableProvided}
      />
    );

    // Pinned box: a subtle grey box, with a "Pinned" heading, listing each pinned item as a compact
    // horizontal breadcrumb. Entries are drag-reorderable while editing.
    const renderPinnedBox = () =>
      pinnedEntries.length > 0 && (
        <>
          <div className={styles.pinnedBox}>
            <div className={styles.pinnedHeading}>
              <Icon className={styles.pinnedHeadingIcon} name="gf-pin" size="lg" />
              <Text color="secondary" weight="medium">
                {pinnedListLabel}
              </Text>
            </div>
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
                      {pinnedEntries.map((entry, index) => (
                        <Draggable key={entry.url} draggableId={`pinned-${entry.url}`} index={index}>
                          {(dragProvided) => renderPinnedEntry(entry, dragProvided)}
                        </Draggable>
                      ))}
                      {dropProvided.placeholder}
                    </ul>
                  )}
                </Droppable>
              </DragDropContext>
            ) : (
              <ul className={styles.list} aria-label={pinnedListLabel}>
                {pinnedEntries.map((entry) => renderPinnedEntry(entry))}
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
                    {(dragProvided) => renderNavItem(link, sectionKey(link), dragProvided)}
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
              <Text color="secondary">{t('navigation.megamenu.customise', 'Customise navigation')}</Text>
            </button>
          )}
          {editMode && (
            <div className={styles.editFooter}>
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
      // Left padding is tuned so the nav row icons line up with the pinned box's content (which is
      // inset by the box margin + its own padding).
      padding: theme.spacing(1, 1, 2, 1.5),
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
    // Subtle grey box around the pinned items. Left inset (margin-left + padding-left = 1.5) matches
    // the nav row icon inset (itemList padding-left 1 + label padding-left 0.5) so the breadcrumb leaf
    // icons line up with the nav section icons. No bottom margin — the divider owns the gap below.
    pinnedBox: css({
      backgroundColor: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      margin: theme.spacing(1, 1, 0, 1),
      padding: theme.spacing(1),
    }),
    // "Pinned" heading row (pin icon + label). The icon uses the same column/size as the item rows'
    // leading icons so the heading lines up with the pinned items beneath it.
    pinnedHeading: css({
      alignItems: 'center',
      color: theme.colors.text.secondary,
      display: 'flex',
      gap: theme.spacing(0.5),
      height: theme.spacing(4),
    }),
    pinnedHeadingIcon: css({
      flexShrink: 0,
      width: theme.spacing(3),
    }),
    // Divider separating the pinned box from the rest of the nav. Its top margin matches the nav
    // list's top padding so the line sits with equal spacing above and below.
    pinnedDivider: css({
      border: 'none',
      borderTop: `1px solid ${theme.colors.border.weak}`,
      margin: theme.spacing(1, 2, 0, 2),
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
    // Edit-mode footer: the Reset/Cancel/Done controls, right-aligned.
    editFooter: css({
      alignItems: 'center',
      borderTop: `1px solid ${theme.colors.border.weak}`,
      display: 'flex',
      flexShrink: 0,
      justifyContent: 'flex-end',
      padding: theme.spacing(1.5, 2),
    }),
  };
};
