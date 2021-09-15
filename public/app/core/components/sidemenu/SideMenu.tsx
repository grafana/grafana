import React, { useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Icon, styleMixins, useTheme2 } from '@grafana/ui';
import appEvents from '../../app_events';
import { Branding } from 'app/core/components/Branding/Branding';
import { contextSrv } from 'app/core/services/context_srv';
import config from 'app/core/config';
import { CoreEvents, KioskMode } from 'app/types';
import TopSection from './TopSection';
import BottomSection from './BottomSection';

const homeUrl = config.appSubUrl || '/';

const getOpposite = (position: typeof contextSrv.user.navPosition) => {
  switch (position) {
    case 'left': {
      return 'right';
    }
    case 'right': {
      return 'left';
    }
    case 'top': {
      return 'bottom';
    }
    case 'bottom': {
      return 'top';
    }
    default: {
      return 'left';
    }
  }
};

const isHorizontal = (position: typeof contextSrv.user.navPosition) => {
  return position === 'top' || position === 'bottom';
};

export const SideMenu = () => {
  const navPosition = contextSrv.user.navPosition;
  const theme = useTheme2();
  const styles = getStyles(theme, navPosition);
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const kiosk = query.get('kiosk') as KioskMode;

  const toggleSideMenuSmallBreakpoint = useCallback(() => {
    appEvents.emit(CoreEvents.toggleSidemenuMobile);
  }, []);

  if (kiosk !== null) {
    return null;
  }

  return (
    <nav className={cx(styles.sidemenu, 'sidemenu')} data-testid="sidemenu" aria-label="Main menu">
      <a href={homeUrl} className={styles.homeLogo}>
        <Branding.MenuLogo />
      </a>
      <div className={styles.mobileSidemenuLogo} onClick={toggleSideMenuSmallBreakpoint} key="hamburger">
        <Icon name="bars" size="xl" />
        <span className={styles.closeButton}>
          <Icon name="times" />
          Close
        </span>
      </div>
      <TopSection position={navPosition} />
      <BottomSection position={navPosition} />
    </nav>
  );
};

SideMenu.displayName = 'SideMenu';

const getStyles = (theme: GrafanaTheme2, position: typeof contextSrv.user.navPosition) => ({
  sidemenu: css`
    border-${getOpposite(position)}: 1px solid ${theme.components.panel.borderColor};
    display: flex;
    flex-direction: ${isHorizontal(position) ? 'row' : 'column'};
    min-width: ${theme.components.sidemenu.width}px;
    position: fixed;
    z-index: ${theme.zIndex.sidemenu};

    @media ${styleMixins.mediaUp(`${theme.breakpoints.values.md}px`)} {
      background-color: ${theme.colors.background.primary};
      position: relative;
    }

    .sidemenu-hidden & {
      display: none;
    }

    .sidemenu-open--xs & {
      background-color: ${theme.colors.background.primary};
      box-shadow: ${theme.shadows.z1};
      height: auto;
      position: absolute;
      width: 100%;
    }
  `,
  homeLogo: css`
    display: none;
    min-height: ${theme.components.sidemenu.width}px;
    min-width: ${theme.components.sidemenu.width}px;

    &:focus-visible,
    &:hover {
      background-color: ${theme.colors.action.hover};
    }

    &:focus-visible {
      box-shadow: none;
      color: ${theme.colors.text.primary};
      outline: 2px solid ${theme.colors.primary.main};
      outline-offset: -2px;
      transition: none;
    }

    img {
      width: ${theme.spacing(3.5)};
    }

    @media ${styleMixins.mediaUp(`${theme.breakpoints.values.md}px`)} {
      align-items: center;
      display: flex;
      justify-content: center;
    }
  `,
  closeButton: css`
    display: none;

    .sidemenu-open--xs & {
      display: block;
      font-size: ${theme.typography.fontSize}px;
    }
  `,
  mobileSidemenuLogo: css`
    align-items: center;
    cursor: pointer;
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    padding: ${theme.spacing(2)};

    @media ${styleMixins.mediaUp(`${theme.breakpoints.values.md}px`)} {
      display: none;
    }
  `,
});
