import { css } from '@emotion/css';
import { DragDropContext, Draggable, type DraggableProvided, Droppable, type DropResult } from '@hello-pangea/dnd';
import { type DOMAttributes } from '@react-types/shared';
import { memo, forwardRef, useId } from 'react';

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

    // Renders a single nav row. The pinned Starred section reuses this (via `options`) so its child
    // icons, colours and loading state match the nav exactly — it only differs in a few visual tweaks
    // and an independent collapse-state key.
    const renderNavItem = (
      link: NavModelItem,
      key: string = link.text,
      draggableProvided?: DraggableProvided,
      options?: {
        tightLabelGap?: boolean;
        collapseEmptyControls?: boolean;
        expandKeyPrefix?: string;
        defaultExpanded?: boolean;
      }
    ) => (
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
        tightLabelGap={options?.tightLabelGap}
        collapseEmptyControls={options?.collapseEmptyControls}
        expandKeyPrefix={options?.expandKeyPrefix}
        defaultExpanded={options?.defaultExpanded}
        loadingChildren={link.id === 'starred' && starredItemsLoading}
        childrenLoadError={link.id === 'starred' && starredItemsError}
        disabled={isSaving}
      />
    );

    const navLabel = t('navigation.megamenu.list-label', 'Navigation');
    const pinnedListLabel = t('navigation.megamenu.pinned-list-label', 'Pinned');
    // The pinned list is named by its visible heading (aria-labelledby) rather than repeating the
    // label as an aria-label, so screen readers don't announce "Pinned" twice.
    const pinnedHeadingId = useId();
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

    const renderPinnedEntry = (entry: (typeof pinnedEntries)[number], draggableProvided?: DraggableProvided) =>
      // A whole-section pin (Starred) renders through the same MegaMenuItem the nav uses (via
      // renderNavItem) so its per-kind child icons, colours and loading state match the nav exactly.
      // The `pinned/` expand key keeps its collapse state independent of the nav copy, and the
      // tighter label gap + collapsed empty control slot line it up with the breadcrumb rows beside it.
      // Normal pins render as compact breadcrumbs.
      entry.section ? (
        renderNavItem(entry.section, entry.url, draggableProvided, {
          tightLabelGap: true,
          collapseEmptyControls: true,
          expandKeyPrefix: 'pinned/',
          defaultExpanded: true,
        })
      ) : (
        <MegaMenuPinnedItem
          key={entry.url}
          line={entry.line}
          activeItem={activeItem}
          editMode={editMode}
          onUnpin={() => onUnpin(entry.url)}
          onClick={state.megaMenuDocked ? undefined : onClose}
          draggableProvided={draggableProvided}
          disabled={isSaving}
        />
      );

    // Pinned box: a subtle grey box, with a "Pinned" heading, listing each pinned item as a compact
    // horizontal breadcrumb. Entries are drag-reorderable while editing.
    const renderPinnedBox = () =>
      pinnedEntries.length > 0 && (
        <>
          <div className={styles.pinnedBox}>
            <div className={styles.pinnedHeading} id={pinnedHeadingId}>
              <Icon className={styles.pinnedHeadingIcon} name="gf-pin-filled" size="md" />
              <Text variant="bodySmall" color="secondary" weight="medium">
                {pinnedListLabel}
              </Text>
            </div>
            {editMode ? (
              <DragDropContext onDragEnd={onPinnedDragEnd}>
                <Droppable droppableId="megamenu-pinned">
                  {(dropProvided) => (
                    <ul
                      className={styles.list}
                      aria-labelledby={pinnedHeadingId}
                      ref={dropProvided.innerRef}
                      {...dropProvided.droppableProps}
                    >
                      {pinnedEntries.map((entry, index) => (
                        <Draggable
                          key={entry.url}
                          draggableId={`pinned-${entry.url}`}
                          index={index}
                          isDragDisabled={isSaving}
                        >
                          {(dragProvided) => renderPinnedEntry(entry, dragProvided)}
                        </Draggable>
                      ))}
                      {dropProvided.placeholder}
                    </ul>
                  )}
                </Droppable>
              </DragDropContext>
            ) : (
              <ul className={styles.list} aria-labelledby={pinnedHeadingId}>
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
                  <Draggable
                    key={sectionKey(link)}
                    draggableId={sectionKey(link)}
                    index={index}
                    isDragDisabled={isSaving}
                  >
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
          {/* Hidden until preferences have loaded: entering edit mode early would start from an empty
              pinned list and pressing Done before the pins arrive would overwrite them with []. */}
          {canCustomise && !editMode && !isLoading && (
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
    // "Pinned" heading row — a small section label (the medium-weight secondary Text below reads as
    // a heading, distinct from the pinned item rows). The icon column matches the item rows so it
    // still lines up.
    pinnedHeading: css({
      alignItems: 'center',
      color: theme.colors.text.secondary,
      display: 'flex',
      gap: theme.spacing(0.5),
      height: theme.spacing(3.5),
      // Matches the item rows' label inset so the heading icon lines up with the pinned item icons.
      paddingLeft: theme.spacing(0.5),
    }),
    pinnedHeadingIcon: css({
      flexShrink: 0,
      width: theme.spacing(3),
    }),
    // Divider separating the pinned box from the rest of the nav, with a 16px gap above it.
    pinnedDivider: css({
      border: 'none',
      borderTop: `1px solid ${theme.colors.border.weak}`,
      margin: theme.spacing(2, 2, 0, 2),
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
