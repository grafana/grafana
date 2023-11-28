import React, { useCallback, useMemo } from 'react';
import { InlineFieldRow, InlineField, RadioButtonGroup, Select } from '@grafana/ui';
import { NumberInput } from 'app/core/components/OptionsUI/NumberInput';
// Data scope options for 'Fit to data'
var DataScopeValues;
(function (DataScopeValues) {
    DataScopeValues["all"] = "all";
    DataScopeValues["layer"] = "layer";
    DataScopeValues["last"] = "last";
})(DataScopeValues || (DataScopeValues = {}));
var DataScopeLabels;
(function (DataScopeLabels) {
    DataScopeLabels["all"] = "All layers";
    DataScopeLabels["layer"] = "Layer";
    DataScopeLabels["last"] = "Last value";
})(DataScopeLabels || (DataScopeLabels = {}));
const ScopeOptions = Object.values(DataScopeValues);
const DataScopeOptions = ScopeOptions.map((dataScopeOption) => ({
    label: DataScopeLabels[dataScopeOption],
    value: dataScopeOption,
}));
export const FitMapViewEditor = ({ labelWidth, value, onChange, context }) => {
    var _a, _b, _c;
    const layers = useMemo(() => {
        var _a;
        if ((_a = context.options) === null || _a === void 0 ? void 0 : _a.layers) {
            return context.options.layers.map((layer) => ({
                label: layer.name,
                value: layer.name,
                description: undefined,
            }));
        }
        return [];
    }, [(_a = context.options) === null || _a === void 0 ? void 0 : _a.layers]);
    const onSelectLayer = useCallback((selection) => {
        onChange(Object.assign(Object.assign({}, value), { layer: selection.value }));
    }, [value, onChange]);
    const allLayersEditorFragment = (React.createElement(InlineFieldRow, null,
        React.createElement(InlineField, { label: "Layer", labelWidth: labelWidth, grow: true },
            React.createElement(Select, { options: layers, onChange: onSelectLayer, placeholder: (_b = layers[0]) === null || _b === void 0 ? void 0 : _b.label }))));
    const onChangePadding = (padding) => {
        onChange(Object.assign(Object.assign({}, value), { padding: padding }));
    };
    const lastOnlyEditorFragment = (React.createElement(InlineFieldRow, null,
        React.createElement(InlineField, { label: "Padding", labelWidth: labelWidth, grow: true, tooltip: "sets padding in relative percent beyond data extent" },
            React.createElement(NumberInput, { value: (_c = value === null || value === void 0 ? void 0 : value.padding) !== null && _c !== void 0 ? _c : 5, min: 0, step: 1, onChange: onChangePadding }))));
    const currentDataScope = value.allLayers
        ? DataScopeValues.all
        : !value.allLayers && value.lastOnly
            ? DataScopeValues.last
            : DataScopeValues.layer;
    const onDataScopeChange = (dataScope) => {
        if (dataScope !== DataScopeValues.all && !value.layer) {
            onChange(Object.assign(Object.assign({}, value), { allLayers: dataScope === String(DataScopeValues.all), lastOnly: dataScope === String(DataScopeValues.last), layer: layers[0].value }));
        }
        else {
            onChange(Object.assign(Object.assign({}, value), { allLayers: dataScope === String(DataScopeValues.all), lastOnly: dataScope === String(DataScopeValues.last) }));
        }
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Data", labelWidth: labelWidth, grow: true },
                React.createElement(RadioButtonGroup, { value: currentDataScope, options: DataScopeOptions, onChange: onDataScopeChange }))),
        !(value === null || value === void 0 ? void 0 : value.allLayers) && allLayersEditorFragment,
        !(value === null || value === void 0 ? void 0 : value.lastOnly) && lastOnlyEditorFragment));
};
//# sourceMappingURL=FitMapViewEditor.js.map