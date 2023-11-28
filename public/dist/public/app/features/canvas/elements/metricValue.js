import { css } from '@emotion/css';
import React, { useCallback } from 'react';
import { useObservable } from 'react-use';
import { of } from 'rxjs';
import { TextDimensionMode } from '@grafana/schema';
import { usePanelContext, useStyles2 } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';
import { frameHasName, getFrameFieldsDisplayNames } from '@grafana/ui/src/components/MatchersUI/utils';
import { ColorDimensionEditor } from 'app/features/dimensions/editors/ColorDimensionEditor';
import { TextDimensionEditor } from 'app/features/dimensions/editors/TextDimensionEditor';
import { getDataLinks } from 'app/plugins/panel/canvas/utils';
import { defaultBgColor, defaultTextColor } from '../element';
import { Align, VAlign } from '../types';
// eslint-disable-next-line
const dummyFieldSettings = {
    settings: {},
};
const MetricValueDisplay = (props) => {
    var _a, _b, _c, _d;
    const { data, isSelected, config } = props;
    const styles = useStyles2(getStyles(data));
    const context = usePanelContext();
    const scene = (_a = context.instanceState) === null || _a === void 0 ? void 0 : _a.scene;
    let panelData;
    panelData = (_c = (_b = context.instanceState) === null || _b === void 0 ? void 0 : _b.scene) === null || _c === void 0 ? void 0 : _c.data.series;
    const isEditMode = useObservable((_d = scene === null || scene === void 0 ? void 0 : scene.editModeEnabled) !== null && _d !== void 0 ? _d : of(false));
    const getDisplayValue = () => {
        var _a, _b;
        if (panelData && ((_a = config.text) === null || _a === void 0 ? void 0 : _a.field) && fieldNotFound()) {
            return 'Field not found';
        }
        if (panelData && ((_b = config.text) === null || _b === void 0 ? void 0 : _b.field) && !(data === null || data === void 0 ? void 0 : data.text)) {
            return 'No data';
        }
        return (data === null || data === void 0 ? void 0 : data.text) ? data.text : 'Double click to set field';
    };
    const fieldNotFound = () => {
        var _a;
        const fieldNames = getFrameFieldsDisplayNames(panelData);
        return !frameHasName((_a = config.text) === null || _a === void 0 ? void 0 : _a.field, fieldNames);
    };
    if (isEditMode && isSelected) {
        return React.createElement(MetricValueEdit, Object.assign({}, props));
    }
    return (React.createElement("div", { className: styles.container },
        React.createElement("span", { className: styles.span }, getDisplayValue())));
};
const MetricValueEdit = (props) => {
    var _a, _b, _c, _d, _e, _f;
    let { data, config } = props;
    const context = usePanelContext();
    let panelData;
    panelData = (_b = (_a = context.instanceState) === null || _a === void 0 ? void 0 : _a.scene) === null || _b === void 0 ? void 0 : _b.data.series;
    const onFieldChange = useCallback((field) => {
        var _a, _b, _c, _d, _e;
        let selectedElement;
        selectedElement = (_a = context.instanceState) === null || _a === void 0 ? void 0 : _a.selected[0];
        if (selectedElement) {
            const options = selectedElement.options;
            selectedElement.onChange(Object.assign(Object.assign({}, options), { config: Object.assign(Object.assign({}, options.config), { text: { fixed: '', field: field, mode: TextDimensionMode.Field } }), background: {
                    color: { field: field, fixed: (_d = (_c = (_b = options.background) === null || _b === void 0 ? void 0 : _b.color) === null || _c === void 0 ? void 0 : _c.fixed) !== null && _d !== void 0 ? _d : '' },
                } }));
            // Force a re-render (update scene data after config update)
            const scene = (_e = context.instanceState) === null || _e === void 0 ? void 0 : _e.scene;
            if (scene) {
                scene.editModeEnabled.next(false);
                scene.updateData(scene.data);
            }
        }
    }, [(_c = context.instanceState) === null || _c === void 0 ? void 0 : _c.scene, (_d = context.instanceState) === null || _d === void 0 ? void 0 : _d.selected]);
    const styles = useStyles2(getStyles(data));
    return (React.createElement("div", { className: styles.inlineEditorContainer }, panelData && (React.createElement(FieldNamePicker, { context: { data: panelData }, value: (_f = (_e = config.text) === null || _e === void 0 ? void 0 : _e.field) !== null && _f !== void 0 ? _f : '', onChange: onFieldChange, item: dummyFieldSettings }))));
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
export const metricValueItem = {
    id: 'metric-value',
    name: 'Metric Value',
    description: 'Display a field value',
    display: MetricValueDisplay,
    hasEditMode: true,
    defaultSize: {
        width: 260,
        height: 50,
    },
    getNewOptions: (options) => {
        var _a, _b, _c, _d, _e, _f;
        return (Object.assign(Object.assign({}, options), { config: {
                align: Align.Center,
                valign: VAlign.Middle,
                color: {
                    fixed: defaultTextColor,
                },
                text: { mode: TextDimensionMode.Field, fixed: '', field: '' },
                size: 20,
            }, background: {
                color: {
                    fixed: defaultBgColor,
                },
            }, placement: {
                width: (_a = options === null || options === void 0 ? void 0 : options.placement) === null || _a === void 0 ? void 0 : _a.width,
                height: (_b = options === null || options === void 0 ? void 0 : options.placement) === null || _b === void 0 ? void 0 : _b.height,
                top: (_d = (_c = options === null || options === void 0 ? void 0 : options.placement) === null || _c === void 0 ? void 0 : _c.top) !== null && _d !== void 0 ? _d : 100,
                left: (_f = (_e = options === null || options === void 0 ? void 0 : options.placement) === null || _e === void 0 ? void 0 : _e.left) !== null && _f !== void 0 ? _f : 100,
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
        const category = ['Metric value'];
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
//# sourceMappingURL=metricValue.js.map