import { css } from '@emotion/css';
import React from 'react';
import { FieldColorModeId, fieldColorModeRegistry, getFieldColorMode, } from '@grafana/data';
import { useStyles2, useTheme2, Field, RadioButtonGroup, Select } from '@grafana/ui';
import { ColorValueEditor } from './color';
export const FieldColorEditor = ({ value, onChange, item, id }) => {
    var _a, _b, _c, _d;
    const theme = useTheme2();
    const styles = useStyles2(getStyles);
    const colorMode = getFieldColorMode(value === null || value === void 0 ? void 0 : value.mode);
    const availableOptions = ((_a = item.settings) === null || _a === void 0 ? void 0 : _a.byValueSupport)
        ? fieldColorModeRegistry.list()
        : fieldColorModeRegistry.list().filter((m) => !m.isByValue);
    const options = availableOptions.map((mode) => {
        let suffix = mode.isByValue ? ' (by value)' : '';
        return {
            value: mode.id,
            label: `${mode.name}${suffix}`,
            description: mode.description,
            isContinuous: mode.isContinuous,
            isByValue: mode.isByValue,
            component() {
                return React.createElement(FieldColorModeViz, { mode: mode, theme: theme });
            },
        };
    });
    const onModeChange = (newMode) => {
        onChange(Object.assign(Object.assign({}, value), { mode: newMode.value }));
    };
    const onColorChange = (color) => {
        onChange(Object.assign(Object.assign({}, value), { mode, fixedColor: color }));
    };
    const onSeriesModeChange = (seriesBy) => {
        onChange(Object.assign(Object.assign({}, value), { mode,
            seriesBy }));
    };
    const mode = (_b = value === null || value === void 0 ? void 0 : value.mode) !== null && _b !== void 0 ? _b : FieldColorModeId.Thresholds;
    if (mode === FieldColorModeId.Fixed || mode === FieldColorModeId.Shades) {
        return (React.createElement("div", { className: styles.group },
            React.createElement(Select, { minMenuHeight: 200, options: options, value: mode, onChange: onModeChange, className: styles.select, inputId: id }),
            React.createElement(ColorValueEditor, { value: value === null || value === void 0 ? void 0 : value.fixedColor, onChange: onColorChange })));
    }
    if (((_c = item.settings) === null || _c === void 0 ? void 0 : _c.bySeriesSupport) && colorMode.isByValue) {
        const seriesModes = [
            { label: 'Last', value: 'last' },
            { label: 'Min', value: 'min' },
            { label: 'Max', value: 'max' },
        ];
        return (React.createElement(React.Fragment, null,
            React.createElement("div", { style: { marginBottom: theme.spacing(2) } },
                React.createElement(Select, { minMenuHeight: 200, options: options, value: mode, onChange: onModeChange, inputId: id })),
            React.createElement(Field, { label: "Color series by" },
                React.createElement(RadioButtonGroup, { value: (_d = value === null || value === void 0 ? void 0 : value.seriesBy) !== null && _d !== void 0 ? _d : 'last', options: seriesModes, onChange: onSeriesModeChange }))));
    }
    return React.createElement(Select, { minMenuHeight: 200, options: options, value: mode, onChange: onModeChange, inputId: id });
};
const FieldColorModeViz = ({ mode, theme }) => {
    if (!mode.getColors) {
        return null;
    }
    const colors = mode.getColors(theme).map(theme.visualization.getColorByName);
    const style = {
        height: '8px',
        width: '100%',
        margin: '2px 0',
        borderRadius: '3px',
        opacity: 1,
    };
    if (mode.isContinuous) {
        style.background = `linear-gradient(90deg, ${colors.join(',')})`;
    }
    else {
        let gradient = '';
        let lastColor = '';
        for (let i = 0; i < colors.length; i++) {
            const color = colors[i];
            if (gradient === '') {
                gradient = `linear-gradient(90deg, ${color} 0%`;
            }
            else {
                const valuePercent = i / (colors.length - 1);
                const pos = valuePercent * 100;
                gradient += `, ${lastColor} ${pos}%, ${color} ${pos}%`;
            }
            lastColor = color;
        }
        style.background = gradient;
    }
    return React.createElement("div", { style: style });
};
const getStyles = (theme) => {
    return {
        group: css `
      display: flex;
    `,
        select: css `
      margin-right: 8px;
      flex-grow: 1;
    `,
    };
};
//# sourceMappingURL=fieldColor.js.map