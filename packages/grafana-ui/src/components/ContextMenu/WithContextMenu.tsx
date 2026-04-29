import { useState, type JSX } from 'react';
import * as React from 'react';

import { ContextMenu } from '../ContextMenu/ContextMenu';

/**
 * Anything we can resolve into a viewport `{ x, y }` position for the context menu:
 *   - A React or native pointer event → use `pageX`/`pageY` (legacy, click-driven path)
 *   - A DOM/SVG element              → use the element's bounding-rect center
 *                                      (keyboard-driven path: trigger.focus()+Enter)
 *   - An explicit `{ x, y }` literal → use it directly
 */
export type OpenMenuTrigger = React.MouseEvent | Element | { x: number; y: number };

export interface WithContextMenuProps {
  /** Menu item trigger that accepts openMenu prop */
  children: (props: { openMenu: (trigger: OpenMenuTrigger) => void }) => JSX.Element;
  /** A function that returns an array of menu items */
  renderMenuItems: () => React.ReactNode;
  /** On menu open focus the first element */
  focusOnOpen?: boolean;
}

/**
 * Resolve any supported `OpenMenuTrigger` to viewport-relative `{ x, y }`
 * coordinates that `<ContextMenu>` can position against.
 *
 * For elements we use the bounding-rect center so the menu appears
 * anchored to the focused control (matters for keyboard activation
 * where there is no pointer position to read).
 */
function resolveTriggerPosition(trigger: OpenMenuTrigger): { x: number; y: number } {
  // narrow the WithContextMenuProps type => trigger: Element
  if (trigger instanceof Element) {
    const rect = trigger.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2 + window.scrollX,
      y: rect.top + rect.height / 2,
    };
  }

  // trigger: MouseEvent
  if ('pageX' in trigger && 'pageY' in trigger) {
    return { x: trigger.pageX, y: trigger.pageY - window.scrollY };
  }

  // Manually defined coordinates
  return { x: trigger.x, y: trigger.y };
}

export const WithContextMenu = ({ children, renderMenuItems, focusOnOpen = true }: WithContextMenuProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  return (
    <>
      {children({
        openMenu: (trigger) => {
          setIsMenuOpen(true);
          setMenuPosition(resolveTriggerPosition(trigger));
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
