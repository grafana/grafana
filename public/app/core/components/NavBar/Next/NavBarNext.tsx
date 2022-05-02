import { css, cx } from '@emotion/css';
import { FocusScope } from '@react-aria/focus';
import { cloneDeep } from 'lodash';
import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';

import { GrafanaTheme2, NavModelItem, NavSection } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { Icon, IconName, useTheme2 } from '@grafana/ui';
import { Branding } from 'app/core/components/Branding/Branding';
import { getKioskMode } from 'app/core/navigation/kiosk';
import { KioskMode, StoreState } from 'app/types';

import { OrgSwitcher } from '../../OrgSwitcher';
import { NavBarContext } from '../context';
import { enrichConfigItems, getActiveItem, isMatchOrChildMatch, isSearchActive, SEARCH_ITEM_ID } from '../utils';

import NavBarItem from './NavBarItem';
import { NavBarItemWithoutMenu } from './NavBarItemWithoutMenu';
import { NavBarMenu } from './NavBarMenu';
import { NavBarMenuPortalContainer } from './NavBarMenuPortalContainer';
import { NavBarScrollContainer } from './NavBarScrollContainer';
import { NavBarToggle } from './NavBarToggle';

const onOpenSearch = () => {
  locationService.partial({ search: 'open' });
};

const searchItem: NavModelItem = {
  id: SEARCH_ITEM_ID,
  onClick: onOpenSearch,
  text: 'Search Dashboards',
  icon: 'search',
};

// Here we need to hack in a "home" NavModelItem since this is constructed in the frontend
const homeItem: NavModelItem = {
  id: 'home',
  text: 'Home',
  url: config.appSubUrl || '/',
  icon: 'grafana',
};

export const NavBarNext = React.memo(() => {
  const navBarTree = useSelector((state: StoreState) => state.navBarTree);
  const theme = useTheme2();
  const styles = getStyles(theme);
  const location = useLocation();
  const kiosk = getKioskMode();
  const [showSwitcherModal, setShowSwitcherModal] = useState(false);
  const toggleSwitcherModal = () => {
    setShowSwitcherModal(!showSwitcherModal);
  };
  const navTree = cloneDeep(navBarTree);
  navTree.unshift(homeItem);

  const coreItems = navTree.filter((item) => item.section === NavSection.Core);
  const pluginItems = navTree.filter((item) => item.section === NavSection.Plugin);
  const configItems = enrichConfigItems(
    navTree.filter((item) => item.section === NavSection.Config),
    location,
    toggleSwitcherModal
  );
  const activeItem = isSearchActive(location) ? searchItem : getActiveItem(navTree, location.pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnimationInProgress, setMenuAnimationInProgress] = useState(false);
  const [menuIdOpen, setMenuIdOpen] = useState<string | undefined>(undefined);

  if (kiosk !== KioskMode.Off) {
    return null;
  }

  return (
    <div className={styles.navWrapper}>
      <nav className={cx(styles.sidemenu, 'sidemenu')} data-testid="sidemenu" aria-label="Main menu">
        <NavBarContext.Provider
          value={{
            menuIdOpen: menuIdOpen,
            setMenuIdOpen: setMenuIdOpen,
          }}
        >
          <FocusScope>
            <div className={styles.mobileSidemenuLogo} onClick={() => setMenuOpen(!menuOpen)} key="hamburger">
              <Icon name="bars" size="xl" />
            </div>

            <NavBarToggle
              className={styles.menuExpandIcon}
              isExpanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            />

            <NavBarMenuPortalContainer />

            <ul className={styles.itemList}>
              <NavBarItemWithoutMenu
                elClassName={styles.grafanaLogoInner}
                label="Home"
                className={styles.grafanaLogo}
                url={homeItem.url}
              >
                <Branding.MenuLogo />
              </NavBarItemWithoutMenu>

              <NavBarScrollContainer>
                <NavBarItem className={styles.search} isActive={activeItem === searchItem} link={searchItem}>
                  <Icon name="search" size="xl" />
                </NavBarItem>

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

                {pluginItems.length > 0 &&
                  pluginItems.map((link, index) => (
                    <NavBarItem
                      key={`${link.id}-${index}`}
                      isActive={isMatchOrChildMatch(link, activeItem)}
                      link={link}
                    >
                      {link.icon && <Icon name={link.icon as IconName} size="xl" />}
                      {link.img && <img src={link.img} alt={`${link.text} logo`} />}
                    </NavBarItem>
                  ))}
              </NavBarScrollContainer>

              {configItems.map((link, index) => (
                <NavBarItem
                  key={`${link.id}-${index}`}
                  isActive={isMatchOrChildMatch(link, activeItem)}
                  reverseMenuDirection
                  link={link}
                  className={cx({ [styles.verticalSpacer]: index === 0 })}
                >
                  {link.icon && <Icon name={link.icon as IconName} size="xl" />}
                  {link.img && <img src={link.img} alt={`${link.text} logo`} />}
                </NavBarItem>
              ))}
            </ul>
          </FocusScope>
        </NavBarContext.Provider>
      </nav>
      {showSwitcherModal && <OrgSwitcher onDismiss={toggleSwitcherModal} />}
      {(menuOpen || menuAnimationInProgress) && (
        <div className={styles.menuWrapper}>
          <NavBarMenu
            activeItem={activeItem}
            isOpen={menuOpen}
            setMenuAnimationInProgress={setMenuAnimationInProgress}
            navItems={[homeItem, searchItem, ...coreItems, ...pluginItems, ...configItems]}
            onClose={() => setMenuOpen(false)}
          />
        </div>
      )}
    </div>
  );
});

