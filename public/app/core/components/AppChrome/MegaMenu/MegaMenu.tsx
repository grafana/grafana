import { css, cx } from '@emotion/css';
import { type DraggableProvided, type DropResult } from '@hello-pangea/dnd';
import { type DOMAttributes } from '@react-types/shared';
import { memo, forwardRef, useId } from 'react';

import { type GrafanaTheme2, type NavModelItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import {
  useFlagGrafanaMegaMenuPeekAndDock,
  useFlagGrafanaMegaMenuProfile,
  useFlagGrafanaScopesDashboardsMegaMenu,
  useFlagGrafanaVisualDesignRefresh,
} from '@grafana/runtime/internal';
import { ErrorBoundaryAlert, ScrollContainer, Text, useStyles2, Button, IconButton } from '@grafana/ui';
import { useDragAndDrop } from '@grafana/ui/internal';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { ScopesDashboardsMegaMenuSection } from 'app/features/scopes/dashboards/ScopesDashboardsMegaMenuSection';
import { useSelector } from 'app/types/store';

import { MegaMenuCustomiseControls } from './MegaMenuCustomiseControls';
import { MegaMenuExtensionPoint } from './MegaMenuExtensionPoint';
import { DOCK_MENU_BUTTON_ID, MegaMenuHeader } from './MegaMenuHeader';
import { MegaMenuItem } from './MegaMenuItem';
import { MegaMenuPinnedItem } from './MegaMenuPinnedItem';
import { MegaMenuProfile } from './MegaMenuProfile';
import { useMegaMenuSectionExtension } from './MegaMenuSectionExtensionPoint';
import { MegaMenuSkeleton } from './MegaMenuSkeleton';
import { useNavCustomization } from './hooks';
import { useMegaMenuSectionCollapsed, useMegaMenuSectionSplitter } from './useMegaMenuSectionSplitter';

export const MENU_WIDTH = '320px';

export interface Props extends DOMAttributes {
  onClose: () => void;
}

export const MegaMenu = memo(
  forwardRef<HTMLDivElement, Props>(({ onClose, ...restProps }, ref) => {
    const visualRefreshEnabled = useFlagGrafanaVisualDesignRefresh();
    const scopesMegaMenuEnabled = useFlagGrafanaScopesDashboardsMegaMenu();
    const styles = useStyles2(getStyles, visualRefreshEnabled);
    const { chrome } = useGrafana();
    const state = chrome.useState();
    const {
      canCustomise,
      isLoading,
      navItems,
      starredItemsLoading,
      starredItemsError,
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
    const { DragDropContext, Draggable, Droppable } = useDragAndDrop(editMode);
    const [sectionCollapsed, setSectionCollapsed] = useMegaMenuSectionCollapsed();
    const pluginSection = useMegaMenuSectionExtension({
      onNavigate: state.megaMenuDocked ? undefined : onClose,
      collapsed: sectionCollapsed,
      onCollapsedChange: setSectionCollapsed,
    });
    // Customising the navigation gives it the whole menu.
    const section = editMode ? null : pluginSection;
    const { containerProps, navProps, separatorProps, sectionProps } = useMegaMenuSectionSplitter(
      section !== null,
      sectionCollapsed
    );

    const peekAndDock = useFlagGrafanaMegaMenuPeekAndDock();
    // Only a signed-in user has a profile; anonymous users sign in from the top bar.
    const profileNode = useSelector((store) => store.navIndex['profile']);
    const showProfile = useFlagGrafanaMegaMenuProfile() && profileNode !== undefined;
    const showFooter = editMode || (canCustomise && !isLoading) || !peekAndDock;

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
    const pinnedListLabel = t('navigation.megamenu.pinned-list-label', 'Pinned items');
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

    // Scoped-dashboards section: rendered in both the canCustomise true/false branches below, since
    // canCustomise depends on an unrelated flag + sign-in state and shouldn't gate whether a user
    // with scopes enabled sees their suggested dashboards. Wrapped in its own error boundary so a
    // render error in the suggested-dashboards tree doesn't take down the whole menu, matching how
    // the docked drawer it replaces isolates ScopesDashboards in AppChrome.tsx.
    const renderScopesDashboardsSection = () =>
      scopesMegaMenuEnabled && (
        <ErrorBoundaryAlert boundaryName="scopes-dashboards-mega-menu">
          <ScopesDashboardsMegaMenuSection onNavigate={state.megaMenuDocked ? undefined : onClose} />
        </ErrorBoundaryAlert>
      );

    // Pinned box: a subtle grey box, with a "Pinned" heading, listing each pinned item as a compact
    // horizontal breadcrumb. Entries are drag-reorderable while editing.
    const renderPinnedBox = () =>
      pinnedEntries.length > 0 && (
        <>
          <div className={styles.pinnedBox}>
            <div className={styles.pinnedHeading} id={pinnedHeadingId}>
              <Text variant="bodySmall" color="secondary" weight="medium">
                {pinnedListLabel}
              </Text>
              <div className={styles.pinnedHeadingLine} />
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
          <hr className={styles.dividerLine} />
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
        <nav className={cx(styles.content, state.megaMenuDocked && styles.contentDocked)} aria-label={navLabel}>
          <div {...containerProps}>
            <div {...navProps}>
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
                        {renderScopesDashboardsSection()}
                        {renderSectionList()}
                      </>
                    ) : (
                      <>
                        {renderScopesDashboardsSection()}
                        <ul className={styles.itemList} aria-label={navLabel}>
                          {navItems.map((link) => renderNavItem(link))}
                        </ul>
                      </>
                    )}
                    <MegaMenuExtensionPoint />
                  </>
                </ScrollContainer>
              </div>
            </div>
            {section && (
              <>
                {sectionCollapsed ? (
                  <hr className={styles.sectionDivider} />
                ) : (
                  <div {...separatorProps} className={cx(separatorProps.className, styles.sectionSeparator)} />
                )}
                <div {...sectionProps} data-testid="mega-menu-section">
                  {section}
                </div>
              </>
            )}
          </div>
          {showProfile && (
            <>
              <hr className={styles.sectionDivider} />
              <div className={styles.profile}>
                <MegaMenuProfile profileNode={profileNode} />
              </div>
            </>
          )}
          {/* Below the profile, a line sets the footer's buttons apart from it. */}
          {showFooter && <hr className={showProfile ? styles.sectionDivider : styles.dividerLine} />}
          {showFooter && (
            <div className={cx(styles.footer, editMode && styles.footerEditMode)}>
              {editMode && (
                <MegaMenuCustomiseControls
                  canReset={canReset}
                  onResetToDefault={onResetToDefault}
                  onCancelEdit={onCancelEdit}
                  onSaveEdit={onSaveEdit}
                  saving={isSaving}
                />
              )}
              {!editMode && canCustomise && !isLoading && (
                <Button variant="secondary" onClick={onEnterEditMode} size="sm" icon="sliders-v-alt">
                  <Trans i18nKey="navigation.megamenu.customise">Customise navigation</Trans>
                </Button>
              )}
              {!editMode && !peekAndDock && (
                <IconButton
                  id={DOCK_MENU_BUTTON_ID}
                  className={styles.dockMenuButton}
                  tooltip={
                    state.megaMenuDocked
                      ? t('navigation.megamenu.undock', 'Undock menu')
                      : t('navigation.megamenu.dock', 'Dock menu')
                  }
                  name="web-section-alt"
                  onClick={handleDockedMenu}
                  variant="secondary"
                />
              )}
            </div>
          )}
        </nav>
      </div>
    );
  })
);

