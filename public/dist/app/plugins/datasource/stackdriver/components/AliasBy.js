import * as tslib_1 from "tslib";
import React, { Component } from 'react';
import { debounce } from 'lodash';
var AliasBy = /** @class */ (function (_super) {
    tslib_1.__extends(AliasBy, _super);
    function AliasBy(props) {
        var _this = _super.call(this, props) || this;
        _this.onChange = function (e) {
            _this.setState({ value: e.target.value });
            _this.propagateOnChange(e.target.value);
        };
        _this.propagateOnChange = debounce(_this.props.onChange, 500);
        _this.state = { value: '' };
        return _this;
    }
    AliasBy.prototype.componentDidMount = function () {
        this.setState({ value: this.props.value });
    };
    AliasBy.prototype.componentWillReceiveProps = function (nextProps) {
        if (nextProps.value !== this.props.value) {
            this.setState({ value: nextProps.value });
        }
    };
    AliasBy.prototype.render = function () {
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { className: "gf-form-inline" },
                React.createElement("div", { className: "gf-form" },
                    React.createElement("label", { className: "gf-form-label query-keyword width-9" }, "Alias By"),
                    React.createElement("input", { type: "text", className: "gf-form-input width-24", value: this.state.value, onChange: this.onChange })),
                React.createElement("div", { className: "gf-form gf-form--grow" },
                    React.createElement("div", { className: "gf-form-label gf-form-label--grow" })))));
    };
    return AliasBy;
}(Component));
export { AliasBy };
//# sourceMappingURL=AliasBy.js.map