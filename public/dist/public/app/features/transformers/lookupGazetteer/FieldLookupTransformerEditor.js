import React, { useCallback } from 'react';
import { DataTransformerID, PluginState, FieldType, TransformerCategory, } from '@grafana/data';
import { InlineField, InlineFieldRow } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';
import { GazetteerPathEditor } from 'app/features/geo/editor/GazetteerPathEditor';
import { fieldLookupTransformer } from './fieldLookup';
const fieldNamePickerSettings = {
    settings: {
        width: 30,
        filter: (f) => f.type === FieldType.string,
        placeholderText: 'Select text field',
        noFieldsMessage: 'No text fields found',
    },
    name: '',
    id: '',
    editor: () => null,
};
const fieldLookupSettings = {
    settings: {},
};
export const FieldLookupTransformerEditor = ({ input, options, onChange }) => {
    var _a, _b;
    const onPickLookupField = useCallback((value) => {
        onChange(Object.assign(Object.assign({}, options), { lookupField: value }));
    }, [onChange, options]);
    const onPickGazetteer = useCallback((value) => {
        onChange(Object.assign(Object.assign({}, options), { gazetteer: value }));
    }, [onChange, options]);
    return (React.createElement("div", null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: 'Field', labelWidth: 12 },
                React.createElement(FieldNamePicker, { context: { data: input }, value: (_a = options === null || options === void 0 ? void 0 : options.lookupField) !== null && _a !== void 0 ? _a : '', onChange: onPickLookupField, item: fieldNamePickerSettings }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: 'Lookup', labelWidth: 12 },
                React.createElement(GazetteerPathEditor, { value: (_b = options === null || options === void 0 ? void 0 : options.gazetteer) !== null && _b !== void 0 ? _b : '', context: { data: input }, item: fieldLookupSettings, onChange: onPickGazetteer })))));
};
export const fieldLookupTransformRegistryItem = {
    id: DataTransformerID.fieldLookup,
    editor: FieldLookupTransformerEditor,
    transformation: fieldLookupTransformer,
    name: 'Field lookup',
    description: `Use a field value to lookup additional fields from an external source. This currently supports spatial data, but will eventually support more formats.`,
    state: PluginState.alpha,
    categories: new Set([TransformerCategory.PerformSpatialOperations]),
};
//# sourceMappingURL=FieldLookupTransformerEditor.js.map