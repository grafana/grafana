import React, { useState } from 'react';
import { Icon } from '../Icon/Icon';
import { Tooltip } from '../Tooltip/Tooltip';
import { ClickOutsideWrapper } from '../ClickOutsideWrapper/ClickOutsideWrapper';
import { Menu } from '../Menu/Menu';
import { MenuItem } from '../Menu/MenuItem';
import { Popper } from '../Popper/Popper';

/**
 * @internal
 */
export interface Props {
  className: string;
}

/**
 * @internal
 */
export const DropdownMenu: React.FC<Props> = ({ className }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <ClickOutsideWrapper onClick={() => setIsOpen(false)}>
      <Tooltip content="More actions" placement="top">
        <div className={className} ref={setAnchorEl} onClick={() => setIsOpen(!isOpen)}>
          <Icon name="ellipsis-v" className="panel-chrome-bubble-menu-icon" />
        </div>
      </Tooltip>
      {isOpen && (
        <Popper anchorEl={anchorEl}>
          <Menu>
            <MenuItem label="Inspect" icon="info-circle" shortcut="i" />
            <MenuItem label="Explore" icon="compass" shortcut="e" />
            <MenuItem label="Duplicate" icon="bell" shortcut="d" />
            <MenuItem label="Remove" icon="trash-alt" shortcut="r" />
          </Menu>
        </Popper>
      )}
    </ClickOutsideWrapper>
  );
};
