import { css, cx } from '@emotion/css';
import { type DOMAttributes } from '@react-types/shared';
import { memo, forwardRef } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { useFlagGrafanaVisualDesignRefresh } from '@grafana/runtime/internal';
import { ScrollContainer, useStyles2, Button, IconButton } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useAppNotification } from 'app/core/copy/appNotification';
import { useSyncStarredItemsInNav } from 'app/features/stars/hooks';

import { MegaMenuCustomiseControls } from './MegaMenuCustomiseControls';
import { MegaMenuExtensionPoint } from './MegaMenuExtensionPoint';
import { DOCK_MENU_BUTTON_ID, MegaMenuHeader } from './MegaMenuHeader';
import { MegaMenuItem } from './MegaMenuItem';
import { useNavCustomization } from './hooks';

export const MENU_WIDTH = '320px';

export interface Props extends DOMAttributes {
  onClose: () => void;
}

export const MegaMenu = memo(
  forwardRef<HTMLDivElement, Props>(({ onClose, ...restProps }, ref) => {
    const visualRefreshEnabled = useFlagGrafanaVisualDesignRefresh();
    const styles = useStyles2(getStyles, visualRefreshEnabled);
    const { chrome } = useGrafana();
    const state = chrome.useState();
    const notifyApp = useAppNotification();
    const { isLoading: starredItemsLoading, isError: starredItemsError } = useSyncStarredItemsInNav();

    const {
      canCustomise,
      navItems,
      activeItem,
      isHideable,
      isHidden,
      onToggleHidden,
      onRename,
      onMove,
      editMode,
      canReset,
      onEnterEditMode,
      onCancelEdit,
      onSaveEdit,
      onResetToDefault,
      shareUrl,
    } = useNavCustomization();

    const handleDockedMenu = () => {
      chrome.setMegaMenuDocked(!state.megaMenuDocked);
      if (state.megaMenuDocked) {
        chrome.setMegaMenuOpen(false);
      }
    };

    const onCopyShareLink = async () => {
      await navigator.clipboard.writeText(shareUrl);
      notifyApp.success(t('navigation.megamenu.customise-share-copied', 'Link copied to clipboard'));
    };

    const navLabel = t('navigation.megamenu.list-label', 'Navigation');

    return (
      <div data-testid={selectors.components.NavMenu.Menu} ref={ref} {...restProps}>
        <MegaMenuHeader handleDockedMenu={handleDockedMenu} onClose={onClose} />
        <nav className={cx(styles.content, state.megaMenuDocked && styles.contentDocked)} aria-label={navLabel}>
          <div className={styles.scrollArea}>
            <ScrollContainer height="100%" overflowX="hidden" showScrollIndicators={!visualRefreshEnabled}>
              <>
                <ul className={styles.itemList} aria-label={navLabel}>
                  {navItems.map((link, index) => (
                    <MegaMenuItem
                      key={link.id ?? link.text}
                      link={link}
                      onClick={state.megaMenuDocked && !state.fullscreenWorkspace ? undefined : onClose}
                      activeItem={activeItem}
                      editMode={editMode}
                      isHideable={isHideable}
                      isHidden={isHidden}
                      onToggleHidden={onToggleHidden}
                      onRename={onRename}
                      onMove={onMove}
                      canMoveUp={index > 0}
                      canMoveDown={index < navItems.length - 1}
                      ancestorHidden={false}
                      loadingChildren={link.id === 'starred' && starredItemsLoading}
                      childrenLoadError={link.id === 'starred' && starredItemsError}
                    />
                  ))}
                </ul>
                <MegaMenuExtensionPoint />
              </>
            </ScrollContainer>
          </div>
          <hr className={styles.dividerLine} />
          <div className={cx(styles.footer, editMode && styles.footerEditMode)}>
            {editMode && (
              <MegaMenuCustomiseControls
                canReset={canReset}
                onResetToDefault={onResetToDefault}
                onCancelEdit={onCancelEdit}
                onSaveEdit={onSaveEdit}
                onCopyShareLink={onCopyShareLink}
              />
            )}
            {!editMode && canCustomise && (
              <Button variant="secondary" onClick={onEnterEditMode} size="sm" icon="sliders-v-alt">
                <Trans i18nKey="navigation.megamenu.customise">Customise navigation</Trans>
              </Button>
            )}
            {!editMode && !state.fullscreenWorkspace && (
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
    // Divider separating nav from footer
    dividerLine: css({
      border: 'none',
      flexShrink: 0,
      height: 1,
      background: `linear-gradient(90deg, transparent 0%, ${theme.colors.border.weak} 20%, ${theme.colors.border.weak} 80%, transparent 100%)`,
      margin: theme.spacing(1),
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
