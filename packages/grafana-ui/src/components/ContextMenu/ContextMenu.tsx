import React, { useRef, useState, useLayoutEffect } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { useClickAway } from 'react-use';
import { Portal } from '../Portal/Portal';
import { Menu, MenuProps } from '../Menu/Menu';

export interface ContextMenuProps {
  /** Starting horizontal position for the menu */
  x: number;
  /** Starting vertical position for the menu */
  y: number;
  /** Callback for closing the menu */
  onClose?: () => void;
  /** RenderProp function that returns menu items to display */
  renderMenu: () => React.ReactElement<MenuProps>;
  /** A function that returns header element */
  renderHeader?: () => React.ReactNode;
}

export const ContextMenu: React.FC<ContextMenuProps> = React.memo(({ x, y, onClose, renderMenu, renderHeader }) => {
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
  // console.log(renderMenu);
  const header = renderHeader && renderHeader();
  const menu = renderMenu();

  return (
    <Portal>
      <Menu
        header={header}
        ref={menuRef}
        style={positionStyles}
        ariaLabel={selectors.components.Menu.MenuComponent('Context')}
        onClick={onClose}
      >
        {menu}
      </Menu>
    </Portal>
  );
});

ContextMenu.displayName = 'ContextMenu';
