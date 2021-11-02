import { __assign, __makeTemplateObject, __read } from "tslib";
import React, { useCallback, useMemo } from 'react';
import { css } from '@emotion/css';
import { DragDropContext, Draggable, Droppable } from 'react-beautiful-dnd';
import { DataTransformerID, standardTransformers, } from '@grafana/data';
import { stylesFactory, useTheme, Input, IconButton, Icon, FieldValidationMessage } from '@grafana/ui';
import { createOrderFieldsComparer } from '@grafana/data/src/transformations/transformers/order';
import { useAllFieldNamesFromDataFrames } from './utils';
var OrganizeFieldsTransformerEditor = function (props) {
    var options = props.options, input = props.input, onChange = props.onChange;
    var indexByName = options.indexByName, excludeByName = options.excludeByName, renameByName = options.renameByName;
    var fieldNames = useAllFieldNamesFromDataFrames(input);
    var orderedFieldNames = useMemo(function () { return orderFieldNamesByIndex(fieldNames, indexByName); }, [fieldNames, indexByName]);
    var onToggleVisibility = useCallback(function (field, shouldExclude) {
        var _a;
        onChange(__assign(__assign({}, options), { excludeByName: __assign(__assign({}, excludeByName), (_a = {}, _a[field] = shouldExclude, _a)) }));
    }, [onChange, options, excludeByName]);
    var onDragEnd = useCallback(function (result) {
        if (!result || !result.destination) {
            return;
        }
        var startIndex = result.source.index;
        var endIndex = result.destination.index;
        if (startIndex === endIndex) {
            return;
        }
        onChange(__assign(__assign({}, options), { indexByName: reorderToIndex(fieldNames, startIndex, endIndex) }));
    }, [onChange, options, fieldNames]);
    var onRenameField = useCallback(function (from, to) {
        var _a;
        onChange(__assign(__assign({}, options), { renameByName: __assign(__assign({}, options.renameByName), (_a = {}, _a[from] = to, _a)) }));
    }, [onChange, options]);
    // Show warning that we only apply the first frame
    if (input.length > 1) {
        return (React.createElement(FieldValidationMessage, null, "Organize fields only works with a single frame. Consider applying a join transformation first."));
    }
    return (React.createElement(DragDropContext, { onDragEnd: onDragEnd },
        React.createElement(Droppable, { droppableId: "sortable-fields-transformer", direction: "vertical" }, function (provided) { return (React.createElement("div", __assign({ ref: provided.innerRef }, provided.droppableProps),
            orderedFieldNames.map(function (fieldName, index) {
                return (React.createElement(DraggableFieldName, { fieldName: fieldName, renamedFieldName: renameByName[fieldName], index: index, onToggleVisibility: onToggleVisibility, onRenameField: onRenameField, visible: !excludeByName[fieldName], key: fieldName }));
            }),
            provided.placeholder)); })));
};
OrganizeFieldsTransformerEditor.displayName = 'OrganizeFieldsTransformerEditor';
var DraggableFieldName = function (_a) {
    var fieldName = _a.fieldName, renamedFieldName = _a.renamedFieldName, index = _a.index, visible = _a.visible, onToggleVisibility = _a.onToggleVisibility, onRenameField = _a.onRenameField;
    var theme = useTheme();
    var styles = getFieldNameStyles(theme);
    return (React.createElement(Draggable, { draggableId: fieldName, index: index }, function (provided) { return (React.createElement("div", __assign({ className: "gf-form-inline", ref: provided.innerRef }, provided.draggableProps, provided.dragHandleProps),
        React.createElement("div", { className: "gf-form gf-form--grow" },
            React.createElement("div", { className: "gf-form-label gf-form-label--justify-left width-30" },
                React.createElement(Icon, { name: "draggabledots", title: "Drag and drop to reorder", size: "lg", className: styles.draggable }),
                React.createElement(IconButton, { className: styles.toggle, size: "md", name: visible ? 'eye' : 'eye-slash', surface: "header", onClick: function () { return onToggleVisibility(fieldName, visible); } }),
                React.createElement("span", { className: styles.name, title: fieldName }, fieldName)),
            React.createElement(Input, { className: "flex-grow-1", defaultValue: renamedFieldName || '', placeholder: "Rename " + fieldName, onBlur: function (event) { return onRenameField(fieldName, event.currentTarget.value); } })))); }));
};
DraggableFieldName.displayName = 'DraggableFieldName';
var getFieldNameStyles = stylesFactory(function (theme) { return ({
    toggle: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    margin: 0 8px;\n    color: ", ";\n  "], ["\n    margin: 0 8px;\n    color: ", ";\n  "])), theme.colors.textWeak),
    draggable: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n    opacity: 0.4;\n    &:hover {\n      color: ", ";\n    }\n  "], ["\n    opacity: 0.4;\n    &:hover {\n      color: ", ";\n    }\n  "])), theme.colors.textStrong),
    name: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n    font-size: ", ";\n    font-weight: ", ";\n  "], ["\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n    font-size: ", ";\n    font-weight: ", ";\n  "])), theme.typography.size.sm, theme.typography.weight.semibold),
}); });
var reorderToIndex = function (fieldNames, startIndex, endIndex) {
    var result = Array.from(fieldNames);
    var _a = __read(result.splice(startIndex, 1), 1), removed = _a[0];
    result.splice(endIndex, 0, removed);
    return result.reduce(function (nameByIndex, fieldName, index) {
        nameByIndex[fieldName] = index;
        return nameByIndex;
    }, {});
};
var orderFieldNamesByIndex = function (fieldNames, indexByName) {
    if (indexByName === void 0) { indexByName = {}; }
    if (!indexByName || Object.keys(indexByName).length === 0) {
        return fieldNames;
    }
    var comparer = createOrderFieldsComparer(indexByName);
    return fieldNames.sort(comparer);
};
export var organizeFieldsTransformRegistryItem = {
    id: DataTransformerID.organize,
    editor: OrganizeFieldsTransformerEditor,
    transformation: standardTransformers.organizeFieldsTransformer,
    name: 'Organize fields',
    description: "Allows the user to re-order, hide, or rename fields / columns. Useful when data source doesn't allow overrides for visualizing data.",
};
var templateObject_1, templateObject_2, templateObject_3;
//# sourceMappingURL=OrganizeFieldsTransformerEditor.js.map