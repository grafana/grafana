import { useState, type JSX } from 'react';
import * as React from 'react';

import { ContextMenu } from '../ContextMenu/ContextMenu';

export interface WithContextMenuProps {
  /** Menu item trigger that accepts openMenu prop */
  children: (props: { openMenu: React.MouseEventHandler<HTMLElement> }) => JSX.Element;
  /** A function that returns an array of menu items */
  renderMenuItems: () => React.ReactNode;
  /** On menu open focus the first element */
  focusOnOpen?: boolean;
}

export const WithContextMenu = ({ children, renderMenuItems, focusOnOpen = true }: WithContextMenuProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  
  const handleOpenMenu = React.useCallback(
    (e: React.MouseEvent<HTMLElement> | { x: number; y: number } | HTMLElement | SVGElement) => {
      setIsMenuOpen(true);
      if (e && 'pageX' in e && 'pageY' in e) {
        // Mouse event
        setMenuPosition({
          x: e.pageX,
          y: e.pageY - window.scrollY,
        });
      } else if (e && 'x' in e && 'y' in e && typeof e.x === 'number') {
        // Position object
        setMenuPosition({
          x: e.x,
          y: e.y,
        });
      } else if (e && 'getBoundingClientRect' in e) {
        // Element - calculate position from element's bounding rect
        const rect = (e as HTMLElement | SVGElement).getBoundingClientRect();
        setMenuPosition({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2 + window.scrollY,
        });
      }
    },
    []
  );

  return (
    <>
      {children({
        openMenu: handleOpenMenu as React.MouseEventHandler<HTMLElement>,
      })}

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
