import { css } from '@emotion/css';
import React, { PureComponent } from 'react';
import { stylesFactory } from '@grafana/ui';
import { config } from 'app/core/config';
import { ColorDimensionEditor } from 'app/features/dimensions/editors/ColorDimensionEditor';
import { TextDimensionEditor } from 'app/features/dimensions/editors/TextDimensionEditor';
import { defaultBgColor, defaultTextColor } from '../element';
import { Align, VAlign } from '../types';
class EllipseDisplay extends PureComponent {
    render() {
        const { data } = this.props;
        const styles = getStyles(config.theme2, data);
        return (React.createElement("div", { className: styles.container },
            React.createElement("span", { className: styles.span }, data === null || data === void 0 ? void 0 : data.text)));
    }
}
const getStyles = stylesFactory((theme, data) => ({
    container: css `
    display: table;
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 100%;
    height: 100%;
    background-color: ${data === null || data === void 0 ? void 0 : data.backgroundColor};
    border: ${data === null || data === void 0 ? void 0 : data.width}px solid ${data === null || data === void 0 ? void 0 : data.borderColor};
    border-radius: 50%;
  `,
    span: css `
    display: table-cell;
    vertical-align: ${data === null || data === void 0 ? void 0 : data.valign};
    text-align: ${data === null || data === void 0 ? void 0 : data.align};
    font-size: ${data === null || data === void 0 ? void 0 : data.size}px;
    color: ${data === null || data === void 0 ? void 0 : data.color};
  `,
}));
export const ellipseItem = {
    id: 'ellipse',
    name: 'Ellipse',
    description: 'Ellipse',
    display: EllipseDisplay,
    defaultSize: {
        width: 160,
        height: 160,
    },
    getNewOptions: (options) => (Object.assign(Object.assign({}, options), { config: {
            backgroundColor: {
                fixed: defaultBgColor,
            },
            borderColor: {
                fixed: 'transparent',
            },
            width: 1,
            align: Align.Center,
            valign: VAlign.Middle,
            color: {
                fixed: defaultTextColor,
            },
        }, background: {
            color: {
                fixed: 'transparent',
            },
        } })),
    prepareData: (ctx, cfg) => {
        var _a, _b;
        const data = {
            width: cfg.width,
            text: cfg.text ? ctx.getText(cfg.text).value() : '',
            align: (_a = cfg.align) !== null && _a !== void 0 ? _a : Align.Center,
            valign: (_b = cfg.valign) !== null && _b !== void 0 ? _b : VAlign.Middle,
            size: cfg.size,
        };
        if (cfg.backgroundColor) {
            data.backgroundColor = ctx.getColor(cfg.backgroundColor).value();
        }
        if (cfg.borderColor) {
            data.borderColor = ctx.getColor(cfg.borderColor).value();
        }
        if (cfg.color) {
            data.color = ctx.getColor(cfg.color).value();
        }
        return data;
    },
    // Heatmap overlay options
    registerOptionsUI: (builder) => {
        const category = ['Ellipse'];
        builder
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
            .addCustomEditor({
            category,
            id: 'config.borderColor',
            path: 'config.borderColor',
            name: 'Ellipse border color',
            editor: ColorDimensionEditor,
            settings: {},
            defaultValue: {},
        })
            .addNumberInput({
            category,
            path: 'config.width',
            name: 'Ellipse border width',
            settings: {
                placeholder: 'Auto',
            },
        })
            .addCustomEditor({
            category,
            id: 'config.backgroundColor',
            path: 'config.backgroundColor',
            name: 'Ellipse background color',
            editor: ColorDimensionEditor,
            settings: {},
            defaultValue: {},
        })
            .addRadio({
            category,
            path: 'config.valign',
            name: 'Vertical align',
            settings: {
                options: [
                    { value: VAlign.Top, label: 'Top' },
                    { value: VAlign.Middle, label: 'Middle' },
                    { value: VAlign.Bottom, label: 'Bottom' },
                ],
            },
            defaultValue: VAlign.Middle,
        })
            .addNumberInput({
            category,
            path: 'config.size',
            name: 'Text size',
            settings: {
                placeholder: 'Auto',
            },
        });
    },
};
//# sourceMappingURL=ellipse.js.map