import { css } from '@emotion/css';
import React, { PureComponent } from 'react';
import { stylesFactory } from '@grafana/ui';
import { config } from 'app/core/config';
import { ColorDimensionEditor } from 'app/features/dimensions/editors/ColorDimensionEditor';
import { TextDimensionEditor } from 'app/features/dimensions/editors/TextDimensionEditor';
import { defaultBgColor, defaultTextColor } from '../element';
import { Align, VAlign } from '../types';
class RectangleDisplay extends PureComponent {
    render() {
        const { data } = this.props;
        const styles = getStyles(config.theme2, data);
        return (React.createElement("div", { className: styles.container },
            React.createElement("span", { className: styles.span }, data === null || data === void 0 ? void 0 : data.text)));
    }
}
const getStyles = stylesFactory((theme, data) => ({
    container: css({
        position: 'absolute',
        height: '100%',
        width: '100%',
        display: 'table',
    }),
    span: css({
        display: 'table-cell',
        verticalAlign: data === null || data === void 0 ? void 0 : data.valign,
        textAlign: data === null || data === void 0 ? void 0 : data.align,
        fontSize: `${data === null || data === void 0 ? void 0 : data.size}px`,
        color: data === null || data === void 0 ? void 0 : data.color,
    }),
}));
export const rectangleItem = {
    id: 'rectangle',
    name: 'Rectangle',
    description: 'Rectangle',
    display: RectangleDisplay,
    defaultSize: {
        width: 240,
        height: 160,
    },
    getNewOptions: (options) => (Object.assign(Object.assign({}, options), { config: {
            align: Align.Center,
            valign: VAlign.Middle,
            color: {
                fixed: defaultTextColor,
            },
        }, background: {
            color: {
                fixed: defaultBgColor,
            },
        } })),
    // Called when data changes
    prepareData: (ctx, cfg) => {
        var _a, _b;
        const data = {
            text: cfg.text ? ctx.getText(cfg.text).value() : '',
            align: (_a = cfg.align) !== null && _a !== void 0 ? _a : Align.Center,
            valign: (_b = cfg.valign) !== null && _b !== void 0 ? _b : VAlign.Middle,
            size: cfg.size,
        };
        if (cfg.color) {
            data.color = ctx.getColor(cfg.color).value();
        }
        return data;
    },
    // Heatmap overlay options
    registerOptionsUI: (builder) => {
        const category = ['Rectangle'];
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
//# sourceMappingURL=rectangle.js.map