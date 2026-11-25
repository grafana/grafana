import { useState, type JSX } from 'react';
import * as React from 'react';

import { ContextMenu } from '../ContextMenu/ContextMenu';

/**
 * Anything we can resolve into a viewport `{ x, y }` position for the context menu:
 *   - A React or native pointer event → use `pageX`/`pageY` (legacy, click-driven path);
 *                                       keyboard-synthesized clicks (`detail` 0) anchor
 *                                       to the event's `currentTarget` element instead
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
  if (isElement(trigger)) {
    const rect = trigger.getBoundingClientRect();
    // the trigger's own window: it can render in another one than this, such as a Document Picture-in-Picture window
    const { scrollX } = trigger.ownerDocument.defaultView ?? window;
    return {
      x: rect.left + rect.width / 2 + scrollX,
      y: rect.top + rect.height / 2,
    };
  }

  // trigger: MouseEvent
  if ('pageX' in trigger && 'pageY' in trigger) {
    // Keyboard or assistive-tech activation of a native control dispatches a
    // click without a pointer position (`detail` is 0 and the coordinates sit
    // at the viewport origin), so anchor to the element that fired the event
    // instead of placing the menu in the top-left corner.
    if (trigger.detail === 0 && isElement(trigger.currentTarget)) {
      return resolveTriggerPosition(trigger.currentTarget);
    }
    const { scrollY } =
      (isElement(trigger.currentTarget) ? trigger.currentTarget.ownerDocument.defaultView : null) ?? window;
    return { x: trigger.pageX, y: trigger.pageY - scrollY };
  }

  // Manually defined coordinates
  return { x: trigger.x, y: trigger.y };
}

/**
 * Whether `value` is an element of any window. `instanceof Element` is false for elements of another window, such as a
 * Document Picture-in-Picture window.
 */
function isElement(value: unknown): value is Element {
  return typeof value === 'object' && value !== null && 'nodeType' in value && value.nodeType === Node.ELEMENT_NODE;
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
