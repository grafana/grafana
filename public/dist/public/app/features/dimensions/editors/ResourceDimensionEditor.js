import { __assign, __makeTemplateObject, __read } from "tslib";
import React, { useCallback, useState } from 'react';
import { ResourceDimensionMode } from '../types';
import { InlineField, InlineFieldRow, RadioButtonGroup, Button, Modal, Input, useStyles2 } from '@grafana/ui';
import { FieldNamePicker } from '../../../../../packages/grafana-ui/src/components/MatchersUI/FieldNamePicker';
import { ResourcePicker } from './ResourcePicker';
import { getPublicOrAbsoluteUrl, ResourceFolderName } from '..';
import SVG from 'react-inlinesvg';
import { css } from '@emotion/css';
var resourceOptions = [
    { label: 'Fixed', value: ResourceDimensionMode.Fixed, description: 'Fixed value' },
    { label: 'Field', value: ResourceDimensionMode.Field, description: 'Use a string field result' },
    //  { label: 'Mapping', value: ResourceDimensionMode.Mapping, description: 'Map the results of a value to an svg' },
];
var dummyFieldSettings = {
    settings: {},
};
export var ResourceDimensionEditor = function (props) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    var value = props.value, context = props.context, onChange = props.onChange, item = props.item;
    var labelWidth = 9;
    var _j = __read(useState(false), 2), isOpen = _j[0], setOpen = _j[1];
    var styles = useStyles2(getStyles);
    var onModeChange = useCallback(function (mode) {
        onChange(__assign(__assign({}, value), { mode: mode }));
    }, [onChange, value]);
    var onFieldChange = useCallback(function (field) {
        onChange(__assign(__assign({}, value), { field: field }));
    }, [onChange, value]);
    var onFixedChange = useCallback(function (fixed) {
        onChange(__assign(__assign({}, value), { fixed: fixed !== null && fixed !== void 0 ? fixed : '' }));
        setOpen(false);
    }, [onChange, value]);
    var openModal = useCallback(function () {
        setOpen(true);
    }, []);
    var mode = (_a = value === null || value === void 0 ? void 0 : value.mode) !== null && _a !== void 0 ? _a : ResourceDimensionMode.Fixed;
    var showSourceRadio = (_c = (_b = item.settings) === null || _b === void 0 ? void 0 : _b.showSourceRadio) !== null && _c !== void 0 ? _c : true;
    var mediaType = (_e = (_d = item.settings) === null || _d === void 0 ? void 0 : _d.resourceType) !== null && _e !== void 0 ? _e : 'icon';
    var folderName = (_g = (_f = item.settings) === null || _f === void 0 ? void 0 : _f.folderName) !== null && _g !== void 0 ? _g : ResourceFolderName.Icon;
    var srcPath = mediaType === 'icon' && value ? getPublicOrAbsoluteUrl(value === null || value === void 0 ? void 0 : value.fixed) : '';
    return (React.createElement(React.Fragment, null,
        isOpen && (React.createElement(Modal, { isOpen: isOpen, title: "Select " + mediaType, onDismiss: function () { return setOpen(false); }, closeOnEscape: true },
            React.createElement(ResourcePicker, { onChange: onFixedChange, value: value === null || value === void 0 ? void 0 : value.fixed, mediaType: mediaType, folderName: folderName }))),
        showSourceRadio && (React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Source", labelWidth: labelWidth, grow: true },
                React.createElement(RadioButtonGroup, { value: mode, options: resourceOptions, onChange: onModeChange, fullWidth: true })))),
        mode !== ResourceDimensionMode.Fixed && (React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Field", labelWidth: labelWidth, grow: true },
                React.createElement(FieldNamePicker, { context: context, value: (_h = value.field) !== null && _h !== void 0 ? _h : '', onChange: onFieldChange, item: dummyFieldSettings })))),
        mode === ResourceDimensionMode.Fixed && (React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: null, grow: true },
                React.createElement(Input, { value: niceName(value === null || value === void 0 ? void 0 : value.fixed), placeholder: "Resource URL", readOnly: true, onClick: openModal, prefix: srcPath && React.createElement(SVG, { src: srcPath, className: styles.icon }) })),
            React.createElement(Button, { icon: "folder-open", variant: "secondary", onClick: openModal }))),
        mode === ResourceDimensionMode.Mapping && (React.createElement(InlineFieldRow, null,
            React.createElement(InlineField, { label: "Mappings", labelWidth: labelWidth, grow: true },
                React.createElement("div", null, "TODO mappings editor!"))))));
};
export function niceName(value) {
    if (!value) {
        return undefined;
    }
    var idx = value.lastIndexOf('/');
    if (idx > 0) {
        return value.substring(idx + 1);
    }
    return value;
}
var getStyles = function (theme) { return ({
    icon: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    vertical-align: middle;\n    display: inline-block;\n    fill: currentColor;\n  "], ["\n    vertical-align: middle;\n    display: inline-block;\n    fill: currentColor;\n  "]))),
}); };
var templateObject_1;
//# sourceMappingURL=ResourceDimensionEditor.js.map