import { css } from '@emotion/css';
import React, { useCallback, useEffect, useRef } from 'react';
import { useObservable } from 'react-use';
import { of } from 'rxjs';
import { Input, usePanelContext, useStyles2 } from '@grafana/ui';
import { ColorDimensionEditor } from 'app/features/dimensions/editors/ColorDimensionEditor';
import { TextDimensionEditor } from 'app/features/dimensions/editors/TextDimensionEditor';
import { getDataLinks } from '../../../plugins/panel/canvas/utils';
import { defaultThemeTextColor } from '../element';
import { Align, VAlign } from '../types';
const TextDisplay = (props) => {
    var _a, _b;
    const { data, isSelected } = props;
    const styles = useStyles2(getStyles(data));
    const context = usePanelContext();
    const scene = (_a = context.instanceState) === null || _a === void 0 ? void 0 : _a.scene;
    const isEditMode = useObservable((_b = scene === null || scene === void 0 ? void 0 : scene.editModeEnabled) !== null && _b !== void 0 ? _b : of(false));
    if (isEditMode && isSelected) {
        return React.createElement(TextEdit, Object.assign({}, props));
    }
    return (React.createElement("div", { className: styles.container },
        React.createElement("span", { className: styles.span }, (data === null || data === void 0 ? void 0 : data.text) ? data.text : 'Double click to set text')));
};
const TextEdit = (props) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    let { data, config } = props;
    const context = usePanelContext();
    let panelData;
    panelData = (_b = (_a = context.instanceState) === null || _a === void 0 ? void 0 : _a.scene) === null || _b === void 0 ? void 0 : _b.data.series;
    const textRef = useRef((_d = (_c = config.text) === null || _c === void 0 ? void 0 : _c.fixed) !== null && _d !== void 0 ? _d : '');
    // Save text on TextEdit unmount
    useEffect(() => {
        return () => {
            saveText(textRef.current);
        };
    });
    const onKeyDown = (event) => {
        var _a;
        if (event.key === 'Enter') {
            event.preventDefault();
            const scene = (_a = context.instanceState) === null || _a === void 0 ? void 0 : _a.scene;
            if (scene) {
                scene.editModeEnabled.next(false);
            }
        }
    };
    const onKeyUp = (event) => {
        textRef.current = event.currentTarget.value;
    };
    const saveText = useCallback((textValue) => {
        var _a, _b;
        let selectedElement;
        selectedElement = (_a = context.instanceState) === null || _a === void 0 ? void 0 : _a.selected[0];
        if (selectedElement) {
            const options = selectedElement.options;
            selectedElement.onChange(Object.assign(Object.assign({}, options), { config: Object.assign(Object.assign({}, options.config), { text: Object.assign(Object.assign({}, selectedElement.options.config.text), { fixed: textValue }) }) }));
            // Force a re-render (update scene data after config update)
            const scene = (_b = context.instanceState) === null || _b === void 0 ? void 0 : _b.scene;
            if (scene) {
                scene.updateData(scene.data);
            }
        }
    }, [(_e = context.instanceState) === null || _e === void 0 ? void 0 : _e.scene, (_f = context.instanceState) === null || _f === void 0 ? void 0 : _f.selected]);
    const styles = useStyles2(getStyles(data));
    return (React.createElement("div", { className: styles.inlineEditorContainer }, panelData && React.createElement(Input, { defaultValue: (_h = (_g = config.text) === null || _g === void 0 ? void 0 : _g.fixed) !== null && _h !== void 0 ? _h : '', onKeyDown: onKeyDown, onKeyUp: onKeyUp, autoFocus: true })));
};
const getStyles = (data) => (theme) => ({
    container: css `
    position: absolute;
    height: 100%;
    width: 100%;
    display: table;
  `,
    inlineEditorContainer: css `
    height: 100%;
    width: 100%;
    display: flex;
    align-items: center;
    padding: 10px;
  `,
    span: css `
    display: table-cell;
    vertical-align: ${data === null || data === void 0 ? void 0 : data.valign};
    text-align: ${data === null || data === void 0 ? void 0 : data.align};
    font-size: ${data === null || data === void 0 ? void 0 : data.size}px;
    color: ${data === null || data === void 0 ? void 0 : data.color};
  `,
});
export const textItem = {
    id: 'text',
    name: 'Text',
    description: 'Display text',
    display: TextDisplay,
    hasEditMode: true,
    defaultSize: {
        width: 100,
        height: 50,
    },
    getNewOptions: (options) => {
        var _a, _b, _c, _d, _e, _f;
        return (Object.assign(Object.assign({}, options), { config: {
                align: Align.Center,
                valign: VAlign.Middle,
                color: {
                    fixed: defaultThemeTextColor,
                },
                size: 16,
            }, placement: {
                width: (_b = (_a = options === null || options === void 0 ? void 0 : options.placement) === null || _a === void 0 ? void 0 : _a.width) !== null && _b !== void 0 ? _b : 100,
                height: (_d = (_c = options === null || options === void 0 ? void 0 : options.placement) === null || _c === void 0 ? void 0 : _c.height) !== null && _d !== void 0 ? _d : 100,
                top: (_e = options === null || options === void 0 ? void 0 : options.placement) === null || _e === void 0 ? void 0 : _e.top,
                left: (_f = options === null || options === void 0 ? void 0 : options.placement) === null || _f === void 0 ? void 0 : _f.left,
            } }));
    },
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
        data.links = getDataLinks(ctx, cfg, data.text);
        return data;
    },
    registerOptionsUI: (builder) => {
        const category = ['Text'];
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
//# sourceMappingURL=text.js.map