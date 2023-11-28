import React, { useState } from 'react';
import { HorizontalGroup, IconButton, Input, VerticalGroup } from '@grafana/ui';
export const ParamsEditor = ({ value, onChange }) => {
    const [paramName, setParamName] = useState('');
    const [paramValue, setParamValue] = useState('');
    const changeParamValue = ({ currentTarget }) => {
        setParamValue(currentTarget.value);
    };
    const changeParamName = ({ currentTarget }) => {
        setParamName(currentTarget.value);
    };
    const removeParam = (key) => () => {
        const updatedParams = value.filter((param) => param[0] !== key);
        onChange(updatedParams);
    };
    const addParam = () => {
        const key = paramName;
        let newParams;
        if (value) {
            newParams = value.filter((e) => e[0] !== key);
        }
        else {
            newParams = [];
        }
        newParams.push([key, paramValue]);
        newParams.sort((a, b) => a[0].localeCompare(b[0]));
        setParamName('');
        setParamValue('');
        onChange(newParams);
    };
    const isAddParamsDisabled = !paramName && !paramValue;
    return (React.createElement("div", null,
        React.createElement(HorizontalGroup, null,
            React.createElement(Input, { placeholder: "Key", value: paramName, onChange: changeParamName }),
            React.createElement(Input, { placeholder: "Value", value: paramValue, onChange: changeParamValue }),
            React.createElement(IconButton, { "aria-label": "add", name: "plus-circle", onClick: addParam, disabled: isAddParamsDisabled })),
        React.createElement(VerticalGroup, null, Array.from(value || []).map((entry) => (React.createElement(HorizontalGroup, { key: entry[0] },
            React.createElement(Input, { disabled: true, value: entry[0] }),
            React.createElement(Input, { disabled: true, value: entry[1] }),
            React.createElement(IconButton, { "aria-label": "delete", onClick: removeParam(entry[0]), name: "trash-alt" })))))));
};
//# sourceMappingURL=ParamsEditor.js.map