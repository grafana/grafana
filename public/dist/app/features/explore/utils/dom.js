// Node.closest() polyfill
if ('Element' in window && !Element.prototype.closest) {
    Element.prototype.closest = function (s) {
        var matches = (this.document || this.ownerDocument).querySelectorAll(s);
        var el = this;
        var i;
        // eslint-disable-next-line
        do {
            i = matches.length;
            // eslint-disable-next-line
            while (--i >= 0 && matches.item(i) !== el) { }
            el = el.parentElement;
        } while (i < 0 && el);
        return el;
    };
}
export function getPreviousCousin(node, selector) {
    var sibling = node.parentElement.previousSibling;
    var el;
    while (sibling) {
        el = sibling.querySelector(selector);
        if (el) {
            return el;
        }
        sibling = sibling.previousSibling;
    }
    return undefined;
}
export function getNextCharacter(global) {
    if (global === void 0) { global = window; }
    var selection = global.getSelection();
    if (!selection.anchorNode) {
        return null;
    }
    var range = selection.getRangeAt(0);
    var text = selection.anchorNode.textContent;
    var offset = range.startOffset;
    return text.substr(offset, 1);
}
//# sourceMappingURL=dom.js.map