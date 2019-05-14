import * as tslib_1 from "tslib";
import React, { Component } from 'react';
var ErrorBoundary = /** @class */ (function (_super) {
    tslib_1.__extends(ErrorBoundary, _super);
    function ErrorBoundary(props) {
        var _this = _super.call(this, props) || this;
        _this.state = { error: null, errorInfo: null };
        return _this;
    }
    ErrorBoundary.prototype.componentDidCatch = function (error, errorInfo) {
        // Catch errors in any components below and re-render with error message
        this.setState({
            error: error,
            errorInfo: errorInfo,
        });
    };
    ErrorBoundary.prototype.render = function () {
        if (this.state.errorInfo) {
            // Error path
            return (React.createElement("div", { className: "explore-container" },
                React.createElement("h3", null, "An unexpected error happened."),
                React.createElement("details", { style: { whiteSpace: 'pre-wrap' } },
                    this.state.error && this.state.error.toString(),
                    React.createElement("br", null),
                    this.state.errorInfo.componentStack)));
        }
        // Normally, just render children
        return this.props.children;
    };
    return ErrorBoundary;
}(Component));
export default ErrorBoundary;
//# sourceMappingURL=ErrorBoundary.js.map