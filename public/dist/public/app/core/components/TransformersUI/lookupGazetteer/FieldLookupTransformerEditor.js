import { __assign } from "tslib";
import React, { useCallback } from 'react';
import { DataTransformerID, PluginState, } from '@grafana/data';
import { InlineField, InlineFieldRow } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';
import { GazetteerPathEditor } from 'app/plugins/panel/geomap/editor/GazetteerPathEditor';
import { fieldLookupTransformer } from './fieldLookup';
import { FieldType } from '../../../../../../packages/grafana-data/src';
var fieldNamePickerSettings = {
    settings: {
        width: 30,
        filter: function (f) { return f.type === FieldType.string; },
        placeholderText: 'Select text field',
        noFieldsMessage: 'No text fields found',
    },
    name: '',
    id: '',
    editor: function () { return null; },
};
var fieldLookupSettings = {
    settings: {},
};
export var FieldLookupTransformerEditor = function (_a) {
    var _b, _c;
    var input = _a.input, options = _a.options, onChange = _a.onChange;
    var onPickLookupField = useCallback(function (value) {
        onChange(__assign(__assign({}, options), { lookupField: value }));
    }, [onChange, options]);
    var onPickGazetteer = useCallback(function (value) {
        onChange(__assign(__assign({}, options), { gazetteer: value }));
    }, [onChange, options]);
    return (React.createElement("div", null,
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: 'Field', labelWidth: 12 },
                React.createElement(FieldNamePicker, { context: { data: input }, value: (_b = options === null || options === void 0 ? void 0 : options.lookupField) !== null && _b !== void 0 ? _b : '', onChange: onPickLookupField, item: fieldNamePickerSettings }))),
        React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: 'Lookup', labelWidth: 12 },
                React.createElement(GazetteerPathEditor, { value: (_c = options === null || options === void 0 ? void 0 : options.gazetteer) !== null && _c !== void 0 ? _c : '', context: { data: input }, item: fieldLookupSettings, onChange: onPickGazetteer })))));
};
export var fieldLookupTransformRegistryItem = {
    id: DataTransformerID.fieldLookup,
    editor: FieldLookupTransformerEditor,
    transformation: fieldLookupTransformer,
    name: 'Field lookup',
    description: "Use a field value to lookup additional fields from an external source.  This current supports spatial data, but will eventuall support more formats",
    state: PluginState.alpha,
};
//# sourceMappingURL=FieldLookupTransformerEditor.js.map