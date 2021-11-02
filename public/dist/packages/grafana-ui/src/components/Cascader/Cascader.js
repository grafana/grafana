import { __extends, __makeTemplateObject, __read, __spreadArray, __values } from "tslib";
import React from 'react';
import { Icon } from '../Icon/Icon';
import RCCascader from 'rc-cascader';
import { Select } from '../Select/Select';
import { Input } from '../Input/Input';
import { css } from '@emotion/css';
import { onChangeCascader } from './optionMappings';
import memoizeOne from 'memoize-one';
var disableDivFocus = css("\n&:focus{\n  outline: none;\n}\n");
var DEFAULT_SEPARATOR = '/';
var Cascader = /** @class */ (function (_super) {
    __extends(Cascader, _super);
    function Cascader(props) {
        var _this = _super.call(this, props) || this;
        _this.flattenOptions = function (options, optionPath) {
            var e_1, _a;
            if (optionPath === void 0) { optionPath = []; }
            var selectOptions = [];
            try {
                for (var options_1 = __values(options), options_1_1 = options_1.next(); !options_1_1.done; options_1_1 = options_1.next()) {
                    var option = options_1_1.value;
                    var cpy = __spreadArray([], __read(optionPath), false);
                    cpy.push(option);
                    if (!option.items) {
                        selectOptions.push({
                            singleLabel: cpy[cpy.length - 1].label,
                            label: cpy.map(function (o) { return o.label; }).join(_this.props.separator || " " + DEFAULT_SEPARATOR + " "),
                            value: cpy.map(function (o) { return o.value; }),
                        });
                    }
                    else {
                        selectOptions = __spreadArray(__spreadArray([], __read(selectOptions), false), __read(_this.flattenOptions(option.items, cpy)), false);
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (options_1_1 && !options_1_1.done && (_a = options_1.return)) _a.call(options_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return selectOptions;
        };
        _this.getSearchableOptions = memoizeOne(function (options) { return _this.flattenOptions(options); });
        //For rc-cascader
        _this.onChange = function (value, selectedOptions) {
            _this.setState({
                rcValue: value,
                focusCascade: true,
                activeLabel: _this.props.displayAllSelectedLevels
                    ? selectedOptions.map(function (option) { return option.label; }).join(_this.props.separator || DEFAULT_SEPARATOR)
                    : selectedOptions[selectedOptions.length - 1].label,
            });
            _this.props.onSelect(selectedOptions[selectedOptions.length - 1].value);
        };
        //For select
        _this.onSelect = function (obj) {
            var valueArray = obj.value || [];
            _this.setState({
                activeLabel: _this.props.displayAllSelectedLevels ? obj.label : obj.singleLabel || '',
                rcValue: valueArray,
                isSearching: false,
            });
            _this.props.onSelect(valueArray[valueArray.length - 1]);
        };
        _this.onCreateOption = function (value) {
            _this.setState({
                activeLabel: value,
                rcValue: [],
                isSearching: false,
            });
            _this.props.onSelect(value);
        };
        _this.onBlur = function () {
            _this.setState({
                isSearching: false,
                focusCascade: false,
            });
            if (_this.state.activeLabel === '') {
                _this.setState({
                    rcValue: [],
                });
            }
        };
        _this.onBlurCascade = function () {
            _this.setState({
                focusCascade: false,
            });
        };
        _this.onInputKeyDown = function (e) {
            if (e.key === 'ArrowDown' ||
                e.key === 'ArrowUp' ||
                e.key === 'Enter' ||
                e.key === 'ArrowLeft' ||
                e.key === 'ArrowRight') {
                return;
            }
            _this.setState({
                focusCascade: false,
                isSearching: true,
            });
        };
        var searchableOptions = _this.getSearchableOptions(props.options);
        var _a = _this.setInitialValue(searchableOptions, props.initialValue), rcValue = _a.rcValue, activeLabel = _a.activeLabel;
        _this.state = {
            isSearching: false,
            focusCascade: false,
            rcValue: rcValue,
            activeLabel: activeLabel,
        };
        return _this;
    }
    Cascader.prototype.setInitialValue = function (searchableOptions, initValue) {
        var e_2, _a;
        if (!initValue) {
            return { rcValue: [], activeLabel: '' };
        }
        try {
            for (var searchableOptions_1 = __values(searchableOptions), searchableOptions_1_1 = searchableOptions_1.next(); !searchableOptions_1_1.done; searchableOptions_1_1 = searchableOptions_1.next()) {
                var option = searchableOptions_1_1.value;
                var optionPath = option.value || [];
                if (optionPath.indexOf(initValue) === optionPath.length - 1) {
                    return {
                        rcValue: optionPath,
                        activeLabel: this.props.displayAllSelectedLevels ? option.label : option.singleLabel || '',
                    };
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (searchableOptions_1_1 && !searchableOptions_1_1.done && (_a = searchableOptions_1.return)) _a.call(searchableOptions_1);
            }
            finally { if (e_2) throw e_2.error; }
        }
        if (this.props.allowCustomValue) {
            return { rcValue: [], activeLabel: initValue };
        }
        return { rcValue: [], activeLabel: '' };
    };
    Cascader.prototype.render = function () {
        var _a = this.props, allowCustomValue = _a.allowCustomValue, placeholder = _a.placeholder, width = _a.width, changeOnSelect = _a.changeOnSelect, options = _a.options;
        var _b = this.state, focusCascade = _b.focusCascade, isSearching = _b.isSearching, rcValue = _b.rcValue, activeLabel = _b.activeLabel;
        var searchableOptions = this.getSearchableOptions(options);
        return (React.createElement("div", null, isSearching ? (React.createElement(Select, { menuShouldPortal: true, allowCustomValue: allowCustomValue, placeholder: placeholder, autoFocus: !focusCascade, onChange: this.onSelect, onBlur: this.onBlur, options: searchableOptions, onCreateOption: this.onCreateOption, formatCreateLabel: this.props.formatCreateLabel, width: width })) : (React.createElement(RCCascader, { onChange: onChangeCascader(this.onChange), options: this.props.options, changeOnSelect: changeOnSelect, value: rcValue.value, fieldNames: { label: 'label', value: 'value', children: 'items' }, expandIcon: null, 
            // Required, otherwise the portal that the popup is shown in will render under other components
            popupClassName: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n              z-index: 9999;\n            "], ["\n              z-index: 9999;\n            "]))) },
            React.createElement("div", { className: disableDivFocus },
                React.createElement(Input, { width: width, placeholder: placeholder, onBlur: this.onBlurCascade, value: activeLabel, onKeyDown: this.onInputKeyDown, onChange: function () { }, suffix: focusCascade ? (React.createElement(Icon, { name: "angle-up" })) : (React.createElement(Icon, { name: "angle-down", style: { marginBottom: 0, marginLeft: '4px' } })) }))))));
    };
    Cascader.defaultProps = { changeOnSelect: true };
    return Cascader;
}(React.PureComponent));
export { Cascader };
var templateObject_1;
//# sourceMappingURL=Cascader.js.map