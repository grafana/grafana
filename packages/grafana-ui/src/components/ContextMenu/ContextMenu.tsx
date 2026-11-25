import { useEffect, useRef, useState, useLayoutEffect } from 'react';
import * as React from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { Menu } from '../Menu/Menu';
import { Portal } from '../Portal/Portal';

export interface ContextMenuProps {
  /** Starting horizontal position for the menu */
  x: number;
  /** Starting vertical position for the menu */
  y: number;
  /** Callback for closing the menu */
  onClose?: () => void;
  /** On menu open focus the first element */
  focusOnOpen?: boolean;
  /** RenderProp function that returns menu items to display */
  renderMenuItems?: () => React.ReactNode;
  /** A function that returns header element */
  renderHeader?: () => React.ReactNode;
}

/**
 * A menu displaying additional options when it's not possible to show them at all times due to a space constraint.
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/overlays-contextmenu--docs
 */
export const ContextMenu = React.memo(
  ({ x, y, onClose, focusOnOpen = true, renderMenuItems, renderHeader }: ContextMenuProps) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [positionStyles, setPositionStyles] = useState({});

    useLayoutEffect(() => {
      const menuElement = menuRef.current;
      if (menuElement) {
        const rect = menuElement.getBoundingClientRect();
        const OFFSET = 5;
        // the menu can render in another window than this one, such as a Document Picture-in-Picture window
        const { innerWidth, innerHeight } = menuElement.ownerDocument.defaultView ?? window;
        const collisions = {
          right: innerWidth < x + rect.width,
          bottom: innerHeight < y + rect.height + OFFSET,
        };

        setPositionStyles({
          position: 'fixed',
          left: collisions.right ? x - rect.width - OFFSET : x - OFFSET,
          top: Math.max(0, collisions.bottom ? y - rect.height - OFFSET : y + OFFSET),
        });
      }
    }, [x, y]);

    // Close on presses away from the menu, in the window it renders in. (react-use's useClickAway listens in this
    // window only.)
    useEffect(() => {
      const menuDocument = menuRef.current?.ownerDocument ?? document;
      const onPressAway = (event: Event) => {
        const menu = menuRef.current;
        if (menu && isNode(event.target) && !menu.contains(event.target)) {
          onClose?.();
        }
      };
      menuDocument.addEventListener('mousedown', onPressAway);
      menuDocument.addEventListener('touchstart', onPressAway);
      return () => {
        menuDocument.removeEventListener('mousedown', onPressAway);
        menuDocument.removeEventListener('touchstart', onPressAway);
      };
    }, [onClose]);
    const header = renderHeader?.();
    const menuItems = renderMenuItems?.();
    const onOpen = (setFocusedItem: (a: number) => void) => {
      if (focusOnOpen) {
        setFocusedItem(0);
      }
    };
    const onKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
      }
    };

    return (
      <Portal>
        <Menu
          header={header}
          ref={menuRef}
          style={positionStyles}
          ariaLabel={selectors.components.Menu.MenuComponent('Context')}
          onOpen={onOpen}
          onClick={onClose}
          onKeyDown={onKeyDown}
        >
          {menuItems}
        </Menu>
      </Portal>
    );
  }
);

ContextMenu.displayName = 'ContextMenu';

/**
 * Whether `value` is a node of any window. `instanceof Node` is false for another window's nodes, and that window can
 * hold this window's nodes too: a node moved to another document keeps its prototype.
 */
function isNode(value: unknown): value is Node {
  return typeof value === 'object' && value !== null && 'nodeType' in value && typeof value.nodeType === 'number';
}
