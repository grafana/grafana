import { css } from '@emotion/css';
import React, { useCallback, useMemo } from 'react';
import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd';
import { DataTransformerID, standardTransformers, TransformerCategory, } from '@grafana/data';
import { createOrderFieldsComparer } from '@grafana/data/src/transformations/transformers/order';
import { Input, IconButton, Icon, FieldValidationMessage, useStyles2 } from '@grafana/ui';
import { useAllFieldNamesFromDataFrames } from '../utils';
const OrganizeFieldsTransformerEditor = ({ options, input, onChange }) => {
    const { indexByName, excludeByName, renameByName } = options;
    const fieldNames = useAllFieldNamesFromDataFrames(input);
    const orderedFieldNames = useMemo(() => orderFieldNamesByIndex(fieldNames, indexByName), [fieldNames, indexByName]);
    const onToggleVisibility = useCallback((field, shouldExclude) => {
        onChange(Object.assign(Object.assign({}, options), { excludeByName: Object.assign(Object.assign({}, excludeByName), { [field]: shouldExclude }) }));
    }, [onChange, options, excludeByName]);
    const onDragEnd = useCallback((result) => {
        if (!result || !result.destination) {
            return;
        }
        const startIndex = result.source.index;
        const endIndex = result.destination.index;
        if (startIndex === endIndex) {
            return;
        }
        onChange(Object.assign(Object.assign({}, options), { indexByName: reorderToIndex(fieldNames, startIndex, endIndex) }));
    }, [onChange, options, fieldNames]);
    const onRenameField = useCallback((from, to) => {
        onChange(Object.assign(Object.assign({}, options), { renameByName: Object.assign(Object.assign({}, options.renameByName), { [from]: to }) }));
    }, [onChange, options]);
    // Show warning that we only apply the first frame
    if (input.length > 1) {
        return (React.createElement(FieldValidationMessage, null, "Organize fields only works with a single frame. Consider applying a join transformation or filtering the input first."));
    }
    return (React.createElement(DragDropContext, { onDragEnd: onDragEnd },
        React.createElement(Droppable, { droppableId: "sortable-fields-transformer", direction: "vertical" }, (provided) => (React.createElement("div", Object.assign({ ref: provided.innerRef }, provided.droppableProps),
            orderedFieldNames.map((fieldName, index) => {
                return (React.createElement(DraggableFieldName, { fieldName: fieldName, renamedFieldName: renameByName[fieldName], index: index, onToggleVisibility: onToggleVisibility, onRenameField: onRenameField, visible: !excludeByName[fieldName], key: fieldName }));
            }),
            provided.placeholder)))));
};
OrganizeFieldsTransformerEditor.displayName = 'OrganizeFieldsTransformerEditor';
const DraggableFieldName = ({ fieldName, renamedFieldName, index, visible, onToggleVisibility, onRenameField, }) => {
    const styles = useStyles2(getFieldNameStyles);
    return (React.createElement(Draggable, { draggableId: fieldName, index: index }, (provided) => (React.createElement("div", Object.assign({ className: "gf-form-inline", ref: provided.innerRef }, provided.draggableProps),
        React.createElement("div", { className: "gf-form gf-form--grow" },
            React.createElement("div", { className: "gf-form-label gf-form-label--justify-left width-30" },
                React.createElement(Icon, Object.assign({ name: "draggabledots", title: "Drag and drop to reorder", size: "lg", className: styles.draggable }, provided.dragHandleProps)),
                React.createElement(IconButton, { className: styles.toggle, size: "md", name: visible ? 'eye' : 'eye-slash', onClick: () => onToggleVisibility(fieldName, visible), tooltip: visible ? 'Disable' : 'Enable' }),
                React.createElement("span", { className: styles.name, title: fieldName }, fieldName)),
            React.createElement(Input, { className: "flex-grow-1", defaultValue: renamedFieldName || '', placeholder: `Rename ${fieldName}`, onBlur: (event) => onRenameField(fieldName, event.currentTarget.value) }))))));
};
DraggableFieldName.displayName = 'DraggableFieldName';
const getFieldNameStyles = (theme) => ({
    toggle: css `
    margin: 0 8px;
    color: ${theme.colors.text.secondary};
  `,
    draggable: css `
    opacity: 0.4;
    &:hover {
      color: ${theme.colors.text.maxContrast};
    }
  `,
    name: css `
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: ${theme.typography.bodySmall.fontSize};
    font-weight: ${theme.typography.fontWeightMedium};
  `,
});
const reorderToIndex = (fieldNames, startIndex, endIndex) => {
    const result = Array.from(fieldNames);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return result.reduce((nameByIndex, fieldName, index) => {
        nameByIndex[fieldName] = index;
        return nameByIndex;
    }, {});
};
const orderFieldNamesByIndex = (fieldNames, indexByName = {}) => {
    if (!indexByName || Object.keys(indexByName).length === 0) {
        return fieldNames;
    }
    const comparer = createOrderFieldsComparer(indexByName);
    return fieldNames.sort(comparer);
};
export const organizeFieldsTransformRegistryItem = {
    id: DataTransformerID.organize,
    editor: OrganizeFieldsTransformerEditor,
    transformation: standardTransformers.organizeFieldsTransformer,
    name: 'Organize fields',
    description: "Allows the user to re-order, hide, or rename fields / columns. Useful when data source doesn't allow overrides for visualizing data.",
    categories: new Set([TransformerCategory.ReorderAndRename]),
};
//# sourceMappingURL=OrganizeFieldsTransformerEditor.js.map