import { cx, css } from '@emotion/css';
import React, { ReactElement } from 'react';
import { useMedia } from 'react-use';

import { GrafanaTheme2, IconName } from '@grafana/data';

import { useStyles2 } from '../../themes';

import { PanelMenu } from './PanelMenu';

interface PanelChromeMenuProps {
  menu: ReactElement | (() => ReactElement);
  title?: string;
  icon?: IconName;
}

const pointerQuery = '(pointer: coarse)';

export function PanelChromeMenu({ menu, title, icon = 'ellipsis-v' }: PanelChromeMenuProps) {
  const styles = useStyles2(getStyles);
  const isTouchDevice = useMedia(pointerQuery);
  // hover menu is only shown on hover when not on touch devices
  const showOnHoverClass = !isTouchDevice ? 'show-on-hover' : '';

  return (
    <PanelMenu
      menu={menu}
      title={title}
      placement="bottom-end"
      menuButtonClass={cx(
        { [styles.hiddenMenu]: !isTouchDevice },
        styles.menuItem,
        'grid-drag-cancel',
        showOnHoverClass
      )}
      icon={icon}
    />
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    hiddenMenu: css({
      visibility: 'hidden',
    }),
    menuItem: css({
      label: 'panel-menu',
      border: 'none',
      background: theme.colors.secondary.main,
      '&:hover': {
        background: theme.colors.secondary.shade,
      },
    }),
  };
}
