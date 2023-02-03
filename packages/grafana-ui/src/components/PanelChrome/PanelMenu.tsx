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
  onVisibleChange?: (state: boolean) => void;
}

export function PanelMenu({
  menu,
  title,
  placement = 'bottom',
  offset,
  dragClassCancel,
  menuButtonClass,
  onVisibleChange,
}: PanelMenuProps) {
  return (
    <Dropdown overlay={menu} placement={placement} offset={offset} onVisibleChange={onVisibleChange}>
      <ToolbarButton
        aria-label={`Menu for panel with ${title ? `title ${title}` : 'no title'}`}
        title="Menu"
        icon="ellipsis-v"
        iconSize="md"
        narrow
        data-testid="panel-menu-button"
        className={cx(menuButtonClass, dragClassCancel)}
      />
    </Dropdown>
  );
}
