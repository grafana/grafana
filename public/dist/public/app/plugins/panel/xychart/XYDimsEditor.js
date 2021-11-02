import { __assign, __makeTemplateObject, __read, __spreadArray, __values } from "tslib";
import React, { useMemo } from 'react';
import { css } from '@emotion/css';
import { IconButton, Label, Select, stylesFactory, useTheme } from '@grafana/ui';
import { getFrameDisplayName, getFieldDisplayName, } from '@grafana/data';
import { getXYDimensions, isGraphable } from './dims';
export var XYDimsEditor = function (_a) {
    var _b;
    var value = _a.value, onChange = _a.onChange, context = _a.context;
    var frameNames = useMemo(function () {
        var _a;
        if ((_a = context === null || context === void 0 ? void 0 : context.data) === null || _a === void 0 ? void 0 : _a.length) {
            return context.data.map(function (f, idx) { return ({
                value: idx,
                label: getFrameDisplayName(f, idx),
            }); });
        }
        return [{ value: 0, label: 'First result' }];
    }, [context.data]);
    var dims = useMemo(function () { return getXYDimensions(value, context.data); }, [context.data, value]);
    var info = useMemo(function () {
        var e_1, _a;
        var _b, _c;
        var first = {
            label: '?',
            value: undefined, // empty
        };
        var v = {
            numberFields: [first],
            yFields: [],
            xAxis: (value === null || value === void 0 ? void 0 : value.x)
                ? {
                    label: value.x + " (Not found)",
                    value: value.x, // empty
                }
                : first,
        };
        var frame = context.data ? context.data[(_b = value === null || value === void 0 ? void 0 : value.frame) !== null && _b !== void 0 ? _b : 0] : undefined;
        if (frame) {
            var xName = dims.x ? getFieldDisplayName(dims.x, dims.frame, context.data) : undefined;
            try {
                for (var _d = __values(frame.fields), _e = _d.next(); !_e.done; _e = _d.next()) {
                    var field = _e.value;
                    if (isGraphable(field)) {
                        var name_1 = getFieldDisplayName(field, frame, context.data);
                        var sel = {
                            label: name_1,
                            value: name_1,
                        };
                        v.numberFields.push(sel);
                        if (first.label === '?') {
                            first.label = name_1 + " (First)";
                        }
                        if ((value === null || value === void 0 ? void 0 : value.x) && name_1 === value.x) {
                            v.xAxis = sel;
                        }
                        if (xName !== name_1) {
                            v.yFields.push({
                                label: name_1,
                                value: (_c = value === null || value === void 0 ? void 0 : value.exclude) === null || _c === void 0 ? void 0 : _c.includes(name_1),
                            });
                        }
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_e && !_e.done && (_a = _d.return)) _a.call(_d);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
        return v;
    }, [dims, context.data, value]);
    var theme = useTheme();
    var styles = getStyles(theme);
    if (!context.data) {
        return React.createElement("div", null, "No data...");
    }
    return (React.createElement("div", null,
        React.createElement(Select, { menuShouldPortal: true, options: frameNames, value: (_b = frameNames.find(function (v) { return v.value === (value === null || value === void 0 ? void 0 : value.frame); })) !== null && _b !== void 0 ? _b : frameNames[0], onChange: function (v) {
                onChange(__assign(__assign({}, value), { frame: v.value }));
            } }),
        React.createElement("br", null),
        React.createElement(Label, null, "X Field"),
        React.createElement(Select, { menuShouldPortal: true, options: info.numberFields, value: info.xAxis, onChange: function (v) {
                onChange(__assign(__assign({}, value), { x: v.value }));
            } }),
        React.createElement("br", null),
        React.createElement(Label, null, "Y Fields"),
        React.createElement("div", null, info.yFields.map(function (v) { return (React.createElement("div", { key: v.label, className: styles.row },
            React.createElement(IconButton, { name: v.value ? 'eye-slash' : 'eye', onClick: function () {
                    var exclude = (value === null || value === void 0 ? void 0 : value.exclude) ? __spreadArray([], __read(value.exclude), false) : [];
                    var idx = exclude.indexOf(v.label);
                    if (idx < 0) {
                        exclude.push(v.label);
                    }
                    else {
                        exclude.splice(idx, 1);
                    }
                    onChange(__assign(__assign({}, value), { exclude: exclude }));
                } }),
            v.label)); })),
        React.createElement("br", null),
        " ",
        React.createElement("br", null)));
};
var getStyles = stylesFactory(function (theme) { return ({
    sorter: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin-top: 10px;\n    display: flex;\n    flex-direction: row;\n    flex-wrap: nowrap;\n    align-items: center;\n    cursor: pointer;\n  "], ["\n    margin-top: 10px;\n    display: flex;\n    flex-direction: row;\n    flex-wrap: nowrap;\n    align-items: center;\n    cursor: pointer;\n  "]))),
    row: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    padding: ", " ", ";\n    border-radius: ", ";\n    background: ", ";\n    min-height: ", "px;\n    display: flex;\n    flex-direction: row;\n    flex-wrap: nowrap;\n    align-items: center;\n    margin-bottom: 3px;\n    border: 1px solid ", ";\n  "], ["\n    padding: ", " ", ";\n    border-radius: ", ";\n    background: ", ";\n    min-height: ", "px;\n    display: flex;\n    flex-direction: row;\n    flex-wrap: nowrap;\n    align-items: center;\n    margin-bottom: 3px;\n    border: 1px solid ", ";\n  "])), theme.spacing.xs, theme.spacing.sm, theme.border.radius.sm, theme.colors.bg2, theme.spacing.formInputHeight, theme.colors.formInputBorder),
}); });
var templateObject_1, templateObject_2;
//# sourceMappingURL=XYDimsEditor.js.map