NavBarNext.displayName = 'NavBarNext';

const getStyles = (theme: GrafanaTheme2) => ({
  navWrapper: css({
    position: 'relative',
    display: 'flex',

    '.sidemenu-hidden &': {
      display: 'none',
    },
  }),
  sidemenu: css({
    label: 'sidemenu',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.colors.background.primary,
    zIndex: theme.zIndex.sidemenu,
    padding: `${theme.spacing(1)} 0`,
    position: 'relative',
    width: `calc(${theme.spacing(7)} + 1px)`,
    borderRight: `1px solid ${theme.colors.border.weak}`,

    [theme.breakpoints.down('md')]: {
      position: 'fixed',
      paddingTop: '0px',
      backgroundColor: 'inherit',
      borderRight: 0,
    },
  }),
  mobileSidemenuLogo: css({
    alignItems: 'center',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: theme.spacing(2),

    [theme.breakpoints.up('md')]: {
      display: 'none',
    },
  }),
  itemList: css({
    backgroundColor: 'inherit',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    '> *': {
      height: theme.spacing(6),
    },

    [theme.breakpoints.down('md')]: {
      visibility: 'hidden',
    },
  }),
  grafanaLogo: css({
    alignItems: 'stretch',
    display: 'flex',
    flexShrink: 0,
    justifyContent: 'stretch',
  }),
  grafanaLogoInner: css({
    alignItems: 'center',
    display: 'flex',
    height: '100%',
    justifyContent: 'center',
    width: '100%',

    '> div': {
      height: 'auto',
      width: 'auto',
    },
  }),
  search: css({
    display: 'none',
    marginTop: 0,

    [theme.breakpoints.up('md')]: {
      display: 'grid',
    },
  }),
  verticalSpacer: css({
    marginTop: 'auto',
  }),
  hideFromMobile: css({
    [theme.breakpoints.down('md')]: {
      display: 'none',
    },
  }),
  menuWrapper: css({
    position: 'fixed',
    display: 'grid',
    gridAutoFlow: 'column',
    height: '100%',
    zIndex: theme.zIndex.sidemenu,
  }),
  menuExpandIcon: css({
    position: 'absolute',
    top: '43px',
    right: '0px',
    transform: `translateX(50%)`,
  }),
  menuPortalContainer: css({
    zIndex: theme.zIndex.sidemenu,
  }),
});
