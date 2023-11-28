import { css, cx } from '@emotion/css';
import React, { useState, useEffect } from 'react';
import { Button, Field, IconButton, useStyles2 } from '@grafana/ui';
import { FieldNamePicker } from '@grafana/ui/src/components/MatchersUI/FieldNamePicker';
import { LayerName } from 'app/core/components/Layers/LayerName';
import { ColorDimensionEditor, ScaleDimensionEditor } from 'app/features/dimensions/editors';
import { defaultFieldConfig } from './panelcfg.gen';
export const ManualEditor = ({ value, onChange, context, }) => {
    var _a, _b;
    const [selected, setSelected] = useState(0);
    const style = useStyles2(getStyles);
    const onFieldChange = (val, index, field) => {
        onChange(value.map((obj, i) => {
            if (i === index) {
                return Object.assign(Object.assign({}, obj), { [field]: val });
            }
            return obj;
        }));
    };
    const createNewSeries = () => {
        onChange([
            ...value,
            {
                pointColor: {},
                pointSize: defaultFieldConfig.pointSize,
            },
        ]);
        setSelected(value.length);
    };
    // Component-did-mount callback to check if a new series should be created
    useEffect(() => {
        if (!(value === null || value === void 0 ? void 0 : value.length)) {
            createNewSeries(); // adds a new series
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const onSeriesDelete = (index) => {
        onChange(value.filter((_, i) => i !== index));
    };
    // const { options } = context;
    const getRowStyle = (index) => {
        return index === selected ? `${style.row} ${style.sel}` : style.row;
    };
    return (React.createElement(React.Fragment, null,
        React.createElement(Button, { icon: "plus", size: "sm", variant: "secondary", onClick: createNewSeries, className: style.marginBot }, "Add series"),
        React.createElement("div", { className: style.marginBot }, value.map((series, index) => {
            var _a;
            return (
            // TODO: fix keyboard a11y
            // eslint-disable-next-line jsx-a11y/no-static-element-interactions
            React.createElement("div", { key: `series/${index}`, className: getRowStyle(index), onMouseDown: () => setSelected(index) },
                React.createElement(LayerName, { name: (_a = series.name) !== null && _a !== void 0 ? _a : `Series ${index + 1}`, onChange: (v) => onFieldChange(v, index, 'name') }),
                React.createElement(IconButton, { name: "trash-alt", title: 'remove', className: cx(style.actionIcon), onClick: () => onSeriesDelete(index), tooltip: "Delete series" })));
        })),
        selected >= 0 && value[selected] && (React.createElement(React.Fragment, null,
            React.createElement("div", { key: `series/${selected}` },
                React.createElement(Field, { label: 'X Field' },
                    React.createElement(FieldNamePicker, { value: (_a = value[selected].x) !== null && _a !== void 0 ? _a : '', context: context, onChange: (field) => onFieldChange(field, selected, 'x'), item: {} })),
                React.createElement(Field, { label: 'Y Field' },
                    React.createElement(FieldNamePicker, { value: (_b = value[selected].y) !== null && _b !== void 0 ? _b : '', context: context, onChange: (field) => onFieldChange(field, selected, 'y'), item: {} })),
                React.createElement(Field, { label: 'Point color' },
                    React.createElement(ColorDimensionEditor, { value: value[selected].pointColor, context: context, onChange: (field) => onFieldChange(field, selected, 'pointColor'), item: {} })),
                React.createElement(Field, { label: 'Point size' },
                    React.createElement(ScaleDimensionEditor, { value: value[selected].pointSize, context: context, onChange: (field) => onFieldChange(field, selected, 'pointSize'), item: { settings: { min: 1, max: 100 } } })))))));
};
const getStyles = (theme) => ({
    marginBot: css `
    margin-bottom: 20px;
  `,
    row: css `
    padding: ${theme.spacing(0.5, 1)};
    border-radius: ${theme.shape.radius.default};
    background: ${theme.colors.background.secondary};
    min-height: ${theme.spacing(4)};
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 3px;
    cursor: pointer;

    border: 1px solid ${theme.components.input.borderColor};
    &:hover {
      border: 1px solid ${theme.components.input.borderHover};
    }
  `,
    sel: css `
    border: 1px solid ${theme.colors.primary.border};
    &:hover {
      border: 1px solid ${theme.colors.primary.border};
    }
  `,
    actionIcon: css `
    color: ${theme.colors.text.secondary};
    &:hover {
      color: ${theme.colors.text};
    }
  `,
});
//# sourceMappingURL=ManualEditor.js.map