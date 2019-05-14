import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import ClipboardJS from 'clipboard';
var CopyToClipboard = /** @class */ (function (_super) {
    tslib_1.__extends(CopyToClipboard, _super);
    function CopyToClipboard(props) {
        var _this = _super.call(this, props) || this;
        _this.getElementType = function () {
            return _this.props.elType || 'button';
        };
        _this.myRef = React.createRef();
        return _this;
    }
    CopyToClipboard.prototype.componentDidMount = function () {
        var _a = this.props, text = _a.text, onSuccess = _a.onSuccess, onError = _a.onError;
        this.clipboardjs = new ClipboardJS(this.myRef.current, {
            text: text,
        });
        if (onSuccess) {
            this.clipboardjs.on('success', function (evt) {
                evt.clearSelection();
                onSuccess(evt);
            });
        }
        if (onError) {
            this.clipboardjs.on('error', function (evt) {
                console.error('Action:', evt.action);
                console.error('Trigger:', evt.trigger);
                onError(evt);
            });
        }
    };
    CopyToClipboard.prototype.componentWillUnmount = function () {
        if (this.clipboardjs) {
            this.clipboardjs.destroy();
        }
    };
    CopyToClipboard.prototype.render = function () {
        var _a = this.props, elType = _a.elType, text = _a.text, children = _a.children, onError = _a.onError, onSuccess = _a.onSuccess, restProps = tslib_1.__rest(_a, ["elType", "text", "children", "onError", "onSuccess"]);
        return React.createElement(this.getElementType(), tslib_1.__assign({ ref: this.myRef }, restProps), this.props.children);
    };
    return CopyToClipboard;
}(PureComponent));
export { CopyToClipboard };
//# sourceMappingURL=CopyToClipboard.js.map