import { __assign, __extends } from "tslib";
import React, { Component } from 'react';
var ObservablePropsWrapper = /** @class */ (function (_super) {
    __extends(ObservablePropsWrapper, _super);
    function ObservablePropsWrapper(props) {
        var _this = _super.call(this, props) || this;
        _this.state = {
            subProps: props.initialSubProps,
        };
        return _this;
    }
    ObservablePropsWrapper.prototype.componentDidMount = function () {
        var _this = this;
        this.sub = this.props.watch.subscribe({
            next: function (subProps) {
                //console.log('ObservablePropsWrapper:NEXT', subProps);
                _this.setState({ subProps: subProps });
            },
            complete: function () {
                //console.log('ObservablePropsWrapper:complete');
            },
            error: function (err) {
                //console.log('ObservablePropsWrapper:error', err);
            },
        });
    };
    ObservablePropsWrapper.prototype.componentWillUnmount = function () {
        if (this.sub) {
            this.sub.unsubscribe();
        }
    };
    ObservablePropsWrapper.prototype.render = function () {
        var subProps = this.state.subProps;
        return React.createElement(this.props.child, __assign({}, subProps));
    };
    return ObservablePropsWrapper;
}(Component));
export { ObservablePropsWrapper };
//# sourceMappingURL=ObservablePropsWrapper.js.map