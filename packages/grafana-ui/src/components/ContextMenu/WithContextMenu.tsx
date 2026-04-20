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
  return (
    <>
      {children({
        openMenu: (e) => {
          setIsMenuOpen(true);
          // Keyboard-triggered click events have pageX/pageY of 0 (no pointer position).
          // Fall back to the element's bounding rect so the menu opens near the element.
          if (e.pageX === 0 && e.pageY === 0) {
            const rect = e.currentTarget.getBoundingClientRect();
            setMenuPosition({
              x: rect.left + rect.width / 2,
              y: rect.bottom,
            });
          } else {
            setMenuPosition({
              x: e.pageX,
              y: e.pageY - window.scrollY,
            });
          }
        },
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
