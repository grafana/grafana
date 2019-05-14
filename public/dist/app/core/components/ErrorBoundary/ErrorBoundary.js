import * as tslib_1 from "tslib";
import { Component } from 'react';
var ErrorBoundary = /** @class */ (function (_super) {
    tslib_1.__extends(ErrorBoundary, _super);
    function ErrorBoundary() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            error: null,
            errorInfo: null,
        };
        return _this;
    }
    ErrorBoundary.prototype.componentDidCatch = function (error, errorInfo) {
        this.setState({
            error: error,
            errorInfo: errorInfo,
        });
    };
    ErrorBoundary.prototype.render = function () {
        var children = this.props.children;
        var _a = this.state, error = _a.error, errorInfo = _a.errorInfo;
        return children({
            error: error,
            errorInfo: errorInfo,
        });
    };
    return ErrorBoundary;
}(Component));
export default ErrorBoundary;
//# sourceMappingURL=ErrorBoundary.js.map