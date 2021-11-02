var SelectionReference = /** @class */ (function () {
    function SelectionReference() {
    }
    SelectionReference.prototype.getBoundingClientRect = function () {
        var selection = window.getSelection();
        var node = selection && selection.anchorNode;
        if (node && node.parentElement) {
            var rect = node.parentElement.getBoundingClientRect();
            return rect;
        }
        return {
            top: 0,
            left: 0,
            bottom: 0,
            right: 0,
            width: 0,
            height: 0,
        };
    };
    Object.defineProperty(SelectionReference.prototype, "clientWidth", {
        get: function () {
            return this.getBoundingClientRect().width;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(SelectionReference.prototype, "clientHeight", {
        get: function () {
            return this.getBoundingClientRect().height;
        },
        enumerable: false,
        configurable: true
    });
    return SelectionReference;
}());
export { SelectionReference };
//# sourceMappingURL=SelectionReference.js.map