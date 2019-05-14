import * as tslib_1 from "tslib";
import React from 'react';
import _ from 'lodash';
import { Select } from '@grafana/ui';
var MetricSelect = /** @class */ (function (_super) {
    tslib_1.__extends(MetricSelect, _super);
    function MetricSelect(props) {
        var _this = _super.call(this, props) || this;
        _this.state = { options: [] };
        return _this;
    }
    MetricSelect.prototype.componentDidMount = function () {
        this.setState({ options: this.buildOptions(this.props) });
    };
    MetricSelect.prototype.componentWillReceiveProps = function (nextProps) {
        if (nextProps.options.length > 0 || nextProps.variables.length) {
            this.setState({ options: this.buildOptions(nextProps) });
        }
    };
    MetricSelect.prototype.shouldComponentUpdate = function (nextProps) {
        var nextOptions = this.buildOptions(nextProps);
        return nextProps.value !== this.props.value || !_.isEqual(nextOptions, this.state.options);
    };
    MetricSelect.prototype.buildOptions = function (_a) {
        var _b = _a.variables, variables = _b === void 0 ? [] : _b, options = _a.options;
        return variables.length > 0 ? tslib_1.__spread([this.getVariablesGroup()], options) : options;
    };
    MetricSelect.prototype.getVariablesGroup = function () {
        return {
            label: 'Template Variables',
            options: this.props.variables.map(function (v) { return ({
                label: "$" + v.name,
                value: "$" + v.name,
            }); }),
        };
    };
    MetricSelect.prototype.getSelectedOption = function () {
        var _this = this;
        var options = this.state.options;
        var allOptions = options.every(function (o) { return o.options; }) ? _.flatten(options.map(function (o) { return o.options; })) : options;
        return allOptions.find(function (option) { return option.value === _this.props.value; });
    };
    MetricSelect.prototype.render = function () {
        var _a = this.props, placeholder = _a.placeholder, className = _a.className, isSearchable = _a.isSearchable, onChange = _a.onChange;
        var options = this.state.options;
        var selectedOption = this.getSelectedOption();
        return (React.createElement(Select, { className: className, isMulti: false, isClearable: false, backspaceRemovesValue: false, onChange: function (item) { return onChange(item.value); }, options: options, isSearchable: isSearchable, maxMenuHeight: 500, placeholder: placeholder, noOptionsMessage: function () { return 'No options found'; }, value: selectedOption }));
    };
    MetricSelect.defaultProps = {
        variables: [],
        options: [],
        isSearchable: true,
    };
    return MetricSelect;
}(React.Component));
export { MetricSelect };
//# sourceMappingURL=MetricSelect.js.map