import { __assign, __makeTemplateObject } from "tslib";
import React from 'react';
import { ResourceDimensionMode, getPublicOrAbsoluteUrl, } from 'app/features/dimensions';
import { ColorDimensionEditor, ResourceDimensionEditor } from 'app/features/dimensions/editors';
import SVG from 'react-inlinesvg';
import { css } from '@emotion/css';
import { isString } from 'lodash';
// When a stoke is defined, we want the path to be in page units
var svgStrokePathClass = css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  path {\n    vector-effect: non-scaling-stroke;\n  }\n"], ["\n  path {\n    vector-effect: non-scaling-stroke;\n  }\n"])));
export function IconDisplay(props) {
    var width = props.width, height = props.height, data = props.data;
    if (!(data === null || data === void 0 ? void 0 : data.path)) {
        return null;
    }
    var svgStyle = {
        fill: data === null || data === void 0 ? void 0 : data.fill,
        stroke: data === null || data === void 0 ? void 0 : data.strokeColor,
        strokeWidth: data === null || data === void 0 ? void 0 : data.stroke,
    };
    return (React.createElement(SVG, { src: data.path, width: width, height: height, style: svgStyle, className: svgStyle.strokeWidth ? svgStrokePathClass : undefined }));
}
export var iconItem = {
    id: 'icon',
    name: 'Icon',
    description: 'SVG Icon display',
    display: IconDisplay,
    getNewOptions: function (options) { return (__assign(__assign({ placement: {
            width: 50,
            height: 50,
        } }, options), { config: {
            path: {
                mode: ResourceDimensionMode.Fixed,
                fixed: 'img/icons/unicons/question-circle.svg',
            },
            fill: { fixed: '#FFF899' },
        } })); },
    // Called when data changes
    prepareData: function (ctx, cfg) {
        var _a, _b;
        var path = undefined;
        if (cfg.path) {
            path = ctx.getResource(cfg.path).value();
        }
        if (!path || !isString(path)) {
            path = getPublicOrAbsoluteUrl('img/icons/unicons/question-circle.svg');
        }
        var data = {
            path: path,
            fill: cfg.fill ? ctx.getColor(cfg.fill).value() : '#CCC',
        };
        if (((_a = cfg.stroke) === null || _a === void 0 ? void 0 : _a.width) && cfg.stroke.color) {
            if (cfg.stroke.width > 0) {
                data.stroke = (_b = cfg.stroke) === null || _b === void 0 ? void 0 : _b.width;
                data.strokeColor = ctx.getColor(cfg.stroke.color).value();
            }
        }
        return data;
    },
    // Heatmap overlay options
    registerOptionsUI: function (builder) {
        var category = ['Icon'];
        builder
            .addCustomEditor({
            category: category,
            id: 'iconSelector',
            path: 'config.path',
            name: 'SVG Path',
            editor: ResourceDimensionEditor,
            settings: {
                resourceType: 'icon',
            },
        })
            .addCustomEditor({
            category: category,
            id: 'config.fill',
            path: 'config.fill',
            name: 'Fill color',
            editor: ColorDimensionEditor,
            settings: {},
            defaultValue: {
                // Configured values
                fixed: 'grey',
            },
        })
            .addSliderInput({
            category: category,
            path: 'config.stroke.width',
            name: 'Stroke',
            defaultValue: 0,
            settings: {
                min: 0,
                max: 10,
            },
        })
            .addCustomEditor({
            category: category,
            id: 'config.stroke.color',
            path: 'config.stroke.color',
            name: 'Stroke color',
            editor: ColorDimensionEditor,
            settings: {},
            defaultValue: {
                // Configured values
                fixed: 'grey',
            },
            showIf: function (cfg) { var _a, _b; return Boolean((_b = (_a = cfg === null || cfg === void 0 ? void 0 : cfg.config) === null || _a === void 0 ? void 0 : _a.stroke) === null || _b === void 0 ? void 0 : _b.width); },
        });
    },
};
var templateObject_1;
//# sourceMappingURL=icon.js.map