import React, { FC, useCallback, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { css, cx } from '@emotion/css';
import { cloneDeep } from 'lodash';
import { GrafanaTheme2, NavModelItem, NavSection } from '@grafana/data';
import { Icon, IconName, useTheme2 } from '@grafana/ui';
import { locationService } from '@grafana/runtime';
import appEvents from '../../app_events';
import { Branding } from 'app/core/components/Branding/Branding';
import config from 'app/core/config';
import { CoreEvents, KioskMode } from 'app/types';
import { enrichConfigItems, isLinkActive, isSearchActive } from './utils';
import { OrgSwitcher } from '../OrgSwitcher';
import { NavBarSection } from './NavBarSection';
import NavBarItem from './NavBarItem';

const homeUrl = config.appSubUrl || '/';

export const NavBarNext: FC = React.memo(() => {
  const theme = useTheme2();
  const styles = getStyles(theme);
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const kiosk = query.get('kiosk') as KioskMode;
  const [showSwitcherModal, setShowSwitcherModal] = useState(false);
  const toggleSwitcherModal = () => {
    setShowSwitcherModal(!showSwitcherModal);
  };
  const navTree: NavModelItem[] = cloneDeep(config.bootData.navTree);
  const coreItems = navTree.filter((item) => item.section === NavSection.Core);
  const pluginItems = navTree.filter((item) => item.section === NavSection.Plugin);
  const configItems = enrichConfigItems(
    navTree.filter((item) => item.section === NavSection.Config),
    location,
    toggleSwitcherModal
  );
  const activeItemId = isSearchActive(location)
    ? 'search'
    : navTree.find((item) => isLinkActive(location.pathname, item))?.id;

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
      <div className={styles.mobileSidemenuLogo} onClick={toggleNavBarSmallBreakpoint} key="hamburger">
        <Icon name="bars" size="xl" />
        <span className={styles.closeButton}>
          <Icon name="times" />
          Close
        </span>
      </div>

      <NavBarSection>
        <NavBarItem url={homeUrl} label="Home" className={styles.grafanaLogo} showMenu={false}>
          <Branding.MenuLogo />
        </NavBarItem>
        <NavBarItem
          className={styles.search}
          isActive={activeItemId === 'search'}
          label="Search dashboards"
          onClick={onOpenSearch}
        >
          <Icon name="search" size="xl" />
        </NavBarItem>
      </NavBarSection>

      <NavBarSection>
        {coreItems.map((link, index) => (
          <NavBarItem
            key={`${link.id}-${index}`}
            isActive={activeItemId === link.id}
            label={link.text}
            menuItems={link.children}
            target={link.target}
            url={link.url}
          >
            {link.icon && <Icon name={link.icon as IconName} size="xl" />}
            {link.img && <img src={link.img} alt={`${link.text} logo`} />}
          </NavBarItem>
        ))}
      </NavBarSection>

      {pluginItems.length > 0 && (
        <NavBarSection>
          {pluginItems.map((link, index) => (
            <NavBarItem
              key={`${link.id}-${index}`}
              isActive={activeItemId === link.id}
              label={link.text}
              menuItems={link.children}
              menuSubTitle={link.subTitle}
              onClick={link.onClick}
              target={link.target}
              url={link.url}
            >
              {link.icon && <Icon name={link.icon as IconName} size="xl" />}
              {link.img && <img src={link.img} alt={`${link.text} logo`} />}
            </NavBarItem>
          ))}
        </NavBarSection>
      )}

      <div className={styles.spacer} />

      <NavBarSection>
        {configItems.map((link, index) => (
          <NavBarItem
            key={`${link.id}-${index}`}
            isActive={activeItemId === link.id}
            label={link.text}
            menuItems={link.children}
            menuSubTitle={link.subTitle}
            onClick={link.onClick}
            reverseMenuDirection
            target={link.target}
            url={link.url}
          >
            {link.icon && <Icon name={link.icon as IconName} size="xl" />}
            {link.img && <img src={link.img} alt={`${link.text} logo`} />}
          </NavBarItem>
        ))}
      </NavBarSection>

      {showSwitcherModal && <OrgSwitcher onDismiss={toggleSwitcherModal} />}
    </nav>
  );
});

NavBarNext.displayName = 'NavBar';

const getStyles = (theme: GrafanaTheme2) => ({
  search: css`
    display: none;
    margin-top: 0;

    ${theme.breakpoints.up('md')} {
      display: block;
    }

    .sidemenu-open--xs & {
      display: block;
      margin-top: 0;
    }
  `,
  sidemenu: css`
    display: flex;
    flex-direction: column;
    position: fixed;
    z-index: ${theme.zIndex.sidemenu};

    ${theme.breakpoints.up('md')} {
      background: none;
      border-right: none;
      gap: ${theme.spacing(1)};
      margin-left: ${theme.spacing(1)};
      padding: ${theme.spacing(1)} 0;
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
      margin-left: 0;
      position: absolute;
      width: 100%;
    }
  `,
  grafanaLogo: css`
    display: none;
    img {
      height: ${theme.spacing(3)};
      width: ${theme.spacing(3)};
    }

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
  `,
  spacer: css`
    flex: 1;

    .sidemenu-open--xs & {
      display: none;
    }
  `,
});
