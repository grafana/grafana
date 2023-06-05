import { cx } from '@emotion/css';
import React, { ReactElement } from 'react';

import { selectors } from '@grafana/e2e-selectors';

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
  const testId = title ? selectors.components.Panels.Panel.menu(title) : `panel-menu-button`;
  return (
    <Dropdown overlay={menu} placement={placement} offset={offset} onVisibleChange={onVisibleChange}>
      <ToolbarButton
        aria-label={`Menu for panel with ${title ? `title ${title}` : 'no title'}`}
        title="Menu"
        icon="ellipsis-v"
        iconSize="md"
        narrow
        data-testid={testId}
        className={cx(menuButtonClass, dragClassCancel)}
      />
    </Dropdown>
  );
}
