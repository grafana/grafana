import { __assign, __extends, __makeTemplateObject, __rest } from "tslib";
import React, { PureComponent } from 'react';
import { Tooltip } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import { css, cx } from '@emotion/css';
var VariableOptions = /** @class */ (function (_super) {
    __extends(VariableOptions, _super);
    function VariableOptions() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.onToggle = function (option) { return function (event) {
            var clearOthers = event.shiftKey || event.ctrlKey || event.metaKey;
            _this.handleEvent(event);
            _this.props.onToggle(option, clearOthers);
        }; };
        _this.onToggleAll = function (event) {
            _this.handleEvent(event);
            _this.props.onToggleAll();
        };
        return _this;
    }
    VariableOptions.prototype.handleEvent = function (event) {
        event.preventDefault();
        event.stopPropagation();
    };
    VariableOptions.prototype.render = function () {
        var _this = this;
        // Don't want to pass faulty rest props to the div
        var _a = this.props, multi = _a.multi, values = _a.values, highlightIndex = _a.highlightIndex, selectedValues = _a.selectedValues, onToggle = _a.onToggle, onToggleAll = _a.onToggleAll, restProps = __rest(_a, ["multi", "values", "highlightIndex", "selectedValues", "onToggle", "onToggleAll"]);
        return (React.createElement("div", { className: "" + (multi ? 'variable-value-dropdown multi' : 'variable-value-dropdown single') },
            React.createElement("div", { className: "variable-options-wrapper" },
                React.createElement("ul", __assign({ className: listStyles, "aria-label": selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownDropDown }, restProps),
                    this.renderMultiToggle(),
                    values.map(function (option, index) { return _this.renderOption(option, index); })))));
    };
    VariableOptions.prototype.renderOption = function (option, index) {
        var highlightIndex = this.props.highlightIndex;
        var selectClass = option.selected ? 'variable-option pointer selected' : 'variable-option pointer';
        var highlightClass = index === highlightIndex ? selectClass + " highlighted" : selectClass;
        return (React.createElement("li", { key: "" + option.value },
            React.createElement("a", { role: "checkbox", "aria-checked": option.selected, className: highlightClass, onClick: this.onToggle(option) },
                React.createElement("span", { className: "variable-option-icon" }),
                React.createElement("span", { "data-testid": selectors.pages.Dashboard.SubMenu.submenuItemValueDropDownOptionTexts("" + option.text) }, option.text))));
    };
    VariableOptions.prototype.renderMultiToggle = function () {
        var _a = this.props, multi = _a.multi, selectedValues = _a.selectedValues;
        if (!multi) {
            return null;
        }
        return (React.createElement(Tooltip, { content: 'Clear selections', placement: 'top' },
            React.createElement("a", { className: "" + (selectedValues.length > 1
                    ? 'variable-options-column-header many-selected'
                    : 'variable-options-column-header'), role: "checkbox", "aria-checked": selectedValues.length > 1 ? 'mixed' : 'false', onClick: this.onToggleAll, "aria-label": "Toggle all values", "data-placement": "top" },
                React.createElement("span", { className: "variable-option-icon" }),
                "Selected (",
                selectedValues.length,
                ")")));
    };
    return VariableOptions;
}(PureComponent));
export { VariableOptions };
var listStyles = cx('variable-options-column', css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    list-style-type: none;\n  "], ["\n    list-style-type: none;\n  "]))));
var templateObject_1;
//# sourceMappingURL=VariableOptions.js.map