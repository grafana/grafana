import { css, cx } from '@emotion/css';
import { FocusScope } from '@react-aria/focus';
import { Location as HistoryLocation } from 'history';
import { cloneDeep } from 'lodash';
import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';

import { GrafanaTheme2, NavModelItem, NavSection } from '@grafana/data';
import { config, locationSearchToObject, locationService, reportInteraction } from '@grafana/runtime';
import { Icon, useTheme2, CustomScrollbar } from '@grafana/ui';
import { getKioskMode } from 'app/core/navigation/kiosk';
import { KioskMode, StoreState } from 'app/types';

import { OrgSwitcher } from '../OrgSwitcher';

import NavBarItem from './NavBarItem';
import { NavBarItemIcon } from './NavBarItemIcon';
import { NavBarItemWithoutMenu } from './NavBarItemWithoutMenu';
import { NavBarMenu } from './NavBarMenu';
import { NavBarMenuPortalContainer } from './NavBarMenuPortalContainer';
import { NavBarToggle } from './NavBarToggle';
import { NavBarContext } from './context';
import {
  enrichConfigItems,
  enrichWithInteractionTracking,
  getActiveItem,
  isMatchOrChildMatch,
  isSearchActive,
  SEARCH_ITEM_ID,
} from './utils';

const onOpenSearch = () => {
  locationService.partial({ search: 'open' });
};

export const NavBar = React.memo(() => {
  const navBarTree = useSelector((state: StoreState) => state.navBarTree);
  const theme = useTheme2();
  const styles = getStyles(theme);
  const location = useLocation();
  const [showSwitcherModal, setShowSwitcherModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAnimationInProgress, setMenuAnimationInProgress] = useState(false);
  const [menuIdOpen, setMenuIdOpen] = useState<string | undefined>(undefined);

  const toggleSwitcherModal = () => {
    setShowSwitcherModal(!showSwitcherModal);
  };

  // Here we need to hack in a "home" and "search" NavModelItem since this is constructed in the frontend
  const searchItem: NavModelItem = enrichWithInteractionTracking(
    {
      id: SEARCH_ITEM_ID,
      onClick: onOpenSearch,
      text: 'Search dashboards',
      icon: 'search',
    },
    menuOpen
  );

  const homeItem: NavModelItem = enrichWithInteractionTracking(
    {
      id: 'home',
      text: 'Home',
      url: config.bootData.user.isSignedIn ? config.appSubUrl || '/' : '/login',
      icon: 'grafana',
    },
    menuOpen
  );

  const navTree = cloneDeep(navBarTree);

  const coreItems = navTree
    .filter((item) => item.section === NavSection.Core)
    .map((item) => enrichWithInteractionTracking(item, menuOpen));
  const pluginItems = navTree
    .filter((item) => item.section === NavSection.Plugin)
    .map((item) => enrichWithInteractionTracking(item, menuOpen));
  const configItems = enrichConfigItems(
    navTree.filter((item) => item.section === NavSection.Config),
    location,
    toggleSwitcherModal
  ).map((item) => enrichWithInteractionTracking(item, menuOpen));

  const activeItem = isSearchActive(location) ? searchItem : getActiveItem(navTree, location.pathname);

  if (shouldHideNavBar(location)) {
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
              onClick={() => {
                reportInteraction('grafana_navigation_expanded');
                setMenuOpen(true);
              }}
            />

            <NavBarMenuPortalContainer />

            <NavBarItemWithoutMenu
              elClassName={styles.grafanaLogoInner}
              label={homeItem.text}
              className={styles.grafanaLogo}
              url={homeItem.url}
              onClick={homeItem.onClick}
            >
              <NavBarItemIcon link={homeItem} />
            </NavBarItemWithoutMenu>

            <CustomScrollbar hideHorizontalTrack hideVerticalTrack showScrollIndicators>
              <ul className={styles.itemList}>
                <NavBarItem className={styles.search} isActive={activeItem === searchItem} link={searchItem} />

                {coreItems.map((link, index) => (
                  <NavBarItem
                    key={`${link.id}-${index}`}
                    isActive={isMatchOrChildMatch(link, activeItem)}
                    link={{ ...link, subTitle: undefined }}
                  />
                ))}

                {pluginItems.length > 0 &&
                  pluginItems.map((link, index) => (
                    <NavBarItem
                      key={`${link.id}-${index}`}
                      isActive={isMatchOrChildMatch(link, activeItem)}
                      link={link}
                    />
                  ))}

                {configItems.map((link, index) => (
                  <NavBarItem
                    key={`${link.id}-${index}`}
                    isActive={isMatchOrChildMatch(link, activeItem)}
                    reverseMenuDirection
                    link={link}
                    className={cx({ [styles.verticalSpacer]: index === 0 })}
                  />
                ))}
              </ul>
            </CustomScrollbar>
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

function shouldHideNavBar(location: HistoryLocation) {
  const queryParams = locationSearchToObject(location.search);
  const kiosk = getKioskMode(queryParams);

  if (kiosk !== KioskMode.Off) {
    return true;
  }

  // Temporary, can be removed after topnav is made permanent
  if ((location.pathname.indexOf('/d/') === 0 && queryParams.editview) || queryParams.editPanel) {
    return true;
  }

  return false;
}

NavBar.displayName = 'NavBar';

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
    width: theme.components.sidemenu.width,
    borderRight: `1px solid ${theme.colors.border.weak}`,

    [theme.breakpoints.down('md')]: {
      height: theme.spacing(7),
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

    [theme.breakpoints.down('md')]: {
      visibility: 'hidden',
    },
  }),
  grafanaLogo: css({
    alignItems: 'stretch',
    display: 'flex',
    flexShrink: 0,
    height: theme.spacing(6),
    justifyContent: 'stretch',

    [theme.breakpoints.down('md')]: {
      visibility: 'hidden',
    },
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
