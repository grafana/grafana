import { css } from '@emotion/css';
import React, { useCallback, useEffect, useRef } from 'react';
import { Draggable } from 'react-beautiful-dnd';
import { MappingType, SpecialValueMatch } from '@grafana/data';
import { useStyles2, Icon, Select, HorizontalGroup, ColorPicker, IconButton, Input, Button } from '@grafana/ui';
import { ResourcePickerSize, ResourceFolderName, MediaType } from '../../types';
import { ResourcePicker } from '../ResourcePicker';
export function ValueMappingEditRow({ mapping, index, onChange, onRemove, onDuplicate, showIconPicker }) {
    const { key, result, id } = mapping;
    const styles = useStyles2(getStyles);
    const inputRef = useRef(null);
    const update = useCallback((fn) => {
        const copy = Object.assign(Object.assign({}, mapping), { result: Object.assign({}, mapping.result) });
        fn(copy);
        onChange(index, copy);
    }, [mapping, index, onChange]);
    useEffect(() => {
        if (inputRef.current && mapping.isNew) {
            inputRef.current.focus();
            update((mapping) => {
                mapping.isNew = false;
            });
        }
    }, [mapping, inputRef, update]);
    const onChangeColor = (color) => {
        update((mapping) => {
            mapping.result.color = color;
        });
    };
    const onClearColor = () => {
        update((mapping) => {
            mapping.result.color = undefined;
        });
    };
    const onChangeIcon = (icon) => {
        update((mapping) => {
            mapping.result.icon = icon;
        });
    };
    const onClearIcon = () => {
        update((mapping) => {
            mapping.result.icon = undefined;
        });
    };
    const onUpdateMatchValue = (event) => {
        update((mapping) => {
            mapping.key = event.currentTarget.value;
        });
    };
    const onChangeText = (event) => {
        update((mapping) => {
            mapping.result.text = event.currentTarget.value;
        });
    };
    const onChangeFrom = (event) => {
        update((mapping) => {
            mapping.from = parseFloat(event.currentTarget.value);
        });
    };
    const onChangeTo = (event) => {
        update((mapping) => {
            mapping.to = parseFloat(event.currentTarget.value);
        });
    };
    const onChangePattern = (event) => {
        update((mapping) => {
            mapping.pattern = event.currentTarget.value;
        });
    };
    const onChangeSpecialMatch = (sel) => {
        update((mapping) => {
            mapping.specialMatch = sel.value;
        });
    };
    const specialMatchOptions = [
        { label: 'Null', value: SpecialValueMatch.Null, description: 'Matches null and undefined values' },
        { label: 'NaN', value: SpecialValueMatch.NaN, description: 'Matches against Number.NaN (not a number)' },
        { label: 'Null + NaN', value: SpecialValueMatch.NullAndNaN, description: 'Matches null, undefined and NaN' },
        { label: 'True', value: SpecialValueMatch.True, description: 'Boolean true values' },
        { label: 'False', value: SpecialValueMatch.False, description: 'Boolean false values' },
        { label: 'Empty', value: SpecialValueMatch.Empty, description: 'Empty string' },
    ];
    return (React.createElement(Draggable, { key: id, draggableId: id, index: index }, (provided) => {
        var _a, _b, _c, _d;
        return (React.createElement("tr", Object.assign({ className: styles.dragRow, ref: provided.innerRef }, provided.draggableProps),
            React.createElement("td", null,
                React.createElement("div", Object.assign({ className: styles.dragHandle }, provided.dragHandleProps),
                    React.createElement(Icon, { name: "draggabledots", size: "lg" }))),
            React.createElement("td", { className: styles.typeColumn }, mapping.type),
            React.createElement("td", null,
                mapping.type === MappingType.ValueToText && (React.createElement(Input, { ref: inputRef, type: "text", value: key !== null && key !== void 0 ? key : '', onChange: onUpdateMatchValue, placeholder: "Exact value to match" })),
                mapping.type === MappingType.RangeToText && (React.createElement("div", { className: styles.rangeInputWrapper },
                    React.createElement(Input, { type: "number", value: (_a = mapping.from) !== null && _a !== void 0 ? _a : '', placeholder: "Range start", onChange: onChangeFrom, prefix: "From" }),
                    React.createElement(Input, { type: "number", value: (_b = mapping.to) !== null && _b !== void 0 ? _b : '', placeholder: "Range end", onChange: onChangeTo, prefix: "To" }))),
                mapping.type === MappingType.RegexToText && (React.createElement(Input, { type: "text", value: (_c = mapping.pattern) !== null && _c !== void 0 ? _c : '', placeholder: "Regular expression", onChange: onChangePattern })),
                mapping.type === MappingType.SpecialValue && (React.createElement(Select, { value: specialMatchOptions.find((v) => v.value === mapping.specialMatch), options: specialMatchOptions, onChange: onChangeSpecialMatch }))),
            React.createElement("td", null,
                React.createElement(Input, { type: "text", value: (_d = result.text) !== null && _d !== void 0 ? _d : '', onChange: onChangeText, placeholder: "Optional display text" })),
            React.createElement("td", { className: styles.textAlignCenter },
                result.color && (React.createElement(HorizontalGroup, { spacing: "sm", justify: "center" },
                    React.createElement(ColorPicker, { color: result.color, onChange: onChangeColor, enableNamedColors: true }),
                    React.createElement(IconButton, { name: "times", onClick: onClearColor, tooltip: "Remove color", tooltipPlacement: "top" }))),
                !result.color && (React.createElement(ColorPicker, { color: 'gray', onChange: onChangeColor, enableNamedColors: true }, (props) => (React.createElement(Button, { variant: "primary", fill: "text", onClick: props.showColorPicker, ref: props.ref, size: "sm" }, "Set color"))))),
            showIconPicker && (React.createElement("td", { className: styles.textAlignCenter },
                React.createElement(HorizontalGroup, { spacing: "sm", justify: "center" },
                    React.createElement(ResourcePicker, { onChange: onChangeIcon, onClear: onClearIcon, value: result.icon, size: ResourcePickerSize.SMALL, folderName: ResourceFolderName.Icon, mediaType: MediaType.Icon, color: result.color }),
                    result.icon && (React.createElement(IconButton, { name: "times", onClick: onClearIcon, tooltip: "Remove icon", tooltipPlacement: "top" }))))),
            React.createElement("td", { className: styles.textAlignCenter },
                React.createElement(HorizontalGroup, { spacing: "sm" },
                    React.createElement(IconButton, { name: "copy", onClick: () => onDuplicate(index), "data-testid": "duplicate-value-mapping", "aria-label": "Duplicate value mapping", tooltip: "Duplicate" }),
                    React.createElement(IconButton, { name: "trash-alt", onClick: () => onRemove(index), "data-testid": "remove-value-mapping", "aria-label": "Delete value mapping", tooltip: "Delete" })))));
    }));
}
const getStyles = (theme) => ({
    dragRow: css({
        position: 'relative',
    }),
    dragHandle: css({
        cursor: 'grab',
        // create focus ring around the whole row when the drag handle is tab-focused
        // needs position: relative on the drag row to work correctly
        '&:focus-visible&:after': {
            bottom: 0,
            content: '""',
            left: 0,
            position: 'absolute',
            right: 0,
            top: 0,
            outline: `2px solid ${theme.colors.primary.main}`,
            outlineOffset: '-2px',
        },
    }),
    rangeInputWrapper: css({
        display: 'flex',
        '> div:first-child': {
            marginRight: theme.spacing(2),
        },
    }),
    regexInputWrapper: css({
        display: 'flex',
        '> div:first-child': {
            marginRight: theme.spacing(2),
        },
    }),
    typeColumn: css({
        textTransform: 'capitalize',
        textAlign: 'center',
        width: '1%',
    }),
    textAlignCenter: css({
        textAlign: 'center',
    }),
});
//# sourceMappingURL=ValueMappingEditRow.js.map