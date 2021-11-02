import { __assign, __extends, __makeTemplateObject, __read, __rest, __spreadArray } from "tslib";
import React, { PureComponent } from 'react';
import { css } from '@emotion/css';
import { sortThresholds, ThresholdsMode, } from '@grafana/data';
import { colors } from '../../utils';
import { ThemeContext } from '../../themes/ThemeContext';
import { Input } from '../Input/Input';
import { ColorPicker } from '../ColorPicker/ColorPicker';
import { stylesFactory } from '../../themes';
import { Icon } from '../Icon/Icon';
import { RadioButtonGroup } from '../Forms/RadioButtonGroup/RadioButtonGroup';
import { Button } from '../Button';
import { Label } from '../Forms/Label';
import { isNumber } from 'lodash';
var modes = [
    { value: ThresholdsMode.Absolute, label: 'Absolute', description: 'Pick thresholds based on the absolute values' },
    {
        value: ThresholdsMode.Percentage,
        label: 'Percentage',
        description: 'Pick threshold based on the percent between min/max',
    },
];
var ThresholdsEditor = /** @class */ (function (_super) {
    __extends(ThresholdsEditor, _super);
    function ThresholdsEditor(props) {
        var _this = _super.call(this, props) || this;
        _this.onAddThreshold = function () {
            var steps = _this.state.steps;
            var nextValue = 0;
            if (steps.length > 1) {
                nextValue = steps[steps.length - 1].value + 10;
            }
            var color = colors.filter(function (c) { return !steps.some(function (t) { return t.color === c; }); })[1];
            if (!color) {
                // Default color when all colors are used
                color = '#CCCCCC';
            }
            var add = {
                value: nextValue,
                color: color,
                key: counter++,
            };
            var newThresholds = __spreadArray(__spreadArray([], __read(steps), false), [add], false);
            sortThresholds(newThresholds);
            _this.setState({ steps: newThresholds }, function () {
                if (_this.latestThresholdInputRef.current) {
                    _this.latestThresholdInputRef.current.focus();
                }
                _this.onChange();
            });
        };
        _this.onRemoveThreshold = function (threshold) {
            var steps = _this.state.steps;
            if (!steps.length) {
                return;
            }
            // Don't remove index 0
            if (threshold.key === steps[0].key) {
                return;
            }
            _this.setState({ steps: steps.filter(function (t) { return t.key !== threshold.key; }) }, _this.onChange);
        };
        _this.onChangeThresholdValue = function (event, threshold) {
            var cleanValue = event.target.value.replace(/,/g, '.');
            var parsedValue = parseFloat(cleanValue);
            var value = isNaN(parsedValue) ? '' : parsedValue;
            var steps = _this.state.steps.map(function (t) {
                if (t.key === threshold.key) {
                    t = __assign(__assign({}, t), { value: value });
                }
                return t;
            });
            if (steps.length) {
                steps[0].value = -Infinity;
            }
            sortThresholds(steps);
            _this.setState({ steps: steps });
        };
        _this.onChangeThresholdColor = function (threshold, color) {
            var steps = _this.state.steps;
            var newThresholds = steps.map(function (t) {
                if (t.key === threshold.key) {
                    t = __assign(__assign({}, t), { color: color });
                }
                return t;
            });
            _this.setState({ steps: newThresholds }, _this.onChange);
        };
        _this.onBlur = function () {
            var steps = __spreadArray([], __read(_this.state.steps), false);
            sortThresholds(steps);
            _this.setState({ steps: steps }, _this.onChange);
        };
        _this.onChange = function () {
            _this.props.onChange(thresholdsWithoutKey(_this.props.thresholds, _this.state.steps));
        };
        _this.onModeChanged = function (value) {
            _this.props.onChange(__assign(__assign({}, _this.props.thresholds), { mode: value }));
        };
        var steps = toThresholdsWithKey(props.thresholds.steps);
        steps[0].value = -Infinity;
        _this.state = { steps: steps };
        _this.latestThresholdInputRef = React.createRef();
        return _this;
    }
    ThresholdsEditor.prototype.renderInput = function (threshold, styles, idx) {
        var _this = this;
        var isPercent = this.props.thresholds.mode === ThresholdsMode.Percentage;
        var ariaLabel = "Threshold " + (idx + 1);
        if (!isFinite(threshold.value)) {
            return (React.createElement(Input, { type: "text", value: 'Base', "aria-label": ariaLabel, disabled: true, prefix: React.createElement("div", { className: styles.colorPicker },
                    React.createElement(ColorPicker, { color: threshold.color, onChange: function (color) { return _this.onChangeThresholdColor(threshold, color); }, enableNamedColors: true })) }));
        }
        return (React.createElement(Input, { type: "number", step: "0.0001", key: isPercent.toString(), onChange: function (event) { return _this.onChangeThresholdValue(event, threshold); }, value: threshold.value, "aria-label": ariaLabel, ref: idx === 0 ? this.latestThresholdInputRef : null, onBlur: this.onBlur, prefix: React.createElement("div", { className: styles.inputPrefix },
                React.createElement("div", { className: styles.colorPicker },
                    React.createElement(ColorPicker, { color: threshold.color, onChange: function (color) { return _this.onChangeThresholdColor(threshold, color); }, enableNamedColors: true })),
                isPercent && React.createElement("div", { className: styles.percentIcon }, "%")), suffix: React.createElement(Icon, { className: styles.trashIcon, name: "trash-alt", onClick: function () { return _this.onRemoveThreshold(threshold); } }) }));
    };
    ThresholdsEditor.prototype.render = function () {
        var _this = this;
        var thresholds = this.props.thresholds;
        var steps = this.state.steps;
        return (React.createElement(ThemeContext.Consumer, null, function (theme) {
            var styles = getStyles(theme.v1);
            return (React.createElement("div", { className: styles.wrapper },
                React.createElement(Button, { size: "sm", icon: "plus", onClick: function () { return _this.onAddThreshold(); }, variant: "secondary", className: styles.addButton, fullWidth: true }, "Add threshold"),
                React.createElement("div", { className: styles.thresholds }, steps
                    .slice(0)
                    .reverse()
                    .map(function (threshold, idx) { return (React.createElement("div", { className: styles.item, key: "" + threshold.key }, _this.renderInput(threshold, styles, idx))); })),
                React.createElement("div", null,
                    React.createElement(Label, { description: "Percentage means thresholds relative to min & max" }, "Thresholds mode"),
                    React.createElement(RadioButtonGroup, { options: modes, onChange: _this.onModeChanged, value: thresholds.mode }))));
        }));
    };
    return ThresholdsEditor;
}(PureComponent));
export { ThresholdsEditor };
var counter = 100;
function toThresholdsWithKey(steps) {
    if (!steps || steps.length === 0) {
        steps = [{ value: -Infinity, color: 'green' }];
    }
    return steps
        .filter(function (t, i) { return isNumber(t.value) || i === 0; })
        .map(function (t) {
        return {
            color: t.color,
            value: t.value === null ? -Infinity : t.value,
            key: counter++,
        };
    });
}
export function thresholdsWithoutKey(thresholds, steps) {
    var _a;
    var mode = (_a = thresholds.mode) !== null && _a !== void 0 ? _a : ThresholdsMode.Absolute;
    return {
        mode: mode,
        steps: steps.map(function (t) {
            var key = t.key, rest = __rest(t, ["key"]);
            return rest; // everything except key
        }),
    };
}
var getStyles = stylesFactory(function (theme) {
    return {
        wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n        display: flex;\n        flex-direction: column;\n      "], ["\n        display: flex;\n        flex-direction: column;\n      "]))),
        thresholds: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n        display: flex;\n        flex-direction: column;\n        margin-bottom: ", "px;\n      "], ["\n        display: flex;\n        flex-direction: column;\n        margin-bottom: ", "px;\n      "])), theme.spacing.formSpacingBase * 2),
        item: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n        margin-bottom: ", ";\n\n        &:last-child {\n          margin-bottom: 0;\n        }\n      "], ["\n        margin-bottom: ", ";\n\n        &:last-child {\n          margin-bottom: 0;\n        }\n      "])), theme.spacing.sm),
        colorPicker: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n        padding: 0 ", ";\n      "], ["\n        padding: 0 ", ";\n      "])), theme.spacing.sm),
        addButton: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n        margin-bottom: ", ";\n      "], ["\n        margin-bottom: ", ";\n      "])), theme.spacing.sm),
        percentIcon: css(templateObject_6 || (templateObject_6 = __makeTemplateObject(["\n        font-size: ", ";\n        color: ", ";\n      "], ["\n        font-size: ", ";\n        color: ", ";\n      "])), theme.typography.size.sm, theme.colors.textWeak),
        inputPrefix: css(templateObject_7 || (templateObject_7 = __makeTemplateObject(["\n        display: flex;\n        align-items: center;\n      "], ["\n        display: flex;\n        align-items: center;\n      "]))),
        trashIcon: css(templateObject_8 || (templateObject_8 = __makeTemplateObject(["\n        color: ", ";\n        cursor: pointer;\n\n        &:hover {\n          color: ", ";\n        }\n      "], ["\n        color: ", ";\n        cursor: pointer;\n\n        &:hover {\n          color: ", ";\n        }\n      "])), theme.colors.textWeak, theme.colors.text),
    };
});
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8;
//# sourceMappingURL=ThresholdsEditor.js.map