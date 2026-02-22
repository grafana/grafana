import { useState, type JSX } from 'react';
import * as React from 'react';

import { ContextMenu } from '../ContextMenu/ContextMenu';

/**
 * This callback supports several ways to provide the x/y coordinates to open the context menu:
 * - MouseEvent, to open the menu at the mouse position
 * - SyntheticEvent, to open the menu at the location of the currentTarget element for non-mouse events
 * - An object with x and y coordinates to open the menu at a specific position, for other use-cases
 */
export type WithContextMenuOpenMenuCallback = (
  e:
    | React.MouseEvent<HTMLElement | SVGElement>
    | React.SyntheticEvent<HTMLElement | SVGElement>
    | { x: number; y: number }
    | undefined
) => void;

export interface WithContextMenuProps {
  /** Menu item trigger that accepts openMenu prop */
  children: (props: { openMenu: WithContextMenuOpenMenuCallback }) => JSX.Element;
  /** A function that returns an array of menu items */
  renderMenuItems: () => React.ReactNode;
  /** On menu open focus the first element */
  focusOnOpen?: boolean;
}

export const WithContextMenu = ({ children, renderMenuItems, focusOnOpen = true }: WithContextMenuProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });

  const handleOpenMenu: WithContextMenuOpenMenuCallback = React.useCallback((e) => {
    if (!e) {
      return;
    }

    setIsMenuOpen(true);

    if ('pageX' in e && 'pageY' in e) {
      // Mouse event
      setMenuPosition({
        x: e.pageX,
        y: e.pageY - window.scrollY,
      });
    } else if ('currentTarget' in e) {
      // SyntheticEvent - calculate position from element's bounding rect
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect) {
        setMenuPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2 + window.scrollY,
        });
      }
    } else if ('x' in e && 'y' in e && typeof e.x === 'number') {
      // Position object
      setMenuPosition({
        x: e.x,
        y: e.y,
      });
    } else if (process.env.NODE_ENV !== 'production') {
      console.warn('WithContextMenu: Unsupported parameter to openMenu:', e);
    }
  }, []);

  return (
    <>
      {children({ openMenu: handleOpenMenu })}

      {isMenuOpen && (
        <ContextMenu
          onClose={() => setIsMenuOpen(false)}
          x={menuPosition.x}
          y={menuPosition.y}
          renderMenuItems={renderMenuItems}
          focusOnOpen={focusOnOpen}
        />
      )}
    </>
  );
};
