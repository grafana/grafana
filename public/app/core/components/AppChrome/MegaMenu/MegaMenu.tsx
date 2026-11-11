import { css, cx } from '@emotion/css';
import { type DOMAttributes } from '@react-types/shared';
import { memo, forwardRef, useId } from 'react';

import { type GrafanaTheme2, type NavModelItem } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { useFlagGrafanaScopesDashboardsMegaMenu, useFlagGrafanaVisualDesignRefresh } from '@grafana/runtime/internal';
import { ErrorBoundaryAlert, ScrollContainer, Text, useStyles2, IconButton } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { ScopesDashboardsMegaMenuSection } from 'app/features/scopes/dashboards/ScopesDashboardsMegaMenuSection';
import { useStarredSearch } from 'app/features/stars/hooks';

import { MegaMenuExtensionPoint } from './MegaMenuExtensionPoint';
import { DOCK_MENU_BUTTON_ID, MegaMenuHeader } from './MegaMenuHeader';
import { MegaMenuItem } from './MegaMenuItem';
import { MegaMenuPinnedItem } from './MegaMenuPinnedItem';
import { MegaMenuSkeleton } from './MegaMenuSkeleton';
import { useMegaMenuNavigation } from './hooks';

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
    const { navigationInfoArchRefresh, isLoading, navItems, pinnedEntries, activeItem, isPinned, onPinItem, isSaving } =
      useMegaMenuNavigation();
    // Re-search on each open to pick up renames and deletes from other tabs.
    const { loading: starredLoading, error: starredError } = useStarredSearch({ refetchOnMountOrArgChange: true });

    const handleDockedMenu = () => {
      chrome.setMegaMenuDocked(!state.megaMenuDocked);
      if (state.megaMenuDocked) {
        chrome.setMegaMenuOpen(false);
      }
    };
    const onNavigate = state.megaMenuDocked && !state.fullscreenWorkspace ? undefined : onClose;
    const renderNavItem = (link: NavModelItem, key: string = link.text, pinnedSection = false) => (
      <MegaMenuItem
        key={key}
        link={link}
        isPinned={isPinned}
        onClick={onNavigate}
        activeItem={activeItem}
        onPin={onPinItem}
        navigationInfoArchRefresh={navigationInfoArchRefresh}
        tightLabelGap={pinnedSection}
        isPinnedSection={pinnedSection}
        expandKeyPrefix={pinnedSection ? 'pinned/' : undefined}
        defaultExpanded={pinnedSection ? true : undefined}
        loadingChildren={link.id === 'starred' && starredLoading}
        childrenLoadError={link.id === 'starred' && starredError}
        disabled={isSaving}
      />
    );

    const navLabel = t('navigation.megamenu.list-label', 'Navigation');
    const pinnedListLabel = t('navigation.megamenu.pinned-list-label', 'Pinned items');
    const pinnedHeadingId = useId();

    return (
      <div data-testid={selectors.components.NavMenu.Menu} ref={ref} {...restProps}>
        <MegaMenuHeader handleDockedMenu={handleDockedMenu} onClose={onClose} />
        <nav className={cx(styles.content, state.megaMenuDocked && styles.contentDocked)} aria-label={navLabel}>
          <div className={styles.scrollArea}>
            <ScrollContainer height="100%" overflowX="hidden" showScrollIndicators={!visualRefreshEnabled}>
              {isLoading ? (
                <ul className={styles.itemList} aria-label={navLabel} aria-busy>
                  <MegaMenuSkeleton />
                </ul>
              ) : (
                <>
                  {pinnedEntries.length > 0 && (
                    <>
                      <div className={styles.pinnedBox}>
                        <div className={styles.pinnedHeading} id={pinnedHeadingId}>
                          <Text variant="bodySmall" color="secondary" weight="medium">
                            {pinnedListLabel}
                          </Text>
                          <div className={styles.pinnedHeadingLine} />
                        </div>
                        <ul className={styles.list} aria-labelledby={pinnedHeadingId}>
                          {pinnedEntries.map((entry) =>
                            entry.section ? (
                              renderNavItem(entry.section, entry.url, true)
                            ) : (
                              <MegaMenuPinnedItem
                                key={entry.url}
                                line={entry.line}
                                activeItem={activeItem}
                                onUnpin={() => onPinItem(entry.line.item)}
                                onClick={onNavigate}
                                disabled={isSaving}
                              />
                            )
                          )}
                        </ul>
                      </div>
                      <hr className={styles.dividerLine} />
                    </>
                  )}
                  {scopesMegaMenuEnabled && (
                    <ErrorBoundaryAlert boundaryName="scopes-dashboards-mega-menu">
                      <ScopesDashboardsMegaMenuSection onNavigate={onNavigate} />
                    </ErrorBoundaryAlert>
                  )}
                  <ul className={styles.itemList} aria-label={navLabel}>
                    {navItems.map((link) => renderNavItem(link))}
                  </ul>
                </>
              )}
              <MegaMenuExtensionPoint />
            </ScrollContainer>
          </div>
          <hr className={styles.dividerLine} />
          <div className={styles.footer}>
            {!state.fullscreenWorkspace && (
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
        </nav>
      </div>
    );
  })
);

MegaMenu.displayName = 'MegaMenu';

const getStyles = (theme: GrafanaTheme2, visualRefreshEnabled: boolean) => ({
  content: css({
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    flexGrow: 1,
    position: 'relative',
    paddingTop: theme.spacing(0.5),
  }),
  contentDocked: css({ paddingTop: theme.spacing(0) }),
  scrollArea: css({ flex: 1, minHeight: 0 }),
  itemList: css({
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    listStyleType: 'none',
    padding: theme.spacing(1, 1, 2, 1),
    // Fit the scrollport, which can be narrower than the menu when OS scrollbars are always visible.
    width: '100%',
    minWidth: 0,
  }),
  list: css({
    display: 'flex',
    flexDirection: 'column',
    listStyleType: 'none',
    padding: 0,
    margin: 0,
  }),
  pinnedBox: css({
    margin: visualRefreshEnabled ? theme.spacing(0, 1, 0.5, 1) : theme.spacing(1, 1, 0, 1),
  }),
  pinnedHeading: css({
    alignItems: 'center',
    color: theme.colors.text.secondary,
    display: 'flex',
    gap: theme.spacing(1),
    height: theme.spacing(3.5),
    paddingLeft: theme.spacing(1),
    marginBottom: theme.spacing(0.5),
  }),
  pinnedHeadingLine: css({
    flexGrow: 1,
    height: '1px',
    background: `linear-gradient(90deg, ${theme.colors.border.weak} 65%, transparent 100%)`,
  }),
  dividerLine: css({
    border: 'none',
    flexShrink: 0,
    height: 1,
    background: `linear-gradient(90deg, transparent 0%, ${theme.colors.border.weak} 20%, ${theme.colors.border.weak} 80%, transparent 100%)`,
    margin: theme.spacing(1),
  }),
  footer: css({
    alignItems: 'center',
    display: 'flex',
    flexShrink: 0,
    justifyContent: 'space-between',
    padding: theme.spacing(0.5, 2, 1.5, 2),
  }),
  dockMenuButton: css({
    display: 'none',
    marginLeft: 'auto',
    [theme.breakpoints.up('xl')]: { display: 'inline-flex' },
  }),
});
