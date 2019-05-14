import * as tslib_1 from "tslib";
import { PureComponent } from 'react';
import ReactDOM from 'react-dom';
var ClickOutsideWrapper = /** @class */ (function (_super) {
    tslib_1.__extends(ClickOutsideWrapper, _super);
    function ClickOutsideWrapper() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            hasEventListener: false,
        };
        _this.onOutsideClick = function (event) {
            var domNode = ReactDOM.findDOMNode(_this);
            if (!domNode || !domNode.contains(event.target)) {
                _this.props.onClick();
            }
        };
        return _this;
    }
    ClickOutsideWrapper.prototype.componentDidMount = function () {
        window.addEventListener('click', this.onOutsideClick, false);
    };
    ClickOutsideWrapper.prototype.componentWillUnmount = function () {
        window.removeEventListener('click', this.onOutsideClick, false);
    };
    ClickOutsideWrapper.prototype.render = function () {
        return this.props.children;
    };
    return ClickOutsideWrapper;
}(PureComponent));
export { ClickOutsideWrapper };
//# sourceMappingURL=ClickOutsideWrapper.js.map