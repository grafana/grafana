import { css } from '@emotion/css';
import React from 'react';
import { PluginState } from '@grafana/data/src';
import { TextDimensionMode } from '@grafana/schema';
import { Button, Spinner, useStyles2 } from '@grafana/ui';
import { ColorDimensionEditor } from 'app/features/dimensions/editors';
import { TextDimensionEditor } from 'app/features/dimensions/editors/TextDimensionEditor';
import { APIEditor } from 'app/plugins/panel/canvas/editor/element/APIEditor';
import { ButtonStyleEditor } from 'app/plugins/panel/canvas/editor/element/ButtonStyleEditor';
import { callApi } from 'app/plugins/panel/canvas/editor/element/utils';
import { HttpRequestMethod } from 'app/plugins/panel/canvas/panelcfg.gen';
import { defaultLightTextColor } from '../element';
import { Align } from '../types';
export const defaultApiConfig = {
    endpoint: '',
    method: HttpRequestMethod.POST,
    data: '{}',
    contentType: 'application/json',
    queryParams: [],
    headerParams: [],
};
export const defaultStyleConfig = {
    variant: 'primary',
};
const ButtonDisplay = ({ data }) => {
    var _a;
    const styles = useStyles2(getStyles, data);
    const [isLoading, setIsLoading] = React.useState(false);
    const updateLoadingStateCallback = (loading) => {
        setIsLoading(loading);
    };
    const onClick = () => {
        var _a;
        if ((data === null || data === void 0 ? void 0 : data.api) && ((_a = data === null || data === void 0 ? void 0 : data.api) === null || _a === void 0 ? void 0 : _a.endpoint)) {
            setIsLoading(true);
            callApi(data.api, updateLoadingStateCallback);
        }
    };
    return (React.createElement(Button, { type: "submit", variant: (_a = data === null || data === void 0 ? void 0 : data.style) === null || _a === void 0 ? void 0 : _a.variant, onClick: onClick, className: styles.button },
        React.createElement("span", null,
            isLoading && React.createElement(Spinner, { inline: true, className: styles.buttonSpinner }), data === null || data === void 0 ? void 0 :
            data.text)));
};
const getStyles = (theme, data) => ({
    button: css({
        height: '100%',
        width: '100%',
        display: 'grid',
        '> span': {
            display: 'inline-grid',
            gridAutoFlow: 'column',
            textAlign: data === null || data === void 0 ? void 0 : data.align,
            fontSize: `${data === null || data === void 0 ? void 0 : data.size}px`,
            color: data === null || data === void 0 ? void 0 : data.color,
        },
    }),
    buttonSpinner: css({
        marginRight: theme.spacing(0.5),
    }),
});
export const buttonItem = {
    id: 'button',
    name: 'Button',
    description: 'Button',
    state: PluginState.beta,
    standardEditorConfig: {
        background: false,
    },
    display: ButtonDisplay,
    defaultSize: {
        width: 150,
        height: 45,
    },
    getNewOptions: (options) => {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        return (Object.assign(Object.assign({}, options), { config: {
                text: {
                    mode: TextDimensionMode.Fixed,
                    fixed: 'Button',
                },
                align: Align.Center,
                color: {
                    fixed: defaultLightTextColor,
                },
                size: 14,
                api: defaultApiConfig,
                style: defaultStyleConfig,
            }, background: {
                color: {
                    fixed: 'transparent',
                },
            }, placement: {
                width: (_b = (_a = options === null || options === void 0 ? void 0 : options.placement) === null || _a === void 0 ? void 0 : _a.width) !== null && _b !== void 0 ? _b : 32,
                height: (_d = (_c = options === null || options === void 0 ? void 0 : options.placement) === null || _c === void 0 ? void 0 : _c.height) !== null && _d !== void 0 ? _d : 78,
                top: (_f = (_e = options === null || options === void 0 ? void 0 : options.placement) === null || _e === void 0 ? void 0 : _e.top) !== null && _f !== void 0 ? _f : 100,
                left: (_h = (_g = options === null || options === void 0 ? void 0 : options.placement) === null || _g === void 0 ? void 0 : _g.left) !== null && _h !== void 0 ? _h : 100,
            } }));
    },
    // Called when data changes
    prepareData: (ctx, cfg) => {
        var _a, _b, _c;
        const getCfgApi = () => {
            var _a, _b;
            if (cfg === null || cfg === void 0 ? void 0 : cfg.api) {
                cfg.api = Object.assign(Object.assign({}, cfg.api), { method: (_a = cfg.api.method) !== null && _a !== void 0 ? _a : defaultApiConfig.method, contentType: (_b = cfg.api.contentType) !== null && _b !== void 0 ? _b : defaultApiConfig.contentType });
                return cfg.api;
            }
            return undefined;
        };
        const data = {
            text: (cfg === null || cfg === void 0 ? void 0 : cfg.text) ? ctx.getText(cfg.text).value() : '',
            align: (_a = cfg.align) !== null && _a !== void 0 ? _a : Align.Center,
            size: (_b = cfg.size) !== null && _b !== void 0 ? _b : 14,
            api: getCfgApi(),
            style: (_c = cfg === null || cfg === void 0 ? void 0 : cfg.style) !== null && _c !== void 0 ? _c : defaultStyleConfig,
        };
        if (cfg.color) {
            data.color = ctx.getColor(cfg.color).value();
        }
        return data;
    },
    // Heatmap overlay options
    registerOptionsUI: (builder) => {
        const category = ['Button'];
        builder
            .addCustomEditor({
            category,
            id: 'styleSelector',
            path: 'config.style',
            name: 'Style',
            editor: ButtonStyleEditor,
        })
            .addCustomEditor({
            category,
            id: 'textSelector',
            path: 'config.text',
            name: 'Text',
            editor: TextDimensionEditor,
        })
            .addCustomEditor({
            category,
            id: 'config.color',
            path: 'config.color',
            name: 'Text color',
            editor: ColorDimensionEditor,
            settings: {},
            defaultValue: {},
        })
            .addRadio({
            category,
            path: 'config.align',
            name: 'Align text',
            settings: {
                options: [
                    { value: Align.Left, label: 'Left' },
                    { value: Align.Center, label: 'Center' },
                    { value: Align.Right, label: 'Right' },
                ],
            },
            defaultValue: Align.Left,
        })
            .addNumberInput({
            category,
            path: 'config.size',
            name: 'Text size',
            settings: {
                placeholder: 'Auto',
            },
        })
            .addCustomEditor({
            category,
            id: 'apiSelector',
            path: 'config.api',
            name: 'API',
            editor: APIEditor,
        });
    },
};
//# sourceMappingURL=button.js.map