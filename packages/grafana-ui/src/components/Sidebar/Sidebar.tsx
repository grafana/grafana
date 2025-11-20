import { css, cx } from '@emotion/css';
import { ReactNode, useContext } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2, useTheme2 } from '../../themes/ThemeContext';

import { SidebarButton } from './SidebarButton';
import { SidebarPaneHeader } from './SidebarPaneHeader';
import { SidebarResizer } from './SidebarResizer';
import { SIDE_BAR_WIDTH_ICON_ONLY, SIDE_BAR_WIDTH_WITH_TEXT, SidebarContext, SidebarContextValue } from './useSidebar';

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
    [styles.undockedPaneOpen]: hasOpenPane && !isDocked,
    [styles.containerLeft]: position === 'left',
    [styles.containerTabsMode]: tabsMode,
  });

  const style = { [position]: theme.spacing(edgeMargin), bottom: theme.spacing(bottomMargin) };

  return (
    <SidebarContext.Provider value={contextValue}>
      <div className={className} style={style}>
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
          onClick={context.onDockChange}
          title={context.isDocked ? t('grafana-ui.sidebar.undock', 'Undock') : t('grafana-ui.sidebar.dock', 'Dock')}
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
      border: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.primary,
      borderRadius: theme.shape.radius.default,
      zIndex: theme.zIndex.navbarFixed,
      bottom: 0,
      top: 0,
      right: 0,
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
      gap: theme.spacing(1),
      overflow: 'hidden',
      width: theme.spacing(SIDE_BAR_WIDTH_WITH_TEXT),
    }),
    toolbarIconsOnly: css({
      width: theme.spacing(SIDE_BAR_WIDTH_ICON_ONLY),
    }),
    divider: css({
      height: '1px',
      background: theme.colors.border.weak,
      width: '100%',
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
