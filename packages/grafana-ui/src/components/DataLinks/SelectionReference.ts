import { VirtualElement } from '@popperjs/core/lib/types';

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
