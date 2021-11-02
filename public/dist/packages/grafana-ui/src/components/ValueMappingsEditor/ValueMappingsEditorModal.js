import { __assign, __makeTemplateObject, __read, __spreadArray, __values } from "tslib";
import React, { useEffect, useState } from 'react';
import { MappingType, SpecialValueMatch } from '@grafana/data';
import { Button } from '../Button/Button';
import { Modal } from '../Modal/Modal';
import { useStyles2 } from '../../themes';
import { ValueMappingEditRow } from './ValueMappingEditRow';
import { DragDropContext, Droppable } from 'react-beautiful-dnd';
import { css } from '@emotion/css';
import { ValuePicker } from '../ValuePicker/ValuePicker';
export function ValueMappingsEditorModal(_a) {
    var value = _a.value, onChange = _a.onChange, onClose = _a.onClose;
    var styles = useStyles2(getStyles);
    var _b = __read(useState([]), 2), rows = _b[0], updateRows = _b[1];
    useEffect(function () {
        updateRows(buildEditRowModels(value));
    }, [value]);
    var onDragEnd = function (result) {
        if (!value || !result.destination) {
            return;
        }
        var copy = __spreadArray([], __read(rows), false);
        var element = copy[result.source.index];
        copy.splice(result.source.index, 1);
        copy.splice(result.destination.index, 0, element);
        updateRows(copy);
    };
    var onChangeMapping = function (index, row) {
        var newList = __spreadArray([], __read(rows), false);
        newList.splice(index, 1, row);
        updateRows(newList);
    };
    var onRemoveRow = function (index) {
        var newList = __spreadArray([], __read(rows), false);
        newList.splice(index, 1);
        updateRows(newList);
    };
    var mappingTypes = [
        { label: 'Value', value: MappingType.ValueToText, description: 'Match a specific text value' },
        { label: 'Range', value: MappingType.RangeToText, description: 'Match a numerical range of values' },
        { label: 'Regex', value: MappingType.RegexToText, description: 'Match a regular expression with replacement' },
        { label: 'Special', value: MappingType.SpecialValue, description: 'Match on null, NaN, boolean and empty values' },
    ];
    var onAddValueMapping = function (value) {
        updateRows(__spreadArray(__spreadArray([], __read(rows), false), [
            {
                type: value.value,
                isNew: true,
                result: {},
            },
        ], false));
    };
    var onDuplicateMapping = function (index) {
        var sourceRow = rows[index];
        var copy = __spreadArray([], __read(rows), false);
        copy.splice(index, 0, __assign({}, sourceRow));
        for (var i = index; i < rows.length; i++) {
            copy[i].result.index = i;
        }
        updateRows(copy);
    };
    var onUpdate = function () {
        onChange(editModelToSaveModel(rows));
        onClose();
    };
    // Start with an empty row
    useEffect(function () {
        if (!(value === null || value === void 0 ? void 0 : value.length)) {
            onAddValueMapping({ value: MappingType.ValueToText });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: styles.tableWrap },
            React.createElement("table", { className: styles.editTable },
                React.createElement("thead", null,
                    React.createElement("tr", null,
                        React.createElement("th", { style: { width: '1%' } }),
                        React.createElement("th", { style: { width: '40%', textAlign: 'left' }, colSpan: 2 }, "Condition"),
                        React.createElement("th", { style: { textAlign: 'left' } }, "Display text"),
                        React.createElement("th", { style: { width: '10%' } }, "Color"),
                        React.createElement("th", { style: { width: '1%' } }))),
                React.createElement(DragDropContext, { onDragEnd: onDragEnd },
                    React.createElement(Droppable, { droppableId: "sortable-field-mappings", direction: "vertical" }, function (provided) { return (React.createElement("tbody", __assign({ ref: provided.innerRef }, provided.droppableProps),
                        rows.map(function (row, index) { return (React.createElement(ValueMappingEditRow, { key: index.toString(), mapping: row, index: index, onChange: onChangeMapping, onRemove: onRemoveRow, onDuplicate: onDuplicateMapping })); }),
                        provided.placeholder)); })))),
        React.createElement(Modal.ButtonRow, { leftItems: React.createElement(ValuePicker, { label: "Add a new mapping", variant: "secondary", size: "md", icon: "plus", menuPlacement: "auto", minWidth: 40, options: mappingTypes, onChange: onAddValueMapping }) },
            React.createElement(Button, { variant: "secondary", fill: "outline", onClick: onClose }, "Cancel"),
            React.createElement(Button, { variant: "primary", onClick: onUpdate }, "Update"))));
}
export var getStyles = function (theme) { return ({
    tableWrap: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    max-height: calc(80vh - 170px);\n    min-height: 40px;\n    overflow: auto;\n  "], ["\n    max-height: calc(80vh - 170px);\n    min-height: 40px;\n    overflow: auto;\n  "]))),
    editTable: css({
        width: '100%',
        marginBottom: theme.spacing(2),
        'thead th': {
            textAlign: 'center',
        },
        'tbody tr:hover': {
            background: theme.colors.action.hover,
        },
        ' th, td': {
            padding: theme.spacing(1),
        },
    }),
}); };
export function editModelToSaveModel(rows) {
    var mappings = [];
    var valueMaps = {
        type: MappingType.ValueToText,
        options: {},
    };
    rows.forEach(function (item, index) {
        var result = __assign(__assign({}, item.result), { index: index });
        // Set empty texts to undefined
        if (!result.text || result.text.trim().length === 0) {
            result.text = undefined;
        }
        switch (item.type) {
            case MappingType.ValueToText:
                if (item.key != null) {
                    valueMaps.options[item.key] = result;
                }
                break;
            case MappingType.RangeToText:
                if (item.from != null && item.to != null) {
                    mappings.push({
                        type: item.type,
                        options: {
                            from: item.from,
                            to: item.to,
                            result: result,
                        },
                    });
                }
                break;
            case MappingType.RegexToText:
                if (item.pattern != null) {
                    mappings.push({
                        type: item.type,
                        options: {
                            pattern: item.pattern,
                            result: result,
                        },
                    });
                }
                break;
            case MappingType.SpecialValue:
                mappings.push({
                    type: item.type,
                    options: {
                        match: item.specialMatch,
                        result: result,
                    },
                });
        }
    });
    if (Object.keys(valueMaps.options).length > 0) {
        mappings.unshift(valueMaps);
    }
    return mappings;
}
export function buildEditRowModels(value) {
    var e_1, _a, e_2, _b;
    var _c, _d, _e;
    var editRows = [];
    try {
        for (var value_1 = __values(value), value_1_1 = value_1.next(); !value_1_1.done; value_1_1 = value_1.next()) {
            var mapping = value_1_1.value;
            switch (mapping.type) {
                case MappingType.ValueToText:
                    try {
                        for (var _f = (e_2 = void 0, __values(Object.keys(mapping.options))), _g = _f.next(); !_g.done; _g = _f.next()) {
                            var key = _g.value;
                            editRows.push({
                                type: mapping.type,
                                result: mapping.options[key],
                                key: key,
                            });
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (_g && !_g.done && (_b = _f.return)) _b.call(_f);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                    break;
                case MappingType.RangeToText:
                    editRows.push({
                        type: mapping.type,
                        result: mapping.options.result,
                        from: (_c = mapping.options.from) !== null && _c !== void 0 ? _c : 0,
                        to: (_d = mapping.options.to) !== null && _d !== void 0 ? _d : 0,
                    });
                    break;
                case MappingType.RegexToText:
                    editRows.push({
                        type: mapping.type,
                        result: mapping.options.result,
                        pattern: mapping.options.pattern,
                    });
                    break;
                case MappingType.SpecialValue:
                    editRows.push({
                        type: mapping.type,
                        result: mapping.options.result,
                        specialMatch: (_e = mapping.options.match) !== null && _e !== void 0 ? _e : SpecialValueMatch.Null,
                    });
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (value_1_1 && !value_1_1.done && (_a = value_1.return)) _a.call(value_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    // Sort by index
    editRows.sort(function (a, b) {
        var _a, _b;
        return ((_a = a.result.index) !== null && _a !== void 0 ? _a : 0) > ((_b = b.result.index) !== null && _b !== void 0 ? _b : 0) ? 1 : -1;
    });
    return editRows;
}
var templateObject_1;
//# sourceMappingURL=ValueMappingsEditorModal.js.map