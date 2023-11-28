import React, { useId } from 'react';
import { Select, Input, Field, FieldSet } from '@grafana/ui';
const tsdbVersions = [
    { label: '<=2.1', value: 1 },
    { label: '==2.2', value: 2 },
    { label: '==2.3', value: 3 },
];
const tsdbResolutions = [
    { label: 'second', value: 1 },
    { label: 'millisecond', value: 2 },
];
export const OpenTsdbDetails = (props) => {
    var _a, _b, _c;
    const { onChange, value } = props;
    const idSuffix = useId();
    return (React.createElement(React.Fragment, null,
        React.createElement(FieldSet, { label: "OpenTSDB settings" },
            React.createElement(Field, { htmlFor: `select-version-${idSuffix}`, label: "Version" },
                React.createElement(Select, { inputId: `select-version-${idSuffix}`, options: tsdbVersions, value: (_a = tsdbVersions.find((version) => version.value === value.jsonData.tsdbVersion)) !== null && _a !== void 0 ? _a : tsdbVersions[0], onChange: onSelectChangeHandler('tsdbVersion', value, onChange), width: 20 })),
            React.createElement(Field, { htmlFor: `select-resolution-${idSuffix}`, label: "Resolution" },
                React.createElement(Select, { inputId: `select-resolution-${idSuffix}`, options: tsdbResolutions, value: (_b = tsdbResolutions.find((resolution) => resolution.value === value.jsonData.tsdbResolution)) !== null && _b !== void 0 ? _b : tsdbResolutions[0], onChange: onSelectChangeHandler('tsdbResolution', value, onChange), width: 20 })),
            React.createElement(Field, { htmlFor: `lookup-input-${idSuffix}`, label: "Lookup limit" },
                React.createElement(Input, { id: `lookup-input-${idSuffix}`, type: "number", value: (_c = value.jsonData.lookupLimit) !== null && _c !== void 0 ? _c : 1000, onChange: onInputChangeHandler('lookupLimit', value, onChange), width: 20 })))));
};
const onSelectChangeHandler = (key, value, onChange) => (newValue) => {
    onChange(Object.assign(Object.assign({}, value), { jsonData: Object.assign(Object.assign({}, value.jsonData), { [key]: newValue.value }) }));
};
const onInputChangeHandler = (key, value, onChange) => (event) => {
    onChange(Object.assign(Object.assign({}, value), { jsonData: Object.assign(Object.assign({}, value.jsonData), { [key]: event.currentTarget.value }) }));
};
//# sourceMappingURL=OpenTsdbDetails.js.map