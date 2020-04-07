import React, { useState } from 'react';
import { ContextMenu, ContextMenuGroup } from '../ContextMenu/ContextMenu';

interface WithContextMenuProps {
  children: (props: { openMenu: React.MouseEventHandler<HTMLElement> }) => JSX.Element;
  getContextMenuItems: () => ContextMenuGroup[];
}

export const WithContextMenu: React.FC<WithContextMenuProps> = ({ children, getContextMenuItems }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPosition, setMenuPositon] = useState({ x: 0, y: 0 });

  return (
    <>
      {children({
        openMenu: e => {
          setIsMenuOpen(true);
          setMenuPositon({
            x: e.pageX,
            y: e.pageY,
          });
        },
      })}

      {isMenuOpen && (
        <ContextMenu
          onClose={() => setIsMenuOpen(false)}
          x={menuPosition.x}
          y={menuPosition.y}
          items={getContextMenuItems()}
        />
      )}
    </>
  );
};
