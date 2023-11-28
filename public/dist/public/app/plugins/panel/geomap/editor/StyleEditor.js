import { capitalize } from 'lodash';
import React, { useMemo } from 'react';
import { useObservable } from 'react-use';
import { of } from 'rxjs';
import { ColorPicker, Field, HorizontalGroup, InlineField, InlineFieldRow, InlineLabel, RadioButtonGroup, } from '@grafana/ui';
import { NumberValueEditor } from 'app/core/components/OptionsUI/number';
import { SliderValueEditor } from 'app/core/components/OptionsUI/slider';
import { ColorDimensionEditor, ResourceDimensionEditor, ScaleDimensionEditor, ScalarDimensionEditor, TextDimensionEditor, } from 'app/features/dimensions/editors';
import { ResourceFolderName, defaultTextConfig, MediaType } from 'app/features/dimensions/types';
import { HorizontalAlign, VerticalAlign, defaultStyleConfig, GeometryTypeId, TextAlignment, TextBaseline, } from '../style/types';
import { styleUsesText } from '../style/utils';
export const StyleEditor = (props) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1;
    const { value, onChange, item } = props;
    const context = useMemo(() => {
        var _a;
        if (!((_a = item.settings) === null || _a === void 0 ? void 0 : _a.frameMatcher)) {
            return props.context;
        }
        return Object.assign(Object.assign({}, props.context), { data: props.context.data.filter(item.settings.frameMatcher) });
    }, [props.context, item.settings]);
    const settings = item.settings;
    const onSizeChange = (sizeValue) => {
        onChange(Object.assign(Object.assign({}, value), { size: sizeValue }));
    };
    const onSymbolChange = (symbolValue) => {
        onChange(Object.assign(Object.assign({}, value), { symbol: symbolValue }));
    };
    const onColorChange = (colorValue) => {
        onChange(Object.assign(Object.assign({}, value), { color: colorValue }));
    };
    const onOpacityChange = (opacityValue) => {
        onChange(Object.assign(Object.assign({}, value), { opacity: opacityValue }));
    };
    const onRotationChange = (rotationValue) => {
        onChange(Object.assign(Object.assign({}, value), { rotation: rotationValue }));
    };
    const onTextChange = (textValue) => {
        onChange(Object.assign(Object.assign({}, value), { text: textValue }));
    };
    const onTextFontSizeChange = (fontSize) => {
        onChange(Object.assign(Object.assign({}, value), { textConfig: Object.assign(Object.assign({}, value.textConfig), { fontSize }) }));
    };
    const onTextOffsetXChange = (offsetX) => {
        onChange(Object.assign(Object.assign({}, value), { textConfig: Object.assign(Object.assign({}, value.textConfig), { offsetX }) }));
    };
    const onTextOffsetYChange = (offsetY) => {
        onChange(Object.assign(Object.assign({}, value), { textConfig: Object.assign(Object.assign({}, value.textConfig), { offsetY }) }));
    };
    const onTextAlignChange = (textAlign) => {
        onChange(Object.assign(Object.assign({}, value), { textConfig: Object.assign(Object.assign({}, value.textConfig), { textAlign: textAlign }) }));
    };
    const onTextBaselineChange = (textBaseline) => {
        onChange(Object.assign(Object.assign({}, value), { textConfig: Object.assign(Object.assign({}, value.textConfig), { textBaseline: textBaseline }) }));
    };
    const onAlignHorizontalChange = (alignHorizontal) => {
        onChange(Object.assign(Object.assign({}, value), { symbolAlign: Object.assign(Object.assign({}, value.symbolAlign), { horizontal: alignHorizontal }) }));
    };
    const onAlignVerticalChange = (alignVertical) => {
        onChange(Object.assign(Object.assign({}, value), { symbolAlign: Object.assign(Object.assign({}, value.symbolAlign), { vertical: alignVertical }) }));
    };
    const propertyOptions = useObservable((_a = settings === null || settings === void 0 ? void 0 : settings.layerInfo) !== null && _a !== void 0 ? _a : of());
    const featuresHavePoints = (propertyOptions === null || propertyOptions === void 0 ? void 0 : propertyOptions.geometryType) === GeometryTypeId.Point;
    const hasTextLabel = styleUsesText(value);
    // Simple fixed value display
    if (settings === null || settings === void 0 ? void 0 : settings.simpleFixedValues) {
        return (React.createElement(React.Fragment, null,
            featuresHavePoints && (React.createElement(React.Fragment, null,
                React.createElement(InlineFieldRow, null,
                    React.createElement(InlineField, { label: 'Symbol' },
                        React.createElement(ResourceDimensionEditor, { value: (_b = value === null || value === void 0 ? void 0 : value.symbol) !== null && _b !== void 0 ? _b : defaultStyleConfig.symbol, context: context, onChange: onSymbolChange, item: {
                                settings: {
                                    resourceType: 'icon',
                                    folderName: ResourceFolderName.Marker,
                                    placeholderText: hasTextLabel ? 'Select a symbol' : 'Select a symbol or add a text label',
                                    placeholderValue: defaultStyleConfig.symbol.fixed,
                                    showSourceRadio: false,
                                },
                            } }))),
                React.createElement(Field, { label: 'Rotation angle' },
                    React.createElement(ScalarDimensionEditor, { value: (_c = value === null || value === void 0 ? void 0 : value.rotation) !== null && _c !== void 0 ? _c : defaultStyleConfig.rotation, context: context, onChange: onRotationChange, item: {
                            settings: {
                                min: defaultStyleConfig.rotation.min,
                                max: defaultStyleConfig.rotation.max,
                            },
                        } })))),
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { label: "Color", labelWidth: 10 },
                    React.createElement(InlineLabel, { width: 4 },
                        React.createElement(ColorPicker, { color: (_e = (_d = value === null || value === void 0 ? void 0 : value.color) === null || _d === void 0 ? void 0 : _d.fixed) !== null && _e !== void 0 ? _e : defaultStyleConfig.color.fixed, onChange: (v) => {
                                onColorChange({ fixed: v });
                            } })))),
            React.createElement(InlineFieldRow, null,
                React.createElement(InlineField, { label: "Opacity", labelWidth: 10, grow: true },
                    React.createElement(SliderValueEditor, { value: (_f = value === null || value === void 0 ? void 0 : value.opacity) !== null && _f !== void 0 ? _f : defaultStyleConfig.opacity, context: context, onChange: onOpacityChange, item: {
                            settings: {
                                min: 0,
                                max: 1,
                                step: 0.1,
                            },
                        } })))));
    }
    return (React.createElement(React.Fragment, null,
        React.createElement(Field, { label: 'Size' },
            React.createElement(ScaleDimensionEditor, { value: (_g = value === null || value === void 0 ? void 0 : value.size) !== null && _g !== void 0 ? _g : defaultStyleConfig.size, context: context, onChange: onSizeChange, item: {
                    settings: {
                        min: 1,
                        max: 100,
                    },
                } })),
        !(settings === null || settings === void 0 ? void 0 : settings.hideSymbol) && (React.createElement(React.Fragment, null,
            React.createElement(Field, { label: 'Symbol' },
                React.createElement(ResourceDimensionEditor, { value: (_h = value === null || value === void 0 ? void 0 : value.symbol) !== null && _h !== void 0 ? _h : defaultStyleConfig.symbol, context: context, onChange: onSymbolChange, item: {
                        settings: {
                            resourceType: MediaType.Icon,
                            folderName: ResourceFolderName.Marker,
                            placeholderText: hasTextLabel ? 'Select a symbol' : 'Select a symbol or add a text label',
                            placeholderValue: defaultStyleConfig.symbol.fixed,
                            showSourceRadio: false,
                        },
                    } })),
            React.createElement(Field, { label: 'Symbol Vertical Align' },
                React.createElement(RadioButtonGroup, { value: (_k = (_j = value === null || value === void 0 ? void 0 : value.symbolAlign) === null || _j === void 0 ? void 0 : _j.vertical) !== null && _k !== void 0 ? _k : defaultStyleConfig.symbolAlign.vertical, onChange: onAlignVerticalChange, options: [
                        { value: VerticalAlign.Top, label: capitalize(VerticalAlign.Top) },
                        { value: VerticalAlign.Center, label: capitalize(VerticalAlign.Center) },
                        { value: VerticalAlign.Bottom, label: capitalize(VerticalAlign.Bottom) },
                    ] })),
            React.createElement(Field, { label: 'Symbol Horizontal Align' },
                React.createElement(RadioButtonGroup, { value: (_m = (_l = value === null || value === void 0 ? void 0 : value.symbolAlign) === null || _l === void 0 ? void 0 : _l.horizontal) !== null && _m !== void 0 ? _m : defaultStyleConfig.symbolAlign.horizontal, onChange: onAlignHorizontalChange, options: [
                        { value: HorizontalAlign.Left, label: capitalize(HorizontalAlign.Left) },
                        { value: HorizontalAlign.Center, label: capitalize(HorizontalAlign.Center) },
                        { value: HorizontalAlign.Right, label: capitalize(HorizontalAlign.Right) },
                    ] })))),
        React.createElement(Field, { label: 'Color' },
            React.createElement(ColorDimensionEditor, { value: (_o = value === null || value === void 0 ? void 0 : value.color) !== null && _o !== void 0 ? _o : defaultStyleConfig.color, context: context, onChange: onColorChange, item: {} })),
        React.createElement(Field, { label: 'Fill opacity' },
            React.createElement(SliderValueEditor, { value: (_p = value === null || value === void 0 ? void 0 : value.opacity) !== null && _p !== void 0 ? _p : defaultStyleConfig.opacity, context: context, onChange: onOpacityChange, item: {
                    settings: {
                        min: 0,
                        max: 1,
                        step: 0.1,
                    },
                } })),
        (settings === null || settings === void 0 ? void 0 : settings.displayRotation) && (React.createElement(Field, { label: 'Rotation angle' },
            React.createElement(ScalarDimensionEditor, { value: (_q = value === null || value === void 0 ? void 0 : value.rotation) !== null && _q !== void 0 ? _q : defaultStyleConfig.rotation, context: context, onChange: onRotationChange, item: {
                    settings: {
                        min: defaultStyleConfig.rotation.min,
                        max: defaultStyleConfig.rotation.max,
                    },
                } }))),
        React.createElement(Field, { label: 'Text label' },
            React.createElement(TextDimensionEditor, { value: (_r = value === null || value === void 0 ? void 0 : value.text) !== null && _r !== void 0 ? _r : defaultTextConfig, context: context, onChange: onTextChange, item: {} })),
        hasTextLabel && (React.createElement(React.Fragment, null,
            React.createElement(HorizontalGroup, null,
                React.createElement(Field, { label: 'Font size' },
                    React.createElement(NumberValueEditor, { value: (_t = (_s = value === null || value === void 0 ? void 0 : value.textConfig) === null || _s === void 0 ? void 0 : _s.fontSize) !== null && _t !== void 0 ? _t : defaultStyleConfig.textConfig.fontSize, context: context, onChange: onTextFontSizeChange, item: {} })),
                React.createElement(Field, { label: 'X offset' },
                    React.createElement(NumberValueEditor, { value: (_v = (_u = value === null || value === void 0 ? void 0 : value.textConfig) === null || _u === void 0 ? void 0 : _u.offsetX) !== null && _v !== void 0 ? _v : defaultStyleConfig.textConfig.offsetX, context: context, onChange: onTextOffsetXChange, item: {} })),
                React.createElement(Field, { label: 'Y offset' },
                    React.createElement(NumberValueEditor, { value: (_x = (_w = value === null || value === void 0 ? void 0 : value.textConfig) === null || _w === void 0 ? void 0 : _w.offsetY) !== null && _x !== void 0 ? _x : defaultStyleConfig.textConfig.offsetY, context: context, onChange: onTextOffsetYChange, item: {} }))),
            React.createElement(Field, { label: 'Align' },
                React.createElement(RadioButtonGroup, { value: (_z = (_y = value === null || value === void 0 ? void 0 : value.textConfig) === null || _y === void 0 ? void 0 : _y.textAlign) !== null && _z !== void 0 ? _z : defaultStyleConfig.textConfig.textAlign, onChange: onTextAlignChange, options: [
                        { value: TextAlignment.Left, label: capitalize(TextAlignment.Left) },
                        { value: TextAlignment.Center, label: capitalize(TextAlignment.Center) },
                        { value: TextAlignment.Right, label: capitalize(TextAlignment.Right) },
                    ] })),
            React.createElement(Field, { label: 'Baseline' },
                React.createElement(RadioButtonGroup, { value: (_1 = (_0 = value === null || value === void 0 ? void 0 : value.textConfig) === null || _0 === void 0 ? void 0 : _0.textBaseline) !== null && _1 !== void 0 ? _1 : defaultStyleConfig.textConfig.textBaseline, onChange: onTextBaselineChange, options: [
                        { value: TextBaseline.Top, label: capitalize(TextBaseline.Top) },
                        { value: TextBaseline.Middle, label: capitalize(TextBaseline.Middle) },
                        { value: TextBaseline.Bottom, label: capitalize(TextBaseline.Bottom) },
                    ] }))))));
};
//# sourceMappingURL=StyleEditor.js.map