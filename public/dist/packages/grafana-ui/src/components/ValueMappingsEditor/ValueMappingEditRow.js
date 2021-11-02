import { __assign } from "tslib";
import React, { useCallback, useEffect, useRef } from 'react';
import { Input } from '../Input/Input';
import { MappingType, SpecialValueMatch } from '@grafana/data';
import { Draggable } from 'react-beautiful-dnd';
import { Icon } from '../Icon/Icon';
import { ColorPicker } from '../ColorPicker/ColorPicker';
import { LinkButton } from '../Button';
import { HorizontalGroup } from '../Layout/Layout';
import { IconButton } from '../IconButton/IconButton';
import { useStyles2 } from '../../themes/ThemeContext';
import { css } from '@emotion/css';
import { Select } from '../Select/Select';
export function ValueMappingEditRow(_a) {
    var mapping = _a.mapping, index = _a.index, onChange = _a.onChange, onRemove = _a.onRemove, onDupliate = _a.onDuplicate;
    var key = mapping.key, result = mapping.result;
    var styles = useStyles2(getStyles);
    var inputRef = useRef(null);
    var update = useCallback(function (fn) {
        var copy = __assign(__assign({}, mapping), { result: __assign({}, mapping.result) });
        fn(copy);
        onChange(index, copy);
    }, [mapping, index, onChange]);
    useEffect(function () {
        if (inputRef.current && mapping.isNew) {
            inputRef.current.focus();
            update(function (mapping) {
                mapping.isNew = false;
            });
        }
    }, [mapping, inputRef, update]);
    var onChangeColor = function (color) {
        update(function (mapping) {
            mapping.result.color = color;
        });
    };
    var onClearColor = function () {
        update(function (mapping) {
            mapping.result.color = undefined;
        });
    };
    var onUpdateMatchValue = function (event) {
        update(function (mapping) {
            mapping.key = event.currentTarget.value;
        });
    };
    var onChangeText = function (event) {
        update(function (mapping) {
            mapping.result.text = event.currentTarget.value;
        });
    };
    var onChangeFrom = function (event) {
        update(function (mapping) {
            mapping.from = parseFloat(event.currentTarget.value);
        });
    };
    var onChangeTo = function (event) {
        update(function (mapping) {
            mapping.to = parseFloat(event.currentTarget.value);
        });
    };
    var onChangePattern = function (event) {
        update(function (mapping) {
            mapping.pattern = event.currentTarget.value;
        });
    };
    var onChangeSpecialMatch = function (sel) {
        update(function (mapping) {
            mapping.specialMatch = sel.value;
        });
    };
    var specialMatchOptions = [
        { label: 'Null', value: SpecialValueMatch.Null, description: 'Matches null and undefined values' },
        { label: 'NaN', value: SpecialValueMatch.NaN, description: 'Matches against Number.NaN (not a number)' },
        { label: 'Null + NaN', value: SpecialValueMatch.NullAndNaN, description: 'Matches null, undefined and NaN' },
        { label: 'True', value: SpecialValueMatch.True, description: 'Boolean true values' },
        { label: 'False', value: SpecialValueMatch.False, description: 'Boolean false values' },
        { label: 'Empty', value: SpecialValueMatch.Empty, description: 'Empty string' },
    ];
    return (React.createElement(Draggable, { draggableId: "mapping-" + index, index: index }, function (provided) {
        var _a, _b, _c, _d;
        return (React.createElement("tr", __assign({ ref: provided.innerRef }, provided.draggableProps),
            React.createElement("td", null,
                React.createElement("div", __assign({}, provided.dragHandleProps, { className: styles.dragHandle }),
                    React.createElement(Icon, { name: "draggabledots", size: "lg" }))),
            React.createElement("td", { className: styles.typeColumn }, mapping.type),
            React.createElement("td", null,
                mapping.type === MappingType.ValueToText && (React.createElement(Input, { ref: inputRef, type: "text", value: key !== null && key !== void 0 ? key : '', onChange: onUpdateMatchValue, placeholder: "Exact value to match" })),
                mapping.type === MappingType.RangeToText && (React.createElement("div", { className: styles.rangeInputWrapper },
                    React.createElement(Input, { type: "number", value: (_a = mapping.from) !== null && _a !== void 0 ? _a : '', placeholder: "Range start", onChange: onChangeFrom, prefix: "From" }),
                    React.createElement(Input, { type: "number", value: (_b = mapping.to) !== null && _b !== void 0 ? _b : '', placeholder: "Range end", onChange: onChangeTo, prefix: "To" }))),
                mapping.type === MappingType.RegexToText && (React.createElement(Input, { type: "text", value: (_c = mapping.pattern) !== null && _c !== void 0 ? _c : '', placeholder: "Regular expression", onChange: onChangePattern })),
                mapping.type === MappingType.SpecialValue && (React.createElement(Select, { menuShouldPortal: true, value: specialMatchOptions.find(function (v) { return v.value === mapping.specialMatch; }), options: specialMatchOptions, onChange: onChangeSpecialMatch }))),
            React.createElement("td", null,
                React.createElement(Input, { type: "text", value: (_d = result.text) !== null && _d !== void 0 ? _d : '', onChange: onChangeText, placeholder: "Optional display text" })),
            React.createElement("td", { className: styles.textAlignCenter },
                result.color && (React.createElement(HorizontalGroup, { spacing: "sm", justify: "center" },
                    React.createElement(ColorPicker, { color: result.color, onChange: onChangeColor, enableNamedColors: true }),
                    React.createElement(IconButton, { name: "times", onClick: onClearColor, tooltip: "Remove color", tooltipPlacement: "top" }))),
                !result.color && (React.createElement(ColorPicker, { color: 'gray', onChange: onChangeColor, enableNamedColors: true }, function (props) { return (React.createElement(LinkButton, { variant: "primary", fill: "text", onClick: props.showColorPicker, ref: props.ref, size: "sm" }, "Set color")); }))),
            React.createElement("td", { className: styles.textAlignCenter },
                React.createElement(HorizontalGroup, { spacing: "sm" },
                    React.createElement(IconButton, { name: "copy", onClick: function () { return onDupliate(index); }, "data-testid": "duplicate-value-mapping" }),
                    React.createElement(IconButton, { name: "trash-alt", onClick: function () { return onRemove(index); }, "data-testid": "remove-value-mapping" })))));
    }));
}
var getStyles = function (theme) { return ({
    dragHandle: css({
        cursor: 'grab',
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
}); };
//# sourceMappingURL=ValueMappingEditRow.js.map