import { __assign, __extends, __rest } from "tslib";
import React, { PureComponent } from 'react';
import Clipboard from 'clipboard';
import { Button } from '../Button';
var ClipboardButton = /** @class */ (function (_super) {
    __extends(ClipboardButton, _super);
    function ClipboardButton() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.setRef = function (elem) {
            _this.elem = elem;
        };
        return _this;
    }
    ClipboardButton.prototype.componentDidMount = function () {
        var _a = this.props, getText = _a.getText, onClipboardCopy = _a.onClipboardCopy, onClipboardError = _a.onClipboardError;
        this.clipboard = new Clipboard(this.elem, {
            text: function () { return getText(); },
        });
        this.clipboard.on('success', function (e) {
            onClipboardCopy && onClipboardCopy(e);
        });
        this.clipboard.on('error', function (e) {
            onClipboardError && onClipboardError(e);
        });
    };
    ClipboardButton.prototype.componentWillUnmount = function () {
        this.clipboard.destroy();
    };
    ClipboardButton.prototype.render = function () {
        var _a = this.props, getText = _a.getText, onClipboardCopy = _a.onClipboardCopy, onClipboardError = _a.onClipboardError, children = _a.children, buttonProps = __rest(_a, ["getText", "onClipboardCopy", "onClipboardError", "children"]);
        return (React.createElement(Button, __assign({}, buttonProps, { ref: this.setRef }), children));
    };
    return ClipboardButton;
}(PureComponent));
export { ClipboardButton };
//# sourceMappingURL=ClipboardButton.js.map