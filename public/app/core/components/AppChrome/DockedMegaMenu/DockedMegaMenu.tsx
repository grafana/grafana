import { css } from '@emotion/css';
import { useDialog } from '@react-aria/dialog';
import { useOverlay } from '@react-aria/overlays';
import { DOMAttributes } from '@react-types/shared';
import { cloneDeep } from 'lodash';
import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { GrafanaTheme2 } from '@grafana/data';
import { CustomScrollbar, Icon, IconButton, useTheme2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useSelector } from 'app/types';

import { TOP_BAR_LEVEL_HEIGHT } from '../types';

import { NavBarMenuItemWrapper } from './NavBarMenuItemWrapper';
import { enrichWithInteractionTracking, getActiveItem } from './utils';

const MENU_WIDTH = '350px';

export interface Props extends DOMAttributes {
  searchBarHidden?: boolean;
}

export const DockedMegaMenu = React.memo<Props>(({ searchBarHidden, ...restProps }) => {
  const navBarTree = useSelector((state) => state.navBarTree);
  const theme = useTheme2();
  const styles = getStyles(theme, searchBarHidden);
  const location = useLocation();

  const navTree = cloneDeep(navBarTree);

  // Remove profile + help from tree
  const navItems = navTree
    .filter((item) => item.id !== 'profile' && item.id !== 'help')
    .map((item) => enrichWithInteractionTracking(item, true));

  const activeItem = getActiveItem(navItems, location.pathname);

  const { chrome } = useGrafana();
  const state = chrome.useState();
  const ref = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  const onMenuClose = () => setIsOpen(false);

  useEffect(() => {
    if (state.megaMenuOpen) {
      setIsOpen(true);
    }
  }, [state.megaMenuOpen]);

  return (
    <div data-testid="navbarmenu" ref={ref} {...restProps} className={styles.container}>
      <div className={styles.mobileHeader}>
        <Icon name="bars" size="xl" />
        <IconButton
          aria-label="Close navigation menu"
          tooltip="Close menu"
          name="times"
          onClick={onMenuClose}
          size="xl"
          variant="secondary"
        />
      </div>
      <nav className={styles.content}>
        <CustomScrollbar showScrollIndicators hideHorizontalTrack>
          <ul className={styles.itemList}>
            {navItems.map((link) => (
              <NavBarMenuItemWrapper link={link} onClose={onMenuClose} activeItem={activeItem} key={link.text} />
            ))}
          </ul>
        </CustomScrollbar>
      </nav>
    </div>
  );
});

DockedMegaMenu.displayName = 'DockedMegaMenu';

const getStyles = (theme: GrafanaTheme2, searchBarHidden?: boolean) => {
  const topPosition = (searchBarHidden ? TOP_BAR_LEVEL_HEIGHT : TOP_BAR_LEVEL_HEIGHT * 2) + 1;

  return {
    container: css({
      display: 'flex',
      bottom: 0,
      flexDirection: 'column',
      left: 0,
      marginRight: theme.spacing(1.5),
      right: 0,
      // Needs to below navbar should we change the navbarFixed? add add a new level?
      zIndex: theme.zIndex.modal,
      position: 'fixed',
      top: searchBarHidden ? 0 : TOP_BAR_LEVEL_HEIGHT,
      backgroundColor: theme.colors.background.primary,
      boxSizing: 'content-box',
      flex: '1 1 0',

      [theme.breakpoints.up('md')]: {
        borderRight: `1px solid ${theme.colors.border.weak}`,
        right: 'unset',
        top: topPosition,
      },
    }),
    content: css({
      display: 'flex',
      flexDirection: 'column',
      flexGrow: 1,
      minHeight: 0,
    }),
    mobileHeader: css({
      display: 'flex',
      justifyContent: 'space-between',
      padding: theme.spacing(1, 1, 1, 2),
      borderBottom: `1px solid ${theme.colors.border.weak}`,

      [theme.breakpoints.up('md')]: {
        display: 'none',
      },
    }),
    itemList: css({
      display: 'grid',
      gridAutoRows: `minmax(${theme.spacing(6)}, auto)`,
      gridTemplateColumns: `minmax(${MENU_WIDTH}, auto)`,
      minWidth: MENU_WIDTH,
    }),
  };
};
