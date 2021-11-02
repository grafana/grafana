import { __assign, __extends } from "tslib";
import React, { PureComponent } from 'react';
import { captureException } from '@sentry/browser';
import { Alert } from '../Alert/Alert';
import { ErrorWithStack } from './ErrorWithStack';
var ErrorBoundary = /** @class */ (function (_super) {
    __extends(ErrorBoundary, _super);
    function ErrorBoundary() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.state = {
            error: null,
            errorInfo: null,
        };
        return _this;
    }
    ErrorBoundary.prototype.componentDidCatch = function (error, errorInfo) {
        captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });
        this.setState({ error: error, errorInfo: errorInfo });
        if (this.props.onError) {
            this.props.onError(error);
        }
    };
    ErrorBoundary.prototype.componentDidUpdate = function (prevProps) {
        var _a = this.props, dependencies = _a.dependencies, onRecover = _a.onRecover;
        if (this.state.error) {
            if (dependencies && prevProps.dependencies) {
                for (var i = 0; i < dependencies.length; i++) {
                    if (dependencies[i] !== prevProps.dependencies[i]) {
                        this.setState({ error: null, errorInfo: null });
                        if (onRecover) {
                            onRecover();
                        }
                        break;
                    }
                }
            }
        }
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
}(PureComponent));
export { ErrorBoundary };
var ErrorBoundaryAlert = /** @class */ (function (_super) {
    __extends(ErrorBoundaryAlert, _super);
    function ErrorBoundaryAlert() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    ErrorBoundaryAlert.prototype.render = function () {
        var _a = this.props, title = _a.title, children = _a.children, style = _a.style, dependencies = _a.dependencies;
        return (React.createElement(ErrorBoundary, { dependencies: dependencies }, function (_a) {
            var error = _a.error, errorInfo = _a.errorInfo;
            if (!errorInfo) {
                return children;
            }
            if (style === 'alertbox') {
                return (React.createElement(Alert, { title: title || '' },
                    React.createElement("details", { style: { whiteSpace: 'pre-wrap' } },
                        error && error.toString(),
                        React.createElement("br", null),
                        errorInfo.componentStack)));
            }
            return React.createElement(ErrorWithStack, { title: title || '', error: error, errorInfo: errorInfo });
        }));
    };
    ErrorBoundaryAlert.defaultProps = {
        title: 'An unexpected error happened',
        style: 'alertbox',
    };
    return ErrorBoundaryAlert;
}(PureComponent));
export { ErrorBoundaryAlert };
/**
 * HOC for wrapping a component in an error boundary.
 *
 * @param Component - the react component to wrap in error boundary
 * @param errorBoundaryProps - error boundary options
 *
 * @public
 */
export function withErrorBoundary(Component, errorBoundaryProps) {
    if (errorBoundaryProps === void 0) { errorBoundaryProps = {}; }
    var comp = function (props) { return (React.createElement(ErrorBoundaryAlert, __assign({}, errorBoundaryProps),
        React.createElement(Component, __assign({}, props)))); };
    comp.displayName = 'WithErrorBoundary';
    return comp;
}
//# sourceMappingURL=ErrorBoundary.js.map