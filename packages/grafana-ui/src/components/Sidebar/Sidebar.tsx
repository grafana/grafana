import { css, cx } from '@emotion/css';
import React, { ReactNode, useContext } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';

import { SidebarButton } from './SidebarButton';
import { SidebarPaneHeader } from './SidebarPaneHeader';

export interface Props {
  children?: ReactNode;
  contextValue: SidebarContextValue;
}

export type SidebarPosition = 'left' | 'right';

interface SidebarContextValue {
  isDocked: boolean;
  position: SidebarPosition;
  compact?: boolean;
  hasOpenPane?: boolean;
  tabsMode?: boolean;
  outerWrapperProps?: React.HTMLAttributes<HTMLDivElement>;
  onDockChange: () => void;
}

const SidebarContext: React.Context<SidebarContextValue | undefined> = React.createContext<
  SidebarContextValue | undefined
>(undefined);

export function SidebarComp({ children, contextValue }: Props) {
  const styles = useStyles2(getStyles);
  const { isDocked, position, tabsMode } = contextValue;

  const className = cx({
    [styles.container]: true,
    [styles.containerDocked]: isDocked,
    [styles.containerLeft]: position === 'left',
    [styles.containerTabsMode]: tabsMode,
  });

  return (
    <div className={className}>
      <SidebarContext.Provider value={contextValue}>{children}</SidebarContext.Provider>
    </div>
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
    <div className={styles.toolbar}>
      {children}
      <div className={styles.flexGrow} />
      {context.hasOpenPane && (
        <SidebarButton
          icon={'web-section-alt'}
          onClick={context.onDockChange}
          title={context.isDocked ? 'Undock pane' : 'Dock pane'}
        />
      )}
    </div>
  );
}

export function SidebarDivider() {
  const styles = useStyles2(getStyles);

  return <div className={styles.divider} />;
}

export interface UseSideBarOptions {
  hasOpenPane?: boolean;
  position?: SidebarPosition;
  tabsMode?: boolean;
  compact?: boolean;
}

export function useSiderbar({
  hasOpenPane: isPaneOpen,
  position = 'right',
  tabsMode,
  compact = true,
}: UseSideBarOptions): SidebarContextValue {
  const [isDocked, setIsDocked] = React.useState(false);

  const onDockChange = () => setIsDocked(!isDocked);

  const prop = position === 'right' ? 'paddingRight' : 'paddingLeft';
  const toolbarWidth = 40 + 16 * 2; // button width + padding

  const outerWrapperProps = {
    style: {
      [prop]: isDocked && isPaneOpen ? '350px' : compact ? toolbarWidth : '68px',
    },
  };

  return { isDocked, onDockChange, outerWrapperProps, position, compact, hasOpenPane: isPaneOpen, tabsMode };
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

  return <div className={className}>{children}</div>;
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
      right: theme.spacing(2),
      overflow: 'hidden',
    }),
    containerTabsMode: css({
      position: 'relative',
    }),
    containerLeft: css({
      right: 'unset',
      flexDirection: 'row-reverse',
      left: theme.spacing(2),
      borderRadius: theme.shape.radius.default,
    }),
    containerDocked: css({
      boxShadow: 'none',
    }),
    toolbar: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: theme.spacing(1, 1),
      flexGrow: 0,
      gap: theme.spacing(1.5),
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
