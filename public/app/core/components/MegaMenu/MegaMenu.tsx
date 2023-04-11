import { css } from '@emotion/css';
import { cloneDeep } from 'lodash';
import React from 'react';
import { useLocation } from 'react-router-dom';

import { GrafanaTheme2, NavSection } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';
import { useSelector } from 'app/types';

import { NavBarMenu } from './NavBarMenu';
import { enrichConfigItems, enrichWithInteractionTracking, getActiveItem } from './utils';

export interface Props {
  onClose: () => void;
  searchBarHidden?: boolean;
}

export const MegaMenu = React.memo<Props>(({ onClose, searchBarHidden }) => {
  const navBarTree = useSelector((state) => state.navBarTree);
  const theme = useTheme2();
  const styles = getStyles(theme);
  const location = useLocation();

  const navTree = cloneDeep(navBarTree);

  const coreItems = navTree
    .filter((item) => item.section === NavSection.Core || item.section === NavSection.Plugin)
    .map((item) => enrichWithInteractionTracking(item, true));
  const configItems = enrichConfigItems(
    navTree.filter((item) => item.section === NavSection.Config && item && item.id !== 'help' && item.id !== 'profile'),
    location
  ).map((item) => enrichWithInteractionTracking(item, true));

  const navItems = [...coreItems, ...configItems];

  const activeItem = getActiveItem(navItems, location.pathname);

  return (
    <div className={styles.menuWrapper}>
      <NavBarMenu activeItem={activeItem} navItems={navItems} onClose={onClose} searchBarHidden={searchBarHidden} />
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
