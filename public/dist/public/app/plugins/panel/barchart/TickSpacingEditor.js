import React from 'react';
import { Checkbox, HorizontalGroup, RadioButtonGroup, Tooltip } from '@grafana/ui';
const GAPS_OPTIONS = [
    {
        label: 'None',
        value: 0,
        description: 'Show all tick marks',
    },
    {
        label: 'Small',
        value: 100,
        description: 'Require 100px spacing',
    },
    {
        label: 'Medium',
        value: 200,
        description: 'Require 200px spacing',
    },
    {
        label: 'Large',
        value: 300,
        description: 'Require 300px spacing',
    },
];
export const TickSpacingEditor = (props) => {
    var _a;
    let value = (_a = props.value) !== null && _a !== void 0 ? _a : 0;
    const isRTL = value < 0;
    if (isRTL) {
        value *= -1;
    }
    let gap = GAPS_OPTIONS[0];
    for (const v of GAPS_OPTIONS) {
        gap = v;
        if (value <= gap.value) {
            break;
        }
    }
    const onSpacingChange = (val) => {
        props.onChange(val * (isRTL ? -1 : 1));
    };
    const onRTLChange = () => {
        props.onChange(props.value * -1);
    };
    return (React.createElement(HorizontalGroup, null,
        React.createElement(RadioButtonGroup, { value: gap.value, options: GAPS_OPTIONS, onChange: onSpacingChange }),
        value !== 0 && (React.createElement(Tooltip, { content: "Require space from the right side", placement: "top" },
            React.createElement("div", null,
                React.createElement(Checkbox, { value: isRTL, onChange: onRTLChange, label: "RTL" }))))));
};
//# sourceMappingURL=TickSpacingEditor.js.map