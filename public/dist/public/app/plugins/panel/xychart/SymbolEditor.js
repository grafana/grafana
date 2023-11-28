import React from 'react';
import { ResourceDimensionMode } from '@grafana/schema';
import { RadioButtonGroup } from '@grafana/ui';
export const SymbolEditor = (props) => {
    const { value } = props;
    const basicSymbols = [
        { value: 'img/icons/marker/circle.svg', label: 'Circle' },
        { value: 'img/icons/marker/square.svg', label: 'Square' },
    ];
    const onSymbolChange = (v) => {
        props.onChange({
            fixed: v,
            mode: ResourceDimensionMode.Fixed,
        });
    };
    return (React.createElement("div", null,
        React.createElement(RadioButtonGroup, { options: basicSymbols, value: value.fixed, onChange: onSymbolChange }),
        !basicSymbols.find((v) => v.value === value.fixed) && React.createElement("div", null, value.fixed)));
};
//# sourceMappingURL=SymbolEditor.js.map