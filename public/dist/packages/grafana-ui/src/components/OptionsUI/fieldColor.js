import { __assign, __makeTemplateObject } from "tslib";
import React from 'react';
import { FieldColorModeId, fieldColorModeRegistry, getFieldColorMode, } from '@grafana/data';
import { Select } from '../Select/Select';
import { ColorValueEditor } from './color';
import { useStyles2, useTheme2 } from '../../themes/ThemeContext';
import { css } from '@emotion/css';
import { Field } from '../Forms/Field';
import { RadioButtonGroup } from '../Forms/RadioButtonGroup/RadioButtonGroup';
export var FieldColorEditor = function (_a) {
    var _b, _c, _d, _e;
    var value = _a.value, onChange = _a.onChange, item = _a.item, id = _a.id;
    var theme = useTheme2();
    var styles = useStyles2(getStyles);
    var colorMode = getFieldColorMode(value === null || value === void 0 ? void 0 : value.mode);
    var availableOptions = ((_b = item.settings) === null || _b === void 0 ? void 0 : _b.byValueSupport)
        ? fieldColorModeRegistry.list()
        : fieldColorModeRegistry.list().filter(function (m) { return !m.isByValue; });
    var options = availableOptions.map(function (mode) {
        var suffix = mode.isByValue ? ' (by value)' : '';
        return {
            value: mode.id,
            label: "" + mode.name + suffix,
            description: mode.description,
            isContinuous: mode.isContinuous,
            isByValue: mode.isByValue,
            component: function () {
                return React.createElement(FieldColorModeViz, { mode: mode, theme: theme });
            },
        };
    });
    var onModeChange = function (newMode) {
        onChange(__assign(__assign({}, value), { mode: newMode.value }));
    };
    var onColorChange = function (color) {
        onChange(__assign(__assign({}, value), { mode: mode, fixedColor: color }));
    };
    var onSeriesModeChange = function (seriesBy) {
        onChange(__assign(__assign({}, value), { mode: mode, seriesBy: seriesBy }));
    };
    var mode = (_c = value === null || value === void 0 ? void 0 : value.mode) !== null && _c !== void 0 ? _c : FieldColorModeId.Thresholds;
    if (mode === FieldColorModeId.Fixed) {
        return (React.createElement("div", { className: styles.group },
            React.createElement(Select, { menuShouldPortal: true, minMenuHeight: 200, options: options, value: mode, onChange: onModeChange, className: styles.select, inputId: id }),
            React.createElement(ColorValueEditor, { value: value === null || value === void 0 ? void 0 : value.fixedColor, onChange: onColorChange })));
    }
    if (((_d = item.settings) === null || _d === void 0 ? void 0 : _d.bySeriesSupport) && colorMode.isByValue) {
        var seriesModes = [
            { label: 'Last', value: 'last' },
            { label: 'Min', value: 'min' },
            { label: 'Max', value: 'max' },
        ];
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { style: { marginBottom: theme.spacing(2) } },
                React.createElement(Select, { menuShouldPortal: true, minMenuHeight: 200, options: options, value: mode, onChange: onModeChange, inputId: id })),
            React.createElement(Field, { label: "Color series by" },
                React.createElement(RadioButtonGroup, { value: (_e = value === null || value === void 0 ? void 0 : value.seriesBy) !== null && _e !== void 0 ? _e : 'last', options: seriesModes, onChange: onSeriesModeChange }))));
    }
    return (React.createElement(Select, { menuShouldPortal: true, minMenuHeight: 200, options: options, value: mode, onChange: onModeChange, inputId: id }));
};
var FieldColorModeViz = function (_a) {
    var mode = _a.mode, theme = _a.theme;
    if (!mode.getColors) {
        return null;
    }
    var colors = mode.getColors(theme).map(theme.visualization.getColorByName);
    var style = {
        height: '8px',
        width: '100%',
        margin: '2px 0',
        borderRadius: '3px',
        opacity: 1,
    };
    if (mode.isContinuous) {
        style.background = "linear-gradient(90deg, " + colors.join(',') + ")";
    }
    else {
        var gradient = '';
        var lastColor = '';
        for (var i = 0; i < colors.length; i++) {
            var color = colors[i];
            if (gradient === '') {
                gradient = "linear-gradient(90deg, " + color + " 0%";
            }
            else {
                var valuePercent = i / (colors.length - 1);
                var pos = valuePercent * 100;
                gradient += ", " + lastColor + " " + pos + "%, " + color + " " + pos + "%";
            }
            lastColor = color;
        }
        style.background = gradient;
    }
    return React.createElement("div", { style: style });
};
var getStyles = function (theme) {
    return {
        group: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: flex;\n    "], ["\n      display: flex;\n    "]))),
        select: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      margin-right: 8px;\n      flex-grow: 1;\n    "], ["\n      margin-right: 8px;\n      flex-grow: 1;\n    "]))),
    };
};
var templateObject_1, templateObject_2;
//# sourceMappingURL=fieldColor.js.map