import React, { useRef, useState, useLayoutEffect, useCallback } from 'react';
import { useClickAway } from 'react-use';
import { Portal } from '../Portal/Portal';
import { Menu } from '../Menu/Menu';
import { MenuGroup, MenuItemsGroup } from '../Menu/MenuGroup';
import { MenuItem } from '../Menu/MenuItem';

export interface ContextMenuProps {
  /** Starting horizontal position for the menu */
  x: number;
  /** Starting vertical position for the menu */
  y: number;
  /** Callback for closing the menu */
  onClose?: () => void;
  /** List of the menu items to display */
  group?: MenuItemsGroup;
  /** A function that returns header element */
  renderHeader?: () => React.ReactNode;
}

export const ContextMenu: React.FC<ContextMenuProps> = React.memo(({ x, y, onClose, group, renderHeader }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [positionStyles, setPositionStyles] = useState({});

  useLayoutEffect(() => {
    const menuElement = menuRef.current;
    if (menuElement) {
      const rect = menuElement.getBoundingClientRect();
      const OFFSET = 5;
      const collisions = {
        right: window.innerWidth < x + rect.width,
        bottom: window.innerHeight < rect.bottom + rect.height + OFFSET,
      };

      setPositionStyles({
        position: 'fixed',
        left: collisions.right ? x - rect.width - OFFSET : x - OFFSET,
        top: collisions.bottom ? y - rect.height - OFFSET : y + OFFSET,
      });
    }
  }, [x, y]);

  useClickAway(menuRef, () => {
    if (onClose) {
      onClose();
    }
  });

  const onClick = useCallback(() => {
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  const header = renderHeader && renderHeader();
  return (
    <Portal>
      <Menu header={header} ref={menuRef} style={positionStyles}>
        {group?.item && (
          <MenuGroup label={group.label}>
            {group.item.map((item) => {
              <MenuItem
                url={item.url}
                label={item.label}
                target={item.target}
                icon={item.icon}
                active={item.active}
                onClick={onClick}
              />;
            })}
          </MenuGroup>
        )}
      </Menu>
    </Portal>
  );
});

ContextMenu.displayName = 'ContextMenu';
