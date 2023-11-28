import React, { useMemo } from 'react';
import { HorizontalGroup, IconButton, RadioButtonGroup, Select } from '@grafana/ui';
const lineFillOptions = [
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
const dashOptions = [
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
].map((txt) => ({
    label: txt,
    value: txt,
}));
const dotOptions = [
    '0, 10',
    '0, 20',
    '0, 30',
    '0, 40',
    '0, 3, 3',
].map((txt) => ({
    label: txt,
    value: txt,
}));
export const LineStyleEditor = ({ value, onChange }) => {
    const options = useMemo(() => ((value === null || value === void 0 ? void 0 : value.fill) === 'dash' ? dashOptions : dotOptions), [value]);
    const current = useMemo(() => {
        var _a, _b;
        if (!((_a = value === null || value === void 0 ? void 0 : value.dash) === null || _a === void 0 ? void 0 : _a.length)) {
            return options[0];
        }
        const str = (_b = value.dash) === null || _b === void 0 ? void 0 : _b.join(', ');
        const val = options.find((o) => o.value === str);
        if (!val) {
            return {
                label: str,
                value: str,
            };
        }
        return val;
    }, [value, options]);
    return (React.createElement(HorizontalGroup, null,
        React.createElement(RadioButtonGroup, { value: (value === null || value === void 0 ? void 0 : value.fill) || 'solid', options: lineFillOptions, onChange: (v) => {
                let dash = undefined;
                if (v === 'dot') {
                    dash = parseText(dotOptions[0].value);
                }
                else if (v === 'dash') {
                    dash = parseText(dashOptions[0].value);
                }
                onChange(Object.assign(Object.assign({}, value), { fill: v, dash }));
            } }),
        (value === null || value === void 0 ? void 0 : value.fill) && (value === null || value === void 0 ? void 0 : value.fill) !== 'solid' && (React.createElement(React.Fragment, null,
            React.createElement(Select, { allowCustomValue: true, options: options, value: current, width: 20, onChange: (v) => {
                    var _a;
                    onChange(Object.assign(Object.assign({}, value), { dash: parseText((_a = v.value) !== null && _a !== void 0 ? _a : '') }));
                }, formatCreateLabel: (t) => `Segments: ${parseText(t).join(', ')}` }),
            React.createElement("div", null,
                "\u00A0",
                React.createElement("a", { title: "The input expects a segment list", href: "https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/setLineDash#Parameters", target: "_blank", rel: "noreferrer" },
                    React.createElement(IconButton, { name: "question-circle", tooltip: "Help" })))))));
};
function parseText(txt) {
    const segments = [];
    for (const s of txt.split(/(?:,| )+/)) {
        const num = Number.parseInt(s, 10);
        if (!isNaN(num)) {
            segments.push(num);
        }
    }
    return segments;
}
//# sourceMappingURL=LineStyleEditor.js.map