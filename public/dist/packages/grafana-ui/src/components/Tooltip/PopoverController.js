import { __extends } from "tslib";
import React from 'react';
var PopoverController = /** @class */ (function (_super) {
    __extends(PopoverController, _super);
    function PopoverController() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = { show: false };
        _this.showPopper = function () {
            clearTimeout(_this.hideTimeout);
            _this.setState({ show: true });
        };
        _this.hidePopper = function () {
            _this.hideTimeout = setTimeout(function () {
                _this.setState({ show: false });
            }, _this.props.hideAfter);
        };
        return _this;
    }
    PopoverController.prototype.render = function () {
        var _a = this.props, children = _a.children, content = _a.content, _b = _a.placement, placement = _b === void 0 ? 'auto' : _b;
        var show = this.state.show;
        return children(this.showPopper, this.hidePopper, {
            show: show,
            placement: placement,
            content: content,
        });
    };
    return PopoverController;
}(React.Component));
export { PopoverController };
//# sourceMappingURL=PopoverController.js.map