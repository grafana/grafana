import { css } from '@emotion/css';
import { cloneDeep } from 'lodash';
import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';

import { GrafanaTheme2, NavModelItem, NavSection } from '@grafana/data';
import { config } from '@grafana/runtime';
import { useTheme2 } from '@grafana/ui';
import { StoreState } from 'app/types';

import { enrichConfigItems, enrichWithInteractionTracking, getActiveItem } from '../NavBar/utils';

import { NavBarMenu } from './NavBarMenu';

export interface Props {
  onClose: () => void;
  searchBarHidden?: boolean;
}

export const MegaMenu = React.memo<Props>(({ onClose, searchBarHidden }) => {
  const navBarTree = useSelector((state: StoreState) => state.navBarTree);
  const theme = useTheme2();
  const styles = getStyles(theme);
  const location = useLocation();
  const [showSwitcherModal, setShowSwitcherModal] = useState(false);

  const toggleSwitcherModal = () => {
    setShowSwitcherModal(!showSwitcherModal);
  };

  const homeItem: NavModelItem = enrichWithInteractionTracking(
    {
      id: 'home',
      text: 'Home',
      url: config.appSubUrl || '/',
      icon: 'home-alt',
    },
    true
  );

  const navTree = cloneDeep(navBarTree);

  const coreItems = navTree
    .filter((item) => item.section === NavSection.Core)
    .map((item) => enrichWithInteractionTracking(item, true));
  const pluginItems = navTree
    .filter((item) => item.section === NavSection.Plugin)
    .map((item) => enrichWithInteractionTracking(item, true));
  const configItems = enrichConfigItems(
    navTree.filter((item) => item.section === NavSection.Config && item && item.id !== 'help' && item.id !== 'profile'),
    location,
    toggleSwitcherModal
  ).map((item) => enrichWithInteractionTracking(item, true));

  const activeItem = getActiveItem(navTree, location.pathname);

  return (
    <div className={styles.menuWrapper}>
      <NavBarMenu
        activeItem={activeItem}
        navItems={[homeItem, ...coreItems, ...pluginItems, ...configItems]}
        onClose={onClose}
        searchBarHidden={searchBarHidden}
      />
    </div>
  );
});

MegaMenu.displayName = 'MegaMenu';

const getStyles = (theme: GrafanaTheme2) => ({
  menuWrapper: css({
    position: 'fixed',
    display: 'grid',
    gridAutoFlow: 'column',
    height: '100%',
    zIndex: theme.zIndex.sidemenu,
  }),
});
