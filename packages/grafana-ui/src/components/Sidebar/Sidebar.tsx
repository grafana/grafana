import { css, cx } from '@emotion/css';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

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

function SidebarComp({ children, contextValue }: Props) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const { isDocked, position, tabsMode, hasOpenPane, edgeMargin, bottomMargin, onToggleIsHidden } = contextValue;

  const floating = contextValue.floating;
  const isFloating = !!floating?.isFloating;
  const className = cx({
    [styles.container]: true,
    [styles.undockedPaneOpen]: hasOpenPane && !isDocked && !isFloating,
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
    if (!isFloating && !isDocked && hasOpenPane) {
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
        ref={(element) => {
          ref.current = element;
          if (floating) {
            floating.anchorRef.current = element;
          }
        }}
        className={className}
        style={style}
        id="sidebar-container"
        data-testid={selectors.components.Sidebar.container}
        aria-hidden={contextValue.isHidden}
      >
        {!tabsMode && !isFloating && <SidebarResizer />}
        {children}
        {isFloating && !hasOpenPane && (
          <SidebarOpenPane>
            <SidebarPaneHeader title={t('grafana-ui.sidebar.empty-selection', 'Nothing is selected')} />
          </SidebarOpenPane>
        )}
      </div>
    </SidebarContext.Provider>
  );
}

interface SiderbarToolbarProps {
  children?: ReactNode;
}

function SiderbarToolbar({ children }: SiderbarToolbarProps) {
  const styles = useStyles2(getStyles);
  const sidebarContext = useSidebarContext();

  if (!sidebarContext) {
    throw new Error('Sidebar.Toolbar must be used within a Sidebar component');
  }

  return (
    <div className={cx(styles.toolbar, sidebarContext.compact && styles.toolbarIconsOnly)}>
      {children}
      <div className={styles.flexGrow} />
    </div>
  );
}

function SidebarDivider() {
  const styles = useStyles2(getStyles);

  return <div className={styles.divider} />;
}

interface SidebarOpenPaneProps {
  children?: ReactNode;
}

function SidebarOpenPane({ children }: SidebarOpenPaneProps) {
  const styles = useStyles2(getStyles);
  const sidebarContext = useSidebarContext();

  if (!sidebarContext) {
    throw new Error('Sidebar.OpenPane must be used within a Sidebar component');
  }

  const floating = sidebarContext.floating;
  const isFloating = !!floating?.isFloating;
  const fitRef = useRef(floating?.fit);
  fitRef.current = floating?.fit;
  useEffect(() => {
    if (!isFloating) {
      return;
    }
    const fit = () => fitRef.current?.();
    fit();
    window.addEventListener('resize', fit);
    const onScroll = () => {
      if (floating?.isParked) {
        fit();
      }
    };
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', fit);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [isFloating, floating?.isParked, sidebarContext.hasOpenPane]);

  const pane = (
    <div
      ref={floating?.containerRef}
      className={cx(
        styles.openPane,
        isFloating
          ? styles.floatingPane
          : sidebarContext.position === 'right'
            ? styles.openPaneRight
            : styles.openPaneLeft
      )}
      style={{ width: isFloating ? '100%' : sidebarContext.paneWidth }}
    >
      {children}
    </div>
  );

  if (!isFloating || !floating) {
    return pane;
  }

  return createPortal(
    <div
      role="region"
      aria-label={t('grafana-ui.sidebar.floating-pane', 'Floating sidebar')}
      className={cx(styles.floating, floating.isMinimized && styles.minimized)}
      style={{
        left: floating.bounds.x,
        top: floating.bounds.y,
        width: floating.bounds.width,
        height: floating.bounds.height,
      }}
    >
      {pane}
      {sidebarContext.hasOpenPane && (
        <button
          type="button"
          className={styles.resize}
          aria-label={t('grafana-ui.sidebar.resize-floating', 'Resize toolbox')}
          {...floating.resizeProps}
        />
      )}
    </div>,
    document.body
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    minimized: css({ borderRadius: theme.shape.radius.pill }),
    floating: css({
      position: 'fixed',
      display: 'flex',
      border: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.primary,
      borderRadius: theme.shape.radius.lg,
      zIndex: theme.zIndex.navbarFixed,
      containerType: 'size',
      containerName: 'sidebar-toolbox',
      overflow: 'hidden',
      flexDirection: 'column',
      boxShadow: theme.shadows.z3,
      [theme.transitions.handleMotion('no-preference')]: { transition: 'none' },
    }),
    floatingPane: css({
      minHeight: 0,
      height: '100%',
      paddingBottom: 0,
      border: 0,
      '@container sidebar-toolbox (max-height: 48px)': {
        overflow: 'hidden',
      },
    }),
    resize: css({
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 12,
      height: 12,
      border: 0,
      borderRight: `3px solid ${theme.colors.text.secondary}`,
      borderBottom: `3px solid ${theme.colors.text.secondary}`,
      background: 'transparent',
      cursor: 'nwse-resize',
      touchAction: 'none',
    }),
    container: css({
      display: 'flex',
      position: 'absolute',
      flexDirection: 'row',
      flex: '1 1 0',
      border: `1px solid ${theme.colors.border.weak}`,
      background: theme.colors.background.primary,
      borderRadius: theme.shape.radius.lg,
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
      boxShadow: theme.flags.visualDesignRefresh ? theme.shadows.z2 : theme.shadows.z3,
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
      bottom: theme.spacing(2),
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
