import React, { useCallback } from 'react';
import { ResourceDimensionMode } from '@grafana/schema';
import { InlineField, InlineFieldRow, RadioButtonGroup } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';
import { getPublicOrAbsoluteUrl, ResourceFolderName } from '..';
import { MediaType, ResourcePickerSize } from '../types';
import { ResourcePicker } from './ResourcePicker';
const resourceOptions = [
    { label: 'Fixed', value: ResourceDimensionMode.Fixed, description: 'Fixed value' },
    { label: 'Field', value: ResourceDimensionMode.Field, description: 'Use a string field result' },
    //  { label: 'Mapping', value: ResourceDimensionMode.Mapping, description: 'Map the results of a value to an svg' },
];
const dummyFieldSettings = {
    settings: {},
};
export const ResourceDimensionEditor = (props) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    const { value, context, onChange, item } = props;
    const labelWidth = 9;
    const onModeChange = useCallback((mode) => {
        onChange(Object.assign(Object.assign({}, value), { mode }));
    }, [onChange, value]);
    const onFieldChange = useCallback((field = '') => {
        onChange(Object.assign(Object.assign({}, value), { field }));
    }, [onChange, value]);
    const onFixedChange = useCallback((fixed) => {
        onChange(Object.assign(Object.assign({}, value), { fixed: fixed !== null && fixed !== void 0 ? fixed : '' }));
    }, [onChange, value]);
    const onClear = (event) => {
        event.stopPropagation();
        onChange({ mode: ResourceDimensionMode.Fixed, fixed: '', field: '' });
    };
    const mode = (_a = value === null || value === void 0 ? void 0 : value.mode) !== null && _a !== void 0 ? _a : ResourceDimensionMode.Fixed;
    const showSourceRadio = (_c = (_b = item.settings) === null || _b === void 0 ? void 0 : _b.showSourceRadio) !== null && _c !== void 0 ? _c : true;
    const mediaType = (_e = (_d = item.settings) === null || _d === void 0 ? void 0 : _d.resourceType) !== null && _e !== void 0 ? _e : MediaType.Icon;
    const folderName = (_g = (_f = item.settings) === null || _f === void 0 ? void 0 : _f.folderName) !== null && _g !== void 0 ? _g : ResourceFolderName.Icon;
    let srcPath = '';
    if (mediaType === MediaType.Icon) {
        if (value === null || value === void 0 ? void 0 : value.fixed) {
            srcPath = getPublicOrAbsoluteUrl(value.fixed);
        }
        else if ((_h = item.settings) === null || _h === void 0 ? void 0 : _h.placeholderValue) {
            srcPath = getPublicOrAbsoluteUrl(item.settings.placeholderValue);
        }
    }
    return (React.createElement(React.Fragment, null,
        showSourceRadio && (React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Source", labelWidth: labelWidth, grow: true },
                React.createElement(RadioButtonGroup, { value: mode, options: resourceOptions, onChange: onModeChange, fullWidth: true })))),
        mode !== ResourceDimensionMode.Fixed && (React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Field", labelWidth: labelWidth, grow: true },
                React.createElement(FieldNamePicker, { context: context, value: (_j = value.field) !== null && _j !== void 0 ? _j : '', onChange: onFieldChange, item: dummyFieldSettings })))),
        mode === ResourceDimensionMode.Fixed && (React.createElement(ResourcePicker, { onChange: onFixedChange, onClear: onClear, value: value === null || value === void 0 ? void 0 : value.fixed, src: srcPath, placeholder: (_l = (_k = item.settings) === null || _k === void 0 ? void 0 : _k.placeholderText) !== null && _l !== void 0 ? _l : 'Select a value', name: (_m = niceName(value === null || value === void 0 ? void 0 : value.fixed)) !== null && _m !== void 0 ? _m : '', mediaType: mediaType, folderName: folderName, size: ResourcePickerSize.NORMAL })),
        mode === ResourceDimensionMode.Mapping && (React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Mappings", labelWidth: labelWidth, grow: true },
                React.createElement("div", null, "TODO mappings editor!"))))));
};
export function niceName(value) {
    if (!value) {
        return undefined;
    }
    const idx = value.lastIndexOf('/');
    if (idx > 0) {
        return value.substring(idx + 1);
    }
    return value;
}
//# sourceMappingURL=ResourceDimensionEditor.js.map