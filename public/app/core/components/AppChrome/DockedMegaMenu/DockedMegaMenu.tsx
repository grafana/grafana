import { css } from '@emotion/css';
import { DOMAttributes } from '@react-types/shared';
import { cloneDeep } from 'lodash';
import React, { forwardRef } from 'react';
import { useLocation } from 'react-router-dom';

import { GrafanaTheme2 } from '@grafana/data';
import { CustomScrollbar, Icon, IconButton, useStyles2 } from '@grafana/ui';
import { useSelector } from 'app/types';

import { NavBarMenuItemWrapper } from './NavBarMenuItemWrapper';
import { enrichWithInteractionTracking, getActiveItem } from './utils';

export const MENU_WIDTH = '350px';

export interface Props extends DOMAttributes {
  onClose: () => void;
}

export const DockedMegaMenu = React.memo(
  forwardRef<HTMLDivElement, Props>(({ onClose, ...restProps }, ref) => {
    const navBarTree = useSelector((state) => state.navBarTree);
    const styles = useStyles2(getStyles);
    const location = useLocation();

    const navTree = cloneDeep(navBarTree);

    // Remove profile + help from tree
    const navItems = navTree
      .filter((item) => item.id !== 'profile' && item.id !== 'help')
      .map((item) => enrichWithInteractionTracking(item, true));

    const activeItem = getActiveItem(navItems, location.pathname);

    return (
      <div data-testid="navbarmenu" ref={ref} {...restProps}>
        <div className={styles.mobileHeader}>
          <Icon name="bars" size="xl" />
          <IconButton
            aria-label="Close navigation menu"
            tooltip="Close menu"
            name="times"
            onClick={onClose}
            size="xl"
            variant="secondary"
          />
        </div>
        <nav className={styles.content}>
          <CustomScrollbar showScrollIndicators hideHorizontalTrack>
            <ul className={styles.itemList}>
              {navItems.map((link) => (
                <NavBarMenuItemWrapper link={link} onClose={onClose} activeItem={activeItem} key={link.text} />
              ))}
            </ul>
          </CustomScrollbar>
        </nav>
      </div>
    );
  })
);

DockedMegaMenu.displayName = 'DockedMegaMenu';

const getStyles = (theme: GrafanaTheme2) => ({
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
});
