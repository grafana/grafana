import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { css, cx } from '@emotion/css';
import { cloneDeep } from 'lodash';
import { GrafanaTheme2, NavModelItem, NavSection } from '@grafana/data';
import { CustomScrollbar, Icon, IconName, useTheme2 } from '@grafana/ui';
import { config, locationService } from '@grafana/runtime';
import { getKioskMode } from 'app/core/navigation/kiosk';
import { KioskMode, StoreState } from 'app/types';
import {
  enrichConfigItems,
  getActiveItem,
  isMatchOrChildMatch,
  isSearchActive,
  SEARCH_ITEM_ID,
  NAV_MENU_PORTAL_CONTAINER_ID,
} from '../utils';
import { OrgSwitcher } from '../../OrgSwitcher';
import { NavBarMenu } from './NavBarMenu';
import NavBarItem from './NavBarItem';
import { useSelector } from 'react-redux';
import { NavBarItemWithoutMenu } from './NavBarItemWithoutMenu';
import { NavBarContext } from '../context';
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
  const scrollTopRef = useRef<HTMLDivElement>(null);
  const scrollBottomRef = useRef<HTMLDivElement>(null);
  const [showScrollTopIndicator, setShowTopScrollIndicator] = useState(false);
  const [showScrollBottomIndicator, setShowBottomScrollIndicator] = useState(false);

  useEffect(() => {
    const intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.target === scrollTopRef.current) {
          setShowTopScrollIndicator(!entry.isIntersecting);
        } else if (entry.target === scrollBottomRef.current) {
          setShowBottomScrollIndicator(!entry.isIntersecting);
        }
      });
    });
    [scrollTopRef, scrollBottomRef].forEach((ref) => {
      if (ref.current) {
        intersectionObserver.observe(ref.current);
      }
    });
    return () => intersectionObserver.disconnect();
  }, []);

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
          <div id={NAV_MENU_PORTAL_CONTAINER_ID} className={styles.menuPortalContainer} />

          <div className={styles.mobileSidemenuLogo} onClick={() => setMenuOpen(!menuOpen)} key="hamburger">
            <Icon name="bars" size="xl" />
          </div>

          <NavBarToggle
            className={styles.menuExpandIcon}
            isExpanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          />

          <ul className={styles.itemList}>
            <NavBarItemWithoutMenu
              isActive={isMatchOrChildMatch(homeItem, activeItem)}
              label="Home"
              elClassName={styles.grafanaLogoInner}
              className={styles.grafanaLogo}
              url={homeItem.url}
            >
              <Icon name="grafana" size="xl" />
            </NavBarItemWithoutMenu>

            <CustomScrollbar
              className={cx(styles.scrollContainer, {
                [styles.scrollTopVisible]: showScrollTopIndicator,
                [styles.scrollBottomVisible]: showScrollBottomIndicator,
              })}
              hideVerticalTrack
              hideHorizontalTrack
            >
              <div className={styles.scrollContent}>
                <div className={styles.scrollTopMarker} ref={scrollTopRef}></div>
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
                <div className={styles.scrollBottomMarker} ref={scrollBottomRef} />
              </div>
            </CustomScrollbar>

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
  'scrollTopMarker, scrollBottomMarker': css({
    height: theme.spacing(1),
    left: 0,
    position: 'absolute',
    pointerEvents: 'none',
    right: 0,
  }),
  scrollTopMarker: css({
    top: 0,
  }),
  scrollBottomMarker: css({
    bottom: 0,
  }),
  scrollContent: css({
    position: 'relative',
  }),
  scrollContainer: css({
    '&:before, &:after': {
      content: "''",
      color: theme.colors.text.primary,
      position: 'absolute',
      left: 0,
      right: 0,
      height: theme.spacing(6),
      opacity: 0,
      pointerEvents: 'none',
      transition: 'opacity 0.2s ease-in-out',
      zIndex: theme.zIndex.sidemenu - 1,
    },
    '&:before': {
      borderTop: `1px solid ${theme.colors.border.medium}`,
      top: 0,
      background: `linear-gradient(0deg, transparent, ${theme.colors.background.canvas})`,
    },
    '&:after': {
      borderBottom: `1px solid ${theme.colors.border.medium}`,
      bottom: 0,
      background: `linear-gradient(0deg, ${theme.colors.background.canvas}, transparent)`,
    },
  }),
  scrollTopVisible: css({
    '&:before': {
      opacity: 1,
    },
  }),
  scrollBottomVisible: css({
    '&:after': {
      opacity: 1,
    },
  }),
});