MegaMenu.displayName = 'MegaMenu';

const getStyles = (theme: GrafanaTheme2, visualRefreshEnabled: boolean) => {
  return {
    content: css({
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      flexGrow: 1,
      position: 'relative',
      paddingTop: theme.spacing(0.5),
    }),
    contentDocked: css({
      paddingTop: theme.spacing(0),
    }),
    scrollArea: css({
      flex: 1,
      minHeight: 0,
    }),
    // The divider between the navigation and the plugin section, drawn under the resize handle's hover band. Its
    // height gives it a wider gap than the footer divider's: this one separates two sections, not a footer.
    sectionSeparator: css({
      margin: theme.spacing(0, 1),
      // A 1px line across the middle of the taller drag target.
      background: `linear-gradient(${theme.colors.border.weak}, ${theme.colors.border.weak}) center / 100% 1px no-repeat`,
    }),
    itemList: css({
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      listStyleType: 'none',
      padding: theme.spacing(1, 1, 2, 1),
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
    pinnedBox: css({
      margin: visualRefreshEnabled ? theme.spacing(0, 1, 1, 1) : theme.spacing(1, 1, 0, 1),
    }),
    // "Pinned" heading row — a small section label (the medium-weight secondary Text below reads as
    // a heading, distinct from the pinned item rows). The icon column matches the item rows so it
    // still lines up.
    pinnedHeading: css({
      alignItems: 'center',
      color: theme.colors.text.secondary,
      display: 'flex',
      gap: theme.spacing(1),
      height: theme.spacing(3.5),
      // Matches the item rows' label inset so the heading icon lines up with the pinned item icons.
      paddingLeft: theme.spacing(1),
      marginBottom: theme.spacing(0.5),
    }),
    pinnedHeadingLine: css({
      flexGrow: 1,
      height: '1px',
      background: `linear-gradient(90deg, ${theme.colors.border.weak} 65%, transparent 100%)`,
    }),
    // Divider separating the pinned box from the rest of the nav, and nav from footer
    dividerLine: css({
      border: 'none',
      flexShrink: 0,
      height: 1,
      background: `linear-gradient(90deg, transparent 0%, ${theme.colors.border.weak} 20%, ${theme.colors.border.weak} 80%, transparent 100%)`,
      margin: theme.spacing(1),
    }),
    // A plain line between the navigation, the plugin section and the profile, as the resize handle draws, in place
    // of the footer divider's fade.
    sectionDivider: css({
      border: 'none',
      flexShrink: 0,
      height: 1,
      background: theme.colors.border.weak,
      margin: theme.spacing(1),
    }),
    // The profile at the bottom of the menu, inset as the navigation items are. The lines around it give it space;
    // as the menu's last row it also keeps a gap below.
    profile: css({
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      padding: theme.spacing(0, 1),
      '&:last-child': {
        paddingBottom: theme.spacing(1),
      },
    }),
    // Edit-mode footer: the Reset/Cancel/Done controls
    footer: css({
      alignItems: 'center',
      display: 'flex',
      flexShrink: 0,
      justifyContent: 'space-between',
      padding: theme.spacing(0.5, 2, 1.5, 2),
    }),
    footerEditMode: css({
      justifyContent: 'center',
    }),
    dockMenuButton: css({
      display: 'none',
      marginLeft: 'auto',

      [theme.breakpoints.up('xl')]: {
        display: 'inline-flex',
      },
    }),
  };
};
