import { useState, type JSX } from 'react';
import * as React from 'react';

import { ContextMenu } from '../ContextMenu/ContextMenu';

export type OpenMenuFunction = <E extends HTMLElement>(e: React.KeyboardEvent<E> | React.MouseEvent<E>) => void;

export interface WithContextMenuProps {
  /** Menu item trigger that accepts openMenu prop */
  children: (props: { openMenu: OpenMenuFunction }) => JSX.Element;
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
          let x = 0;
          let y = 0;
          if ('pageX' in e) {
            x = e.pageX;
            y = e.pageY - window.scrollY;
          } else if ('currentTarget' in e) {
            const target = e.currentTarget;
            const rect = target.getBoundingClientRect();
            x = rect.left + rect.width / 2 + window.scrollX;
            y = rect.top + rect.height / 2 + window.scrollY;
          }
          setIsMenuOpen(true);
          setMenuPosition({ x, y });
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
