import { type VirtualElement } from '@popperjs/core/lib/types';

/**
 * A floating-ui/popper virtual reference element anchored to the current text selection (caret).
 * Used to position floating menus (suggestions, typeahead) relative to where the user is typing
 * inside a contenteditable Slate editor.
 */
export class SelectionReference implements VirtualElement {
  getBoundingClientRect() {
    const selection = window.getSelection();
    const node = selection && selection.anchorNode;

    if (node && node.parentElement) {
      const rect = node.parentElement.getBoundingClientRect();
      return rect;
    }

    const fallbackDOMRect: DOMRect = {
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => {},
    };
    return fallbackDOMRect;
  }

  get clientWidth() {
    return this.getBoundingClientRect().width;
  }

  get clientHeight() {
    return this.getBoundingClientRect().height;
  }
}
