import React, { FC, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { css, cx } from '@emotion/css';
import { cloneDeep } from 'lodash';
import { GrafanaTheme2, NavModelItem, NavSection } from '@grafana/data';
import { Icon, IconName, useTheme2 } from '@grafana/ui';
import { locationService } from '@grafana/runtime';
import { Branding } from 'app/core/components/Branding/Branding';
import config from 'app/core/config';
import { KioskMode } from 'app/types';
import {
  buildIntegratedAlertingMenuItem,
  enrichConfigItems,
  getActiveItem,
  isMatchOrChildMatch,
  isSearchActive,
  SEARCH_ITEM_ID,
} from './utils';
import { OrgSwitcher } from '../OrgSwitcher';
import NavBarItem from './NavBarItem';
import { NavBarSection } from './NavBarSection';
import { NavBarMenu } from './NavBarMenu';
import { NavBarItemWithoutMenu } from './NavBarItemWithoutMenu';
import { isPmmAdmin } from 'app/percona/shared/helpers/permissions';
import { getPerconaSettings, getPerconaUser } from 'app/percona/shared/core/selectors';

const homeUrl = config.appSubUrl || '/';

const onOpenSearch = () => {
  locationService.partial({ search: 'open' });
};

const searchItem: NavModelItem = {
  id: SEARCH_ITEM_ID,
  onClick: onOpenSearch,
  text: 'Search dashboards',
  icon: 'search',
};

export const NavBar: FC = React.memo(() => {
  const theme = useTheme2();
  const styles = getStyles(theme);
  const location = useLocation();
  const { sttEnabled, alertingEnabled, dbaasEnabled, backupEnabled } = useSelector(getPerconaSettings);
  const { isPlatformUser } = useSelector(getPerconaUser);
  const query = new URLSearchParams(location.search);
  const kiosk = query.get('kiosk') as KioskMode;
  const [showSwitcherModal, setShowSwitcherModal] = useState(false);
  const toggleSwitcherModal = () => {
    setShowSwitcherModal(!showSwitcherModal);
  };
  const navTree: NavModelItem[] = cloneDeep(config.bootData.navTree);
  const topItems = navTree.filter((item) => item.section === NavSection.Core);
  const bottomItems = enrichConfigItems(
    navTree.filter((item) => item.section === NavSection.Config),
    location,
    toggleSwitcherModal
  );
  const activeItem = isSearchActive(location) ? searchItem : getActiveItem(navTree, location.pathname);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (isPmmAdmin(config.bootData.user)) {
    if (alertingEnabled) {
      buildIntegratedAlertingMenuItem(topItems);
    }

    if (sttEnabled) {
      topItems.push({
        id: 'database-checks',
        icon: 'percona-database-checks',
        text: 'Advisor Checks',
        url: `${config.appSubUrl}/pmm-database-checks`,
      });
    }

    if (dbaasEnabled) {
      topItems.push({
        id: 'dbaas',
        text: 'DBaaS',
        icon: 'database',
        url: `${config.appSubUrl}/dbaas`,
      });
    }

    if (backupEnabled) {
      topItems.push({
        id: 'backup',
        icon: 'history',
        text: 'Backup',
        url: `${config.appSubUrl}/backup`,
      });
    }
  }

  if (isPlatformUser) {
    topItems.push({
      id: 'tickets',
      icon: 'ticket',
      text: 'Support Tickets',
      url: `${config.appSubUrl}/tickets`,
    });
  }

  if (kiosk !== null) {
    return null;
  }

  return (
    <nav className={cx(styles.sidemenu, 'sidemenu')} data-testid="sidemenu" aria-label="Main menu">
      <div className={styles.mobileSidemenuLogo} onClick={() => setMobileMenuOpen(!mobileMenuOpen)} key="hamburger">
        <Icon name="bars" size="xl" />
      </div>

      <NavBarSection>
        <NavBarItemWithoutMenu label="Home" className={styles.grafanaLogo} url={homeUrl}>
          <Branding.MenuLogo />
        </NavBarItemWithoutMenu>
        <NavBarItem className={styles.search} isActive={activeItem === searchItem} link={searchItem}>
          <Icon name="search" size="xl" />
        </NavBarItem>
      </NavBarSection>

      <NavBarSection>
        {topItems.map((link, index) => (
          <NavBarItem
            key={`${link.id}-${index}`}
            isActive={isMatchOrChildMatch(link, activeItem)}
            link={{ ...link, subTitle: undefined, onClick: undefined }}
          >
            {link.icon && <Icon name={link.icon as IconName} size="xl" />}
            {link.img && <img src={link.img} alt={`${link.text} logo`} />}
          </NavBarItem>
        ))}
      </NavBarSection>

      <div className={styles.spacer} />

      <NavBarSection>
        {bottomItems.map((link, index) => (
          <NavBarItem
            key={`${link.id}-${index}`}
            isActive={isMatchOrChildMatch(link, activeItem)}
            reverseMenuDirection
            link={link}
          >
            {link.icon && <Icon name={link.icon as IconName} size="xl" />}
            {link.img && <img src={link.img} alt={`${link.text} logo`} />}
          </NavBarItem>
        ))}
      </NavBarSection>

      {showSwitcherModal && <OrgSwitcher onDismiss={toggleSwitcherModal} />}
      {mobileMenuOpen && (
        <NavBarMenu
          activeItem={activeItem}
          navItems={[searchItem, ...topItems, ...bottomItems]}
          onClose={() => setMobileMenuOpen(false)}
        />
      )}
    </nav>
  );
});

NavBar.displayName = 'NavBar';

const getStyles = (theme: GrafanaTheme2) => ({
  search: css`
    display: none;
    margin-top: ${theme.spacing(5)};

    ${theme.breakpoints.up('md')} {
      display: block;
    }
  `,
  sidemenu: css`
    display: flex;
    flex-direction: column;
    position: fixed;
    z-index: ${theme.zIndex.sidemenu};

    ${theme.breakpoints.up('md')} {
      background: ${theme.colors.background.primary};
      border-right: 1px solid ${theme.components.panel.borderColor};
      padding: 0 0 ${theme.spacing(1)} 0;
      position: relative;
      width: ${theme.components.sidemenu.width}px;
    }

    .sidemenu-hidden & {
      display: none;
    }
  `,
  grafanaLogo: css`
    display: none;
    img {
      height: ${theme.spacing(3.5)};
      width: ${theme.spacing(3.5)};
    }

    ${theme.breakpoints.up('md')} {
      align-items: center;
      display: flex;
      justify-content: center;
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
  `,
});
