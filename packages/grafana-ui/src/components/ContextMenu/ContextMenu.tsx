import React, { useRef, useState, useLayoutEffect, useCallback } from 'react';
import { selectors } from '@grafana/e2e-selectors';
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
  itemsGroup?: MenuItemsGroup[];
  /** A function that returns header element */
  renderHeader?: () => React.ReactNode;
}

export const ContextMenu: React.FC<ContextMenuProps> = React.memo(({ x, y, onClose, itemsGroup, renderHeader }) => {
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
      <Menu
        header={header}
        ref={menuRef}
        style={positionStyles}
        ariaLabel={selectors.components.Menu.MenuComponent('Context')}
      >
        {itemsGroup?.map((group, index) => (
          <MenuGroup key={`${group.label}${index}`} label={group.label} ariaLabel={group.label}>
            {(group.items || []).map((item) => (
              <MenuItem
                key={`${item.label}`}
                url={item.url}
                label={item.label}
                ariaLabel={item.label}
                target={item.target}
                icon={item.icon}
                active={item.active}
                onClick={onClick}
              />
            ))}
          </MenuGroup>
        ))}
      </Menu>
    </Portal>
  );
});

ContextMenu.displayName = 'ContextMenu';
