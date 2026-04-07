import { css, cx } from '@emotion/css';
import { type ReactNode } from 'react';
import { useMedia } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';
import { IconButton } from '../IconButton/IconButton';
import { getPortalContainer } from '../Portal/Portal';

import { SidebarButton } from './SidebarButton';
import { SidebarPaneHeader } from './SidebarPaneHeader';
import { SidebarResizer } from './SidebarResizer';
import {
  SIDE_BAR_WIDTH_ICON_ONLY,
  SIDE_BAR_WIDTH_WITH_TEXT,
  SidebarContext,
  type SidebarContextValue,
  useSidebarContext,
} from './useSidebar';
import { useCustomClickAway } from './useSidebarClickAway';

export interface Props {
  children?: ReactNode;
  contextValue: SidebarContextValue;
}

export function SidebarComp({ children, contextValue }: Props) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const { isDocked, position, tabsMode, hasOpenPane, edgeMargin, bottomMargin, onToggleIsHidden } = contextValue;

  const className = cx({
    [styles.container]: true,
    [styles.undockedPaneOpen]: hasOpenPane && !isDocked,
    [styles.containerLeft]: position === 'left',
    [styles.containerTabsMode]: tabsMode,
    [styles.containerHidden]: !!contextValue.isHidden,
  });

  const style = { [position]: theme.spacing(edgeMargin), bottom: theme.spacing(bottomMargin) };

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

  if (contextValue.isHidden) {
    return (
      <SidebarContext.Provider value={contextValue}>
        <IconButton
          className={cx(styles.showButton, position === 'left' ? styles.showButtonLeft : styles.showButtonRight)}
          variant="secondary"
          name={'arrow-to-right'}
          tooltip={t('grafana-ui.sidebar.show', 'Show')}
          tooltipPlacement={position === 'left' ? 'right' : 'left'}
          onClick={onToggleIsHidden}
          data-testid={selectors.components.Sidebar.showHideToggle}
        />
      </SidebarContext.Provider>
    );
  }

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
        {!tabsMode && <SidebarResizer />}
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export interface SiderbarToolbarProps {
  children?: ReactNode;
}

export function SiderbarToolbar({ children }: SiderbarToolbarProps) {
  const styles = useStyles2(getStyles);
  const sidebarContext = useSidebarContext();
  const theme = useTheme2();
  const isMobile = useMedia(`(max-width: ${theme.breakpoints.values.sm}px)`);

  if (!sidebarContext) {
    throw new Error('Sidebar.Toolbar must be used within a Sidebar component');
  }

  return (
    <div className={cx(styles.toolbar, sidebarContext.compact && styles.toolbarIconsOnly)}>
      {children}
      <div className={styles.flexGrow} />
      {!isMobile && (
        <SidebarButton
          icon={'web-section-alt'}
          onClick={sidebarContext.onToggleDock}
          title={
            sidebarContext.isDocked ? t('grafana-ui.sidebar.undock', 'Undock') : t('grafana-ui.sidebar.dock', 'Dock')
          }
          data-testid={selectors.components.Sidebar.dockToggle}
        />
      )}
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
  const sidebarContext = useSidebarContext();

  if (!sidebarContext) {
    throw new Error('Sidebar.OpenPane must be used within a Sidebar component');
  }

  const className = cx(
    styles.openPane,
    sidebarContext.position === 'right' ? styles.openPaneRight : styles.openPaneLeft
  );

  return (
    <div className={className} style={{ width: sidebarContext.paneWidth }}>
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
      border: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.primary,
      borderRadius: theme.shape.radius.default,
      zIndex: theme.zIndex.navbarFixed,
      bottom: 0,
      top: 0,
      right: 0,
      width: 'calc-size(auto, size)',

      [theme.transitions.handleMotion('no-preference')]: {
        transition: theme.transitions.create('width', {
          duration: theme.transitions.duration.standard,
        }),
      },
    }),
    containerHidden: css({
      width: 0,
      border: 0,
      overflow: 'hidden',
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
      paddingBottom: theme.spacing(1),
      flexGrow: 0,
      gap: theme.spacing(2),
      overflowX: 'hidden',
      overflowY: 'auto',
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
      overflowY: 'auto',
    }),
    openPaneRight: css({
      borderRight: `1px solid ${theme.colors.border.weak}`,
    }),
    openPaneLeft: css({
      borderLeft: `1px solid ${theme.colors.border.weak}`,
    }),
    showButton: css({
      position: 'fixed',
      top: '50%',
      zIndex: theme.zIndex.navbarFixed,
      padding: theme.spacing(1),
      backgroundColor: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.strong}`,
    }),
    showButtonRight: css({
      right: theme.spacing(0.5),
      transform: 'scaleX(-1)',
    }),
    showButtonLeft: css({
      left: theme.spacing(0.5),
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

export { useSidebar, useSidebarContext, type SidebarContextValue, type SidebarPosition } from './useSidebar';
