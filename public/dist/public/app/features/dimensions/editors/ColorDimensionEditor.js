import { css } from '@emotion/css';
import React, { useCallback } from 'react';
import { Select, ColorPicker, useStyles2 } from '@grafana/ui';
import { useFieldDisplayNames, useSelectOptions } from '@grafana/ui/src/components/MatchersUI/utils';
const fixedColorOption = {
    label: 'Fixed color',
    value: '_____fixed_____',
};
export const ColorDimensionEditor = (props) => {
    var _a;
    const { value, context, onChange } = props;
    const defaultColor = 'dark-green';
    const styles = useStyles2(getStyles);
    const fieldName = value === null || value === void 0 ? void 0 : value.field;
    const isFixed = Boolean(!fieldName);
    const names = useFieldDisplayNames(context.data);
    const selectOptions = useSelectOptions(names, fieldName, fixedColorOption);
    const onSelectChange = useCallback((selection) => {
        var _a;
        const field = selection.value;
        if (field && field !== fixedColorOption.value) {
            onChange(Object.assign(Object.assign({}, value), { field }));
        }
        else {
            const fixed = (_a = value === null || value === void 0 ? void 0 : value.fixed) !== null && _a !== void 0 ? _a : defaultColor;
            onChange(Object.assign(Object.assign({}, value), { field: undefined, fixed }));
        }
    }, [onChange, value]);
    const onColorChange = useCallback((c) => {
        onChange({
            field: undefined,
            fixed: c !== null && c !== void 0 ? c : defaultColor,
        });
    }, [onChange]);
    const selectedOption = isFixed ? fixedColorOption : selectOptions.find((v) => v.value === fieldName);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: styles.container },
            React.createElement(Select, { value: selectedOption, options: selectOptions, onChange: onSelectChange, noOptionsMessage: "No fields found" }),
            isFixed && (React.createElement("div", { className: styles.picker },
                React.createElement(ColorPicker, { color: (_a = value === null || value === void 0 ? void 0 : value.fixed) !== null && _a !== void 0 ? _a : defaultColor, onChange: onColorChange, enableNamedColors: true }))))));
};
const getStyles = (theme) => ({
    container: css `
    display: flex;
    flex-wrap: nowrap;
    justify-content: flex-end;
    align-items: center;
  `,
    picker: css `
    padding-left: 8px;
  `,
});
//# sourceMappingURL=ColorDimensionEditor.js.map