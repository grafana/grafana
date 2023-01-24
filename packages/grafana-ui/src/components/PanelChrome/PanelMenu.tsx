import { cx } from '@emotion/css';
import React, { ReactElement } from 'react';

import { Dropdown } from '../Dropdown/Dropdown';
import { ToolbarButton } from '../ToolbarButton';
import { TooltipPlacement } from '../Tooltip';

interface PanelMenuProps {
  menu: ReactElement | (() => ReactElement);
  menuButtonClass?: string;
  dragClassCancel?: string;
  title?: string;
  placement?: TooltipPlacement;
  offset?: [number, number];
}

export function PanelMenu({
  menu,
  title,
  placement = 'bottom',
  offset,
  dragClassCancel,
  menuButtonClass,
}: PanelMenuProps) {
  return (
    <Dropdown overlay={menu} placement={placement} offset={offset}>
      <ToolbarButton
        aria-label={`Menu for panel with ${title ? `title ${title}` : 'no title'}`}
        title="Menu"
        icon="ellipsis-v"
        narrow
        data-testid="panel-menu-button"
        className={cx(menuButtonClass, dragClassCancel, 'show-on-hover')}
      />
    </Dropdown>
  );
}
