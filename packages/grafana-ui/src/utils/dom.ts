// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace DOMUtil {
  // Node.closest() polyfill
  if ('Element' in window && !Element.prototype.closest) {
    Element.prototype.closest = function(this: any, s: string) {
      const matches = (this.document || this.ownerDocument).querySelectorAll(s);
      let el = this;
      let i;
      // eslint-disable-next-line
      do {
        i = matches.length;
        // eslint-disable-next-line
        while (--i >= 0 && matches.item(i) !== el) {}
        el = el.parentElement;
      } while (i < 0 && el);
      return el;
    };
  }

  export function getPreviousCousin(node: any, selector: string) {
    let sibling = node.parentElement.previousSibling;
    let el;
    while (sibling) {
      el = sibling.querySelector(selector);
      if (el) {
        return el;
      }
      sibling = sibling.previousSibling;
    }
    return undefined;
  }

  export function getNextCharacter(global?: any) {
    const selection = (global || window).getSelection();
    if (!selection || !selection.anchorNode) {
      return null;
    }

    const range = selection.getRangeAt(0);
    const text = selection.anchorNode.textContent;
    const offset = range.startOffset;
    return text!.substr(offset, 1);
  }
}
