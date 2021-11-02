import { __assign, __makeTemplateObject } from "tslib";
import React, { useCallback } from 'react';
import { ComparisonOperation } from '../types';
import { Button, ColorPicker, InlineField, InlineFieldRow, Input, Select, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { NumberInput } from 'app/features/dimensions/editors/NumberInput';
export var StyleRuleEditor = function (props) {
    var _a, _b, _c, _d, _e;
    var value = props.value, onChange = props.onChange, item = props.item;
    var settings = item.settings;
    var styles = useStyles2(getStyles);
    var LABEL_WIDTH = 10;
    var onChangeComparisonProperty = useCallback(function (e) {
        var _a, _b, _c, _d;
        onChange(__assign(__assign({}, value), { rule: __assign(__assign({}, value.rule), { property: e.currentTarget.value, operation: (_b = (_a = value.rule) === null || _a === void 0 ? void 0 : _a.operation) !== null && _b !== void 0 ? _b : ComparisonOperation.EQ, value: (_d = (_c = value.rule) === null || _c === void 0 ? void 0 : _c.value) !== null && _d !== void 0 ? _d : '' }) }));
    }, [onChange, value]);
    var onChangeComparison = useCallback(function (selection) {
        var _a, _b, _c, _d, _e;
        onChange(__assign(__assign({}, value), { rule: __assign(__assign({}, value.rule), { operation: (_a = selection.value) !== null && _a !== void 0 ? _a : ComparisonOperation.EQ, property: (_c = (_b = value.rule) === null || _b === void 0 ? void 0 : _b.property) !== null && _c !== void 0 ? _c : '', value: (_e = (_d = value.rule) === null || _d === void 0 ? void 0 : _d.value) !== null && _e !== void 0 ? _e : '' }) }));
    }, [onChange, value]);
    var onChangeComparisonValue = useCallback(function (e) {
        var _a, _b, _c, _d;
        onChange(__assign(__assign({}, value), { rule: __assign(__assign({}, value.rule), { value: e.currentTarget.value, operation: (_b = (_a = value.rule) === null || _a === void 0 ? void 0 : _a.operation) !== null && _b !== void 0 ? _b : ComparisonOperation.EQ, property: (_d = (_c = value.rule) === null || _c === void 0 ? void 0 : _c.property) !== null && _d !== void 0 ? _d : '' }) }));
    }, [onChange, value]);
    var onChangeColor = useCallback(function (c) {
        onChange(__assign(__assign({}, value), { fillColor: c }));
    }, [onChange, value]);
    var onChangeStrokeWidth = useCallback(function (num) {
        var _a;
        onChange(__assign(__assign({}, value), { strokeWidth: (_a = num !== null && num !== void 0 ? num : value.strokeWidth) !== null && _a !== void 0 ? _a : 1 }));
    }, [onChange, value]);
    var onDelete = useCallback(function () {
        onChange(undefined);
    }, [onChange]);
    return (React.createElement("div", { className: styles.rule },
        React.createElement(InlineFieldRow, { className: styles.row },
            React.createElement(InlineField, { label: "Rule", labelWidth: LABEL_WIDTH, grow: true },
                React.createElement(Input, { type: "text", placeholder: 'Feature property', value: "" + ((_a = value === null || value === void 0 ? void 0 : value.rule) === null || _a === void 0 ? void 0 : _a.property), onChange: onChangeComparisonProperty, "aria-label": 'Feature property' })),
            React.createElement(InlineField, { className: styles.inline, grow: true },
                React.createElement(Select, { menuShouldPortal: true, value: (_c = "" + ((_b = value === null || value === void 0 ? void 0 : value.rule) === null || _b === void 0 ? void 0 : _b.operation)) !== null && _c !== void 0 ? _c : ComparisonOperation.EQ, options: settings.options, onChange: onChangeComparison, "aria-label": 'Comparison operator' })),
            React.createElement(InlineField, { className: styles.inline, grow: true },
                React.createElement(Input, { type: "text", placeholder: 'value', value: "" + ((_d = value === null || value === void 0 ? void 0 : value.rule) === null || _d === void 0 ? void 0 : _d.value), onChange: onChangeComparisonValue, "aria-label": 'Comparison value' }))),
        React.createElement(InlineFieldRow, { className: styles.row },
            React.createElement(InlineField, { label: "Style", labelWidth: LABEL_WIDTH, className: styles.color },
                React.createElement(ColorPicker, { color: value === null || value === void 0 ? void 0 : value.fillColor, onChange: onChangeColor })),
            React.createElement(InlineField, { label: "Stroke", className: styles.inline, grow: true },
                React.createElement(NumberInput, { value: (_e = value === null || value === void 0 ? void 0 : value.strokeWidth) !== null && _e !== void 0 ? _e : 1, min: 1, max: 20, step: 0.5, "aria-label": 'Stroke width', onChange: onChangeStrokeWidth })),
            React.createElement(Button, { size: "md", icon: "trash-alt", onClick: function () { return onDelete(); }, variant: "secondary", "aria-label": 'Delete style rule', className: styles.button }))));
};
var getStyles = function (theme) { return ({
    rule: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin-bottom: ", ";\n  "], ["\n    margin-bottom: ", ";\n  "])), theme.spacing(1)),
    row: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    display: flex;\n    margin-bottom: 4px;\n  "], ["\n    display: flex;\n    margin-bottom: 4px;\n  "]))),
    inline: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    margin-bottom: 0;\n    margin-left: 4px;\n  "], ["\n    margin-bottom: 0;\n    margin-left: 4px;\n  "]))),
    color: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    align-items: center;\n    margin-bottom: 0;\n    margin-right: 4px;\n  "], ["\n    align-items: center;\n    margin-bottom: 0;\n    margin-right: 4px;\n  "]))),
    button: css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    margin-left: 4px;\n  "], ["\n    margin-left: 4px;\n  "]))),
}); };
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
//# sourceMappingURL=StyleRuleEditor.js.map