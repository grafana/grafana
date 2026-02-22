import { css, cx } from '@emotion/css';
import { ReactNode, useContext, useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';
import { Icon } from '../Icon/Icon';
import { getPortalContainer } from '../Portal/Portal';
import { Tooltip } from '../Tooltip/Tooltip';

import { SidebarButton } from './SidebarButton';
import { SidebarPaneHeader } from './SidebarPaneHeader';
import { SidebarResizer } from './SidebarResizer';
import { SIDE_BAR_WIDTH_ICON_ONLY, SIDE_BAR_WIDTH_WITH_TEXT, SidebarContext, SidebarContextValue } from './useSidebar';
import { useCustomClickAway } from './useSidebarClickAway';

export interface Props {
  children?: ReactNode;
  contextValue: SidebarContextValue;
}

export function SidebarComp({ children, contextValue }: Props) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const { isDocked, position, tabsMode, hasOpenPane, edgeMargin, bottomMargin } = contextValue;

  const className = cx({
    [styles.container]: true,
    [styles.containerVisible]: !contextValue.isHidden,
    [styles.containerHidden]: contextValue.isHidden,
    [styles.undockedPaneOpen]: !contextValue.isHidden && hasOpenPane && !isDocked,
    [styles.containerLeft]: position === 'left',
    [styles.containerTabsMode]: tabsMode,
  });

  const style = {
    [position]: contextValue.isHidden ? 0 : theme.spacing(edgeMargin),
    bottom: contextValue.isHidden ? 0 : theme.spacing(bottomMargin),
  };

  const ref = useCustomClickAway((evt) => {
    const portalContainer = getPortalContainer();
    // ignore clicks inside portal container
    if (evt.target instanceof Node && portalContainer && portalContainer.contains(evt.target)) {
      return;
    }
    if (!isDocked && hasOpenPane) {
      contextValue.onClosePane?.();
    }
  });

  const body = useMemo(() => {
    if (contextValue.isHidden) {
      return (
        <Tooltip
          content={<Trans i18nKey="grafana-ui.sidebar.unhide">Unhide</Trans>}
          placement={position === 'right' ? 'left' : 'right'}
        >
          <button className={styles.unhideButton} onClick={() => contextValue.onToggleIsHidden()}>
            <Icon name="arrow-to-right" size="sm" className={styles.unhideButtonIcon} />
          </button>
        </Tooltip>
      );
    }

    return (
      <>
        {!tabsMode && <SidebarResizer />}
        {children}
      </>
    );
  }, [contextValue, children, tabsMode, position, styles.unhideButton, styles.unhideButtonIcon]);

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        ref={ref}
        className={className}
        style={style}
        id="sidebar-container"
        data-testid={selectors.components.Sidebar.container}
        aria-hidden={contextValue.isHidden}
      >
        {body}
      </div>
    </SidebarContext.Provider>
  );
}

export interface SiderbarToolbarProps {
  children?: ReactNode;
}

export function SiderbarToolbar({ children }: SiderbarToolbarProps) {
  const styles = useStyles2(getStyles);
  const context = useContext(SidebarContext);

  if (!context) {
    throw new Error('Sidebar.Toolbar must be used within a Sidebar component');
  }

  return (
    <div className={cx(styles.toolbar, context.compact && styles.toolbarIconsOnly)}>
      {children}
      <div className={styles.flexGrow} />
      {context.hasOpenPane && (
        <SidebarButton
          icon={'web-section-alt'}
          onClick={context.onToggleDock}
          title={context.isDocked ? t('grafana-ui.sidebar.undock', 'Undock') : t('grafana-ui.sidebar.dock', 'Dock')}
          data-testid={selectors.components.Sidebar.dockToggle}
        />
      )}
      <SidebarButton
        icon={'arrow-to-right'}
        onClick={context.onToggleIsHidden}
        title={t('grafana-ui.sidebar.hide', 'Hide')}
        data-testid={selectors.components.Sidebar.dockHide}
      />
    </div>
  );
}

export function SidebarDivider() {
  const styles = useStyles2(getStyles);

  return <div className={styles.divider} />;
}

export interface SidebarOpenPaneProps {
  children?: ReactNode;
}

export function SidebarOpenPane({ children }: SidebarOpenPaneProps) {
  const styles = useStyles2(getStyles);
  const context = useContext(SidebarContext);

  if (!context) {
    throw new Error('Sidebar.OpenPane must be used within a Sidebar component');
  }

  const className = cx(styles.openPane, context.position === 'right' ? styles.openPaneRight : styles.openPaneLeft);

  return (
    <div className={className} style={{ width: context.paneWidth }}>
      {children}
    </div>
  );
}

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      position: 'absolute',
      flexDirection: 'row',
      flex: '1 1 0',
      zIndex: theme.zIndex.navbarFixed,
      bottom: 0,
      top: 0,
      right: 0,
    }),
    containerVisible: css({
      border: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.primary,
      borderRadius: theme.shape.radius.default,
    }),
    containerHidden: css({
      alignItems: 'flex-end',
    }),
    containerTabsMode: css({
      position: 'relative',
    }),
    containerLeft: css({
      right: 'unset',
      flexDirection: 'row-reverse',
      left: 0,
      borderRadius: theme.shape.radius.default,
    }),
    undockedPaneOpen: css({
      boxShadow: theme.shadows.z3,
    }),
    toolbar: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: theme.spacing(1, 0),
      flexGrow: 0,
      gap: theme.spacing(2),
      overflow: 'hidden',
      width: theme.spacing(SIDE_BAR_WIDTH_WITH_TEXT),
    }),
    toolbarIconsOnly: css({
      width: theme.spacing(SIDE_BAR_WIDTH_ICON_ONLY),
    }),
    divider: css({
      height: '1px',
      background: theme.colors.border.weak,
      width: '70%',
    }),
    flexGrow: css({
      flexGrow: 1,
    }),
    openPane: css({
      width: '280px',
      flexGrow: 1,
      paddingBottom: theme.spacing(2),
    }),
    openPaneRight: css({
      borderRight: `1px solid ${theme.colors.border.weak}`,
    }),
    openPaneLeft: css({
      borderLeft: `1px solid ${theme.colors.border.weak}`,
    }),
    unhideButton: css({
      padding: theme.spacing(1),
      border: `1px solid ${theme.colors.border.weak}`,
      borderRight: 0,
      background: theme.colors.background.primary,
      borderRadius: `${theme.shape.radius.default} 0 0 ${theme.shape.radius.default}`,
      opacity: 1,
      margin: 0,
    }),
    unhideButtonIcon: css({
      transform: 'scaleX(-1)',
    }),
  };
};

export const Sidebar = Object.assign(SidebarComp, {
  Toolbar: SiderbarToolbar,
  Button: SidebarButton,
  OpenPane: SidebarOpenPane,
  Divider: SidebarDivider,
  PaneHeader: SidebarPaneHeader,
});

export { type SidebarPosition, type SidebarContextValue, useSidebar } from './useSidebar';
