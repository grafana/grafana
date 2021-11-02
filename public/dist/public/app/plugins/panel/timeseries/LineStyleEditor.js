import { __assign, __values } from "tslib";
import React, { useMemo } from 'react';
import { HorizontalGroup, IconButton, RadioButtonGroup, Select } from '@grafana/ui';
var lineFillOptions = [
    {
        label: 'Solid',
        value: 'solid',
    },
    {
        label: 'Dash',
        value: 'dash',
    },
    {
        label: 'Dots',
        value: 'dot',
    },
];
var dashOptions = [
    '10, 10',
    '10, 15',
    '10, 20',
    '10, 25',
    '10, 30',
    '10, 40',
    '15, 10',
    '20, 10',
    '25, 10',
    '30, 10',
    '40, 10',
    '50, 10',
    '5, 10',
    '30, 3, 3',
].map(function (txt) { return ({
    label: txt,
    value: txt,
}); });
var dotOptions = [
    '0, 10',
    '0, 20',
    '0, 30',
    '0, 40',
    '0, 3, 3',
].map(function (txt) { return ({
    label: txt,
    value: txt,
}); });
export var LineStyleEditor = function (_a) {
    var value = _a.value, onChange = _a.onChange;
    var options = useMemo(function () { return ((value === null || value === void 0 ? void 0 : value.fill) === 'dash' ? dashOptions : dotOptions); }, [value]);
    var current = useMemo(function () {
        var _a, _b;
        if (!((_a = value === null || value === void 0 ? void 0 : value.dash) === null || _a === void 0 ? void 0 : _a.length)) {
            return options[0];
        }
        var str = (_b = value.dash) === null || _b === void 0 ? void 0 : _b.join(', ');
        var val = options.find(function (o) { return o.value === str; });
        if (!val) {
            return {
                label: str,
                value: str,
            };
        }
        return val;
    }, [value, options]);
    return (React.createElement(HorizontalGroup, null,
        React.createElement(RadioButtonGroup, { value: (value === null || value === void 0 ? void 0 : value.fill) || 'solid', options: lineFillOptions, onChange: function (v) {
                var dash = undefined;
                if (v === 'dot') {
                    dash = parseText(dotOptions[0].value);
                }
                else if (v === 'dash') {
                    dash = parseText(dashOptions[0].value);
                }
                onChange(__assign(__assign({}, value), { fill: v, dash: dash }));
            } }),
        (value === null || value === void 0 ? void 0 : value.fill) && (value === null || value === void 0 ? void 0 : value.fill) !== 'solid' && (React.createElement(React.Fragment, null,
            React.createElement(Select, { menuShouldPortal: true, allowCustomValue: true, options: options, value: current, width: 20, onChange: function (v) {
                    var _a;
                    onChange(__assign(__assign({}, value), { dash: parseText((_a = v.value) !== null && _a !== void 0 ? _a : '') }));
                }, formatCreateLabel: function (t) { return "Segments: " + parseText(t).join(', '); } }),
            React.createElement("div", null,
                "\u00A0",
                React.createElement("a", { title: "The input expects a segment list", href: "https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/setLineDash#Parameters", target: "_blank", rel: "noreferrer" },
                    React.createElement(IconButton, { name: "question-circle" })))))));
};
function parseText(txt) {
    var e_1, _a;
    var segments = [];
    try {
        for (var _b = __values(txt.split(/(?:,| )+/)), _c = _b.next(); !_c.done; _c = _b.next()) {
            var s = _c.value;
            var num = Number.parseInt(s, 10);
            if (!isNaN(num)) {
                segments.push(num);
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return segments;
}
//# sourceMappingURL=LineStyleEditor.js.map