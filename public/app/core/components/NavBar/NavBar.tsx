import React, { FC, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { css, cx } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Icon, useTheme2 } from '@grafana/ui';
import { locationService } from '@grafana/runtime';
import appEvents from '../../app_events';
import { Branding } from 'app/core/components/Branding/Branding';
import config from 'app/core/config';
import { CoreEvents, KioskMode } from 'app/types';
import { isSearchActive } from './utils';
import TopSection from './TopSection';
import BottomSection from './BottomSection';
import PluginSection from './PluginSection';
import NavBarItem from './NavBarItem';

const homeUrl = config.appSubUrl || '/';

export const NavBar: FC = React.memo(() => {
  const newNavigationEnabled = config.featureToggles.newNavigation;
  const theme = useTheme2();
  const styles = getStyles(theme, newNavigationEnabled);
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const kiosk = query.get('kiosk') as KioskMode;

  const toggleNavBarSmallBreakpoint = useCallback(() => {
    appEvents.emit(CoreEvents.toggleSidemenuMobile);
  }, []);

  if (kiosk !== null) {
    return null;
  }

  const onOpenSearch = () => {
    locationService.partial({ search: 'open' });
  };

  return (
    <nav className={cx(styles.sidemenu, 'sidemenu')} data-testid="sidemenu" aria-label="Main menu">
      {!newNavigationEnabled && (
        <NavBarItem url={homeUrl} label="Home" className={styles.grafanaLogo} showMenu={false}>
          <Branding.MenuLogo />
        </NavBarItem>
      )}
      {newNavigationEnabled && (
        <NavBarItem
          className={cx(styles.grafanaLogo, styles.section)}
          label="Full menu"
          onClick={toggleNavBarSmallBreakpoint}
          showMenu={false}
        >
          <Branding.MenuLogo />
        </NavBarItem>
      )}
      <div className={styles.mobileSidemenuLogo} onClick={toggleNavBarSmallBreakpoint} key="hamburger">
        <Icon name="bars" size="xl" />
        <span className={styles.closeButton}>
          <Icon name="times" />
          Close
        </span>
      </div>
      {newNavigationEnabled && (
        <NavBarItem
          className={cx(styles.search, styles.section)}
          isActive={isSearchActive(location)}
          label="Search dashboards"
          onClick={onOpenSearch}
        >
          <Icon name="search" size="xl" />
        </NavBarItem>
      )}
      <TopSection />
      {newNavigationEnabled && <PluginSection />}
      <div className={styles.spacer} />
      <BottomSection />
    </nav>
  );
});

NavBar.displayName = 'NavBar';

const getStyles = (theme: GrafanaTheme2, newNavigationEnabled: boolean) => ({
  search: css`
    display: none;

    ${theme.breakpoints.up('md')} {
      display: block;
    }

    .sidemenu-open--xs & {
      display: block;
    }
  `,
  section: css`
    background-color: ${theme.colors.background.primary};
    border: 1px solid ${theme.components.panel.borderColor};
    border-radius: 2px;
  `,
  sidemenu: css`
    display: flex;
    flex-direction: column;
    position: fixed;
    z-index: ${theme.zIndex.sidemenu};

    ${theme.breakpoints.up('md')} {
      background-color: ${newNavigationEnabled ? 'none' : theme.colors.background.primary};
      border-right: ${newNavigationEnabled ? 'none' : `1px solid ${theme.components.panel.borderColor}`};
      gap: ${theme.spacing(newNavigationEnabled ? 1 : 0)};
      position: relative;
      width: ${theme.components.sidemenu.width}px;
    }

    .sidemenu-hidden & {
      display: none;
    }

    .sidemenu-open--xs & {
      background-color: ${theme.colors.background.primary};
      box-shadow: ${theme.shadows.z1};
      gap: ${theme.spacing(1)};
      height: auto;
      position: absolute;
      width: 100%;

      ${theme.breakpoints.up('md')} {
        border: 1px solid ${theme.components.panel.borderColor};
        height: 100%;
        overflow: auto;
        width: 300px;
      }
    }
  `,
  grafanaLogo: css`
    display: none;
    margin-top: ${newNavigationEnabled ? theme.spacing(1) : 'none'};

    ${theme.breakpoints.up('md')} {
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

    ${theme.breakpoints.up('md')} {
      display: none;
    }

    .sidemenu-open--xs & {
      display: flex;
    }
  `,
  spacer: css`
    flex: 1;

    .sidemenu-open--xs & {
      display: none;
    }
  `,
});
