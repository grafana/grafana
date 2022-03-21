import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { css, cx } from '@emotion/css';
import { cloneDeep } from 'lodash';
import { GrafanaTheme2, NavModelItem, NavSection } from '@grafana/data';
import { Icon, IconName, useTheme2 } from '@grafana/ui';
import { locationService } from '@grafana/runtime';
import { getKioskMode } from 'app/core/navigation/kiosk';
import config from 'app/core/config';
import { KioskMode, StoreState } from 'app/types';
import { enrichConfigItems, getActiveItem, isMatchOrChildMatch, isSearchActive, SEARCH_ITEM_ID } from './utils';
import { OrgSwitcher } from '../OrgSwitcher';
import { NavBarSection } from './NavBarSection';
import { NavBarMenu } from './NavBarMenu';
import NavBarItem from './NavBarItem';
import { NavBarItemWithoutMenu } from './NavBarItemWithoutMenu';
import { Branding } from '../Branding/Branding';
import { useSelector } from 'react-redux';

const onOpenSearch = () => {
  locationService.partial({ search: 'open' });
};

const searchItem: NavModelItem = {
  id: SEARCH_ITEM_ID,
  onClick: onOpenSearch,
  text: 'Search dashboards',
  icon: 'search',
};

export const NavBarNext = React.memo(() => {
  const navBarTree = useSelector((state: StoreState) => state.navBarTree);
  const homeUrl = config.appSubUrl || '/';
  const theme = useTheme2();
  const styles = getStyles(theme);
  const location = useLocation();
  const kiosk = getKioskMode();
  const [showSwitcherModal, setShowSwitcherModal] = useState(false);
  const toggleSwitcherModal = () => {
    setShowSwitcherModal(!showSwitcherModal);
  };
  const navTree = cloneDeep(navBarTree);

  // Here we need to hack in a "home" NavModelItem since this is constructed in the frontend
  const homeLink: NavModelItem = {
    text: 'Home',
    url: config.appSubUrl || '/',
  };
  navTree.unshift(homeLink);

  const coreItems = navTree.filter((item) => item.section === NavSection.Core);
  const pluginItems = navTree.filter((item) => item.section === NavSection.Plugin);
  const configItems = enrichConfigItems(
    navTree.filter((item) => item.section === NavSection.Config),
    location,
    toggleSwitcherModal
  );
  const activeItem = isSearchActive(location) ? searchItem : getActiveItem(navTree, location.pathname);
  const [menuOpen, setMenuOpen] = useState(false);

  if (kiosk !== KioskMode.Off) {
    return null;
  }

  return (
    <nav className={cx(styles.sidemenu, 'sidemenu')} data-testid="sidemenu" aria-label="Main menu">
      <div className={styles.mobileSidemenuLogo} onClick={() => setMenuOpen(!menuOpen)} key="hamburger">
        <Icon name="bars" size="xl" />
      </div>

      <NavBarSection>
        <NavBarItemWithoutMenu
          isActive={isMatchOrChildMatch(homeLink, activeItem)}
          label="Home"
          className={styles.grafanaLogo}
          url={homeUrl}
        >
          <Branding.MenuLogo />
        </NavBarItemWithoutMenu>
        <NavBarItem className={styles.search} isActive={activeItem === searchItem} link={searchItem}>
          <Icon name="search" size="xl" />
        </NavBarItem>
      </NavBarSection>

      <NavBarSection>
        {coreItems.map((link, index) => (
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

      <NavBarSection>
        {pluginItems.map((link, index) => (
          <NavBarItem key={`${link.id}-${index}`} isActive={isMatchOrChildMatch(link, activeItem)} link={link}>
            {link.icon && <Icon name={link.icon as IconName} size="xl" />}
            {link.img && <img src={link.img} alt={`${link.text} logo`} />}
          </NavBarItem>
        ))}
      </NavBarSection>

      <div className={styles.spacer} />

      <NavBarSection>
        {configItems.map((link, index) => (
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
      {menuOpen && (
        <NavBarMenu
          activeItem={activeItem}
          navItems={[searchItem, ...coreItems, ...pluginItems, ...configItems]}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </nav>
  );
});

NavBarNext.displayName = 'NavBarNext';

const getStyles = (theme: GrafanaTheme2) => ({
  search: css`
    display: none;
    margin-top: 0;

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
      position: relative;
      width: ${theme.components.sidemenu.width}px;
    }

    .sidemenu-hidden & {
      display: none;
    }
  `,
  grafanaLogo: css`
    align-items: center;
    display: flex;
    img {
      height: ${theme.spacing(3)};
      width: ${theme.spacing(3)};
    }
    justify-content: center;
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
