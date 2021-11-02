import { __extends } from "tslib";
import React, { PureComponent, createRef } from 'react';
var ClickOutsideWrapper = /** @class */ (function (_super) {
    __extends(ClickOutsideWrapper, _super);
    function ClickOutsideWrapper() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.myRef = createRef();
        _this.state = {
            hasEventListener: false,
        };
        _this.onOutsideClick = function (event) {
            var domNode = _this.myRef.current;
            if (!domNode || !domNode.contains(event.target)) {
                _this.props.onClick();
            }
        };
        return _this;
    }
    ClickOutsideWrapper.prototype.componentDidMount = function () {
        this.props.parent.addEventListener('click', this.onOutsideClick, this.props.useCapture);
        if (this.props.includeButtonPress) {
            // Use keyup since keydown already has an event listener on window
            this.props.parent.addEventListener('keyup', this.onOutsideClick, this.props.useCapture);
        }
    };
    ClickOutsideWrapper.prototype.componentWillUnmount = function () {
        this.props.parent.removeEventListener('click', this.onOutsideClick, this.props.useCapture);
        if (this.props.includeButtonPress) {
            this.props.parent.removeEventListener('keyup', this.onOutsideClick, this.props.useCapture);
        }
    };
    ClickOutsideWrapper.prototype.render = function () {
        return React.createElement("div", { ref: this.myRef }, this.props.children);
    };
    ClickOutsideWrapper.defaultProps = {
        includeButtonPress: true,
        parent: window,
        useCapture: false,
    };
    return ClickOutsideWrapper;
}(PureComponent));
export { ClickOutsideWrapper };
//# sourceMappingURL=ClickOutsideWrapper.js.map