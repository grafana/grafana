import { css } from '@emotion/css';
import { isString } from 'lodash';
import React from 'react';
import { ResourceDimensionMode } from '@grafana/schema';
import { SanitizedSVG } from 'app/core/components/SVG/SanitizedSVG';
import { getPublicOrAbsoluteUrl } from 'app/features/dimensions';
import { ColorDimensionEditor, ResourceDimensionEditor } from 'app/features/dimensions/editors';
import { defaultBgColor } from '../element';
// When a stoke is defined, we want the path to be in page units
const svgStrokePathClass = css `
  path {
    vector-effect: non-scaling-stroke;
  }
`;
export function IconDisplay(props) {
    const { data } = props;
    if (!(data === null || data === void 0 ? void 0 : data.path)) {
        return null;
    }
    const svgStyle = {
        fill: data === null || data === void 0 ? void 0 : data.fill,
        stroke: data === null || data === void 0 ? void 0 : data.strokeColor,
        strokeWidth: data === null || data === void 0 ? void 0 : data.stroke,
        height: '100%',
        width: '100%',
    };
    return (React.createElement(SanitizedSVG, { src: data.path, style: svgStyle, className: svgStyle.strokeWidth ? svgStrokePathClass : undefined }));
}
export const iconItem = {
    id: 'icon',
    name: 'Icon',
    description: 'SVG Icon display',
    display: IconDisplay,
    getNewOptions: (options) => {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        return (Object.assign(Object.assign({}, options), { config: {
                path: {
                    mode: ResourceDimensionMode.Fixed,
                    fixed: 'img/icons/unicons/question-circle.svg',
                },
                fill: { fixed: defaultBgColor },
            }, background: {
                color: {
                    fixed: 'transparent',
                },
            }, placement: {
                width: (_b = (_a = options === null || options === void 0 ? void 0 : options.placement) === null || _a === void 0 ? void 0 : _a.width) !== null && _b !== void 0 ? _b : 100,
                height: (_d = (_c = options === null || options === void 0 ? void 0 : options.placement) === null || _c === void 0 ? void 0 : _c.height) !== null && _d !== void 0 ? _d : 100,
                top: (_f = (_e = options === null || options === void 0 ? void 0 : options.placement) === null || _e === void 0 ? void 0 : _e.top) !== null && _f !== void 0 ? _f : 100,
                left: (_h = (_g = options === null || options === void 0 ? void 0 : options.placement) === null || _g === void 0 ? void 0 : _g.left) !== null && _h !== void 0 ? _h : 100,
            } }));
    },
    // Called when data changes
    prepareData: (ctx, cfg) => {
        var _a, _b;
        let path = undefined;
        if (cfg.path) {
            path = ctx.getResource(cfg.path).value();
        }
        if (!path || !isString(path)) {
            path = getPublicOrAbsoluteUrl('img/icons/unicons/question-circle.svg');
        }
        const data = {
            path,
            fill: cfg.fill ? ctx.getColor(cfg.fill).value() : defaultBgColor,
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
    registerOptionsUI: (builder) => {
        const category = ['Icon'];
        builder
            .addCustomEditor({
            category,
            id: 'iconSelector',
            path: 'config.path',
            name: 'SVG Path',
            editor: ResourceDimensionEditor,
            settings: {
                resourceType: 'icon',
            },
        })
            .addCustomEditor({
            category,
            id: 'config.fill',
            path: 'config.fill',
            name: 'Fill color',
            editor: ColorDimensionEditor,
            settings: {},
            defaultValue: {
                // Configured values
                fixed: 'grey',
            },
        });
        // .addSliderInput({
        //   category,
        //   path: 'config.stroke.width',
        //   name: 'Stroke',
        //   defaultValue: 0,
        //   settings: {
        //     min: 0,
        //     max: 10,
        //   },
        // })
        // .addCustomEditor({
        //   category,
        //   id: 'config.stroke.color',
        //   path: 'config.stroke.color',
        //   name: 'Stroke color',
        //   editor: ColorDimensionEditor,
        //   settings: {},
        //   defaultValue: {
        //     // Configured values
        //     fixed: 'grey',
        //   },
        //   showIf: (cfg) => Boolean(cfg?.config?.stroke?.width),
        // })
    },
};
//# sourceMappingURL=icon.js.map