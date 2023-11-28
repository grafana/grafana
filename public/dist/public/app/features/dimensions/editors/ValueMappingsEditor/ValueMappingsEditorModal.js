import { css } from '@emotion/css';
import { uniqueId } from 'lodash';
import React, { useEffect, useState } from 'react';
import { DragDropContext, Droppable } from 'react-beautiful-dnd';
import { MappingType, SpecialValueMatch } from '@grafana/data';
import { useStyles2, Modal, ValuePicker, Button } from '@grafana/ui';
import { ValueMappingEditRow } from './ValueMappingEditRow';
export function ValueMappingsEditorModal({ value, onChange, onClose, showIconPicker }) {
    const styles = useStyles2(getStyles);
    const [rows, updateRows] = useState([]);
    useEffect(() => {
        updateRows(buildEditRowModels(value));
    }, [value]);
    const onDragEnd = (result) => {
        if (!value || !result.destination) {
            return;
        }
        const copy = [...rows];
        const element = copy[result.source.index];
        copy.splice(result.source.index, 1);
        copy.splice(result.destination.index, 0, element);
        updateRows(copy);
    };
    const onChangeMapping = (index, row) => {
        const newList = [...rows];
        newList.splice(index, 1, row);
        updateRows(newList);
    };
    const onRemoveRow = (index) => {
        const newList = [...rows];
        newList.splice(index, 1);
        updateRows(newList);
    };
    const mappingTypes = [
        { label: 'Value', value: MappingType.ValueToText, description: 'Match a specific text value' },
        { label: 'Range', value: MappingType.RangeToText, description: 'Match a numerical range of values' },
        { label: 'Regex', value: MappingType.RegexToText, description: 'Match a regular expression with replacement' },
        { label: 'Special', value: MappingType.SpecialValue, description: 'Match on null, NaN, boolean and empty values' },
    ];
    const onAddValueMapping = (value) => {
        updateRows([...rows, createRow({ type: value.value, result: {}, isNew: true })]);
    };
    const onDuplicateMapping = (index) => {
        const sourceRow = duplicateRow(rows[index]);
        const copy = [...rows];
        copy.splice(index, 0, Object.assign({}, sourceRow));
        for (let i = index; i < rows.length; i++) {
            copy[i].result.index = i;
        }
        updateRows(copy);
    };
    const onUpdate = () => {
        onChange(editModelToSaveModel(rows));
        onClose();
    };
    // Start with an empty row
    useEffect(() => {
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
                        showIconPicker && React.createElement("th", { style: { width: '10%' } }, "Icon"),
                        React.createElement("th", { style: { width: '1%' } }))),
                React.createElement(DragDropContext, { onDragEnd: onDragEnd },
                    React.createElement(Droppable, { droppableId: "sortable-field-mappings", direction: "vertical" }, (provided) => (React.createElement("tbody", Object.assign({ ref: provided.innerRef }, provided.droppableProps),
                        rows.map((row, index) => (React.createElement(ValueMappingEditRow, { key: row.id, mapping: row, index: index, onChange: onChangeMapping, onRemove: onRemoveRow, onDuplicate: onDuplicateMapping, showIconPicker: showIconPicker }))),
                        provided.placeholder)))))),
        React.createElement(Modal.ButtonRow, { leftItems: React.createElement(ValuePicker, { label: "Add a new mapping", variant: "secondary", size: "md", icon: "plus", menuPlacement: "auto", minWidth: 40, options: mappingTypes, onChange: onAddValueMapping }) },
            React.createElement(Button, { variant: "secondary", fill: "outline", onClick: onClose }, "Cancel"),
            React.createElement(Button, { variant: "primary", onClick: onUpdate }, "Update"))));
}
export const getStyles = (theme) => ({
    tableWrap: css `
    max-height: calc(80vh - 170px);
    min-height: 40px;
    overflow: auto;
  `,
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
});
function getRowUniqueId() {
    return uniqueId('mapping-');
}
function createRow(row) {
    return Object.assign({ type: MappingType.ValueToText, result: {}, id: getRowUniqueId() }, row);
}
function duplicateRow(row) {
    return Object.assign(Object.assign({}, createRow(row)), { 
        // provide a new unique id to the duplicated row, to preserve focus when dragging 2 duplicated rows
        id: getRowUniqueId() });
}
export function editModelToSaveModel(rows) {
    const mappings = [];
    const valueMaps = {
        type: MappingType.ValueToText,
        options: {},
    };
    rows.forEach((item, index) => {
        const result = Object.assign(Object.assign({}, item.result), { index });
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
                            result,
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
                            result,
                        },
                    });
                }
                break;
            case MappingType.SpecialValue:
                mappings.push({
                    type: item.type,
                    options: {
                        match: item.specialMatch,
                        result,
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
    var _a, _b, _c;
    const editRows = [];
    if (value) {
        for (const mapping of value) {
            switch (mapping.type) {
                case MappingType.ValueToText:
                    for (const key of Object.keys(mapping.options)) {
                        editRows.push(createRow({
                            type: mapping.type,
                            result: mapping.options[key],
                            key,
                        }));
                    }
                    break;
                case MappingType.RangeToText:
                    editRows.push(createRow({
                        type: mapping.type,
                        result: mapping.options.result,
                        from: (_a = mapping.options.from) !== null && _a !== void 0 ? _a : 0,
                        to: (_b = mapping.options.to) !== null && _b !== void 0 ? _b : 0,
                    }));
                    break;
                case MappingType.RegexToText:
                    editRows.push(createRow({
                        type: mapping.type,
                        result: mapping.options.result,
                        pattern: mapping.options.pattern,
                    }));
                    break;
                case MappingType.SpecialValue:
                    editRows.push(createRow({
                        type: mapping.type,
                        result: mapping.options.result,
                        specialMatch: (_c = mapping.options.match) !== null && _c !== void 0 ? _c : SpecialValueMatch.Null,
                    }));
            }
        }
    }
    // Sort by index
    editRows.sort((a, b) => {
        var _a, _b;
        return ((_a = a.result.index) !== null && _a !== void 0 ? _a : 0) > ((_b = b.result.index) !== null && _b !== void 0 ? _b : 0) ? 1 : -1;
    });
    return editRows;
}
//# sourceMappingURL=ValueMappingsEditorModal.js.map