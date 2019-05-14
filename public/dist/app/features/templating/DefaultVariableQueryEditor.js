import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
var DefaultVariableQueryEditor = /** @class */ (function (_super) {
    tslib_1.__extends(DefaultVariableQueryEditor, _super);
    function DefaultVariableQueryEditor(props) {
        var _this = _super.call(this, props) || this;
        _this.state = { value: props.query };
        return _this;
    }
    DefaultVariableQueryEditor.prototype.handleChange = function (event) {
        this.setState({ value: event.target.value });
    };
    DefaultVariableQueryEditor.prototype.handleBlur = function (event) {
        this.props.onChange(event.target.value, event.target.value);
    };
    DefaultVariableQueryEditor.prototype.render = function () {
        var _this = this;
        return (React.createElement("div", { className: "gf-form" },
            React.createElement("span", { className: "gf-form-label width-10" }, "Query"),
            React.createElement("input", { type: "text", className: "gf-form-input", value: this.state.value, onChange: function (e) { return _this.handleChange(e); }, onBlur: function (e) { return _this.handleBlur(e); }, placeholder: "metric name or tags query", required: true })));
    };
    return DefaultVariableQueryEditor;
}(PureComponent));
export default DefaultVariableQueryEditor;
//# sourceMappingURL=DefaultVariableQueryEditor.js.map