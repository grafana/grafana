import { capitalize } from 'lodash';
import React from 'react';
import { FieldType } from '@grafana/data';
import { convertFieldType } from '@grafana/data/src/transformations/transformers/convertFieldType';
import { reportInteraction } from '@grafana/runtime';
import { ContextMenu, MenuGroup, MenuItem } from '@grafana/ui';
import { MenuDivider } from '@grafana/ui/src/components/Menu/MenuDivider';
import { DatagridActionType } from '../state';
import { cleanStringFieldAfterConversion, deleteRows, EMPTY_DF, INTERACTION_EVENT_NAME, INTERACTION_ITEM, } from '../utils';
export const DatagridContextMenu = ({ menuData, data, saveData, closeContextMenu, dispatch, gridSelection, columnFreezeIndex, renameColumnClicked, }) => {
    let selectedRows = [];
    let selectedColumns = [];
    const { row, column, x, y, isHeaderMenu } = menuData;
    if (gridSelection.rows) {
        selectedRows = gridSelection.rows.toArray();
    }
    if (gridSelection.columns) {
        selectedColumns = gridSelection.columns.toArray();
    }
    let rowDeletionLabel = 'Delete row';
    if (selectedRows.length && selectedRows.length > 1) {
        rowDeletionLabel = `Delete ${selectedRows.length} rows`;
    }
    let columnDeletionLabel = 'Delete column';
    if (selectedColumns.length && selectedColumns.length > 1) {
        columnDeletionLabel = `Delete ${selectedColumns.length} columns`;
    }
    // Show delete/clear options on cell right click, but not on header right click, unless header column is specifically selected.
    const showDeleteRow = (row !== undefined && row >= 0) || selectedRows.length;
    const showDeleteColumn = (column !== undefined && column >= 0 && row !== undefined) || selectedColumns.length;
    const showClearRow = row !== undefined && row >= 0 && !selectedRows.length;
    const showClearColumn = column !== undefined && column >= 0 && row !== undefined && !selectedColumns.length;
    const renderContextMenuItems = () => (React.createElement(React.Fragment, null,
        showDeleteRow ? (React.createElement(MenuItem, { label: rowDeletionLabel, onClick: () => {
                if (selectedRows.length) {
                    saveData(deleteRows(data, selectedRows, true));
                    dispatch({ type: DatagridActionType.gridSelectionCleared });
                    return;
                }
                if (row !== undefined && row >= 0) {
                    reportInteraction(INTERACTION_EVENT_NAME, {
                        item: INTERACTION_ITEM.CONTEXT_MENU_ACTION,
                        menu_action: 'row_delete',
                    });
                    saveData(deleteRows(data, [row], true));
                }
            } })) : null,
        showDeleteColumn ? (React.createElement(MenuItem, { label: columnDeletionLabel, onClick: () => {
                if (selectedColumns.length) {
                    saveData(Object.assign(Object.assign({}, data), { fields: data.fields.filter((_, index) => !selectedColumns.includes(index)) }));
                    dispatch({ type: DatagridActionType.gridSelectionCleared });
                    return;
                }
                if (column !== undefined && column >= 0) {
                    reportInteraction(INTERACTION_EVENT_NAME, {
                        item: INTERACTION_ITEM.CONTEXT_MENU_ACTION,
                        menu_action: 'column_delete',
                    });
                    saveData(Object.assign(Object.assign({}, data), { fields: data.fields.filter((_, index) => index !== column) }));
                }
            } })) : null,
        showDeleteColumn || showDeleteRow ? React.createElement(MenuDivider, null) : null,
        showClearRow ? (React.createElement(MenuItem, { label: "Clear row", onClick: () => {
                reportInteraction(INTERACTION_EVENT_NAME, {
                    item: INTERACTION_ITEM.CONTEXT_MENU_ACTION,
                    menu_action: 'row_clear',
                });
                saveData(deleteRows(data, [row]));
            } })) : null,
        showClearColumn ? (React.createElement(MenuItem, { label: "Clear column", onClick: () => {
                const field = data.fields[column];
                field.values = field.values.map(() => null);
                reportInteraction(INTERACTION_EVENT_NAME, {
                    item: INTERACTION_ITEM.CONTEXT_MENU_ACTION,
                    menu_action: 'column_clear',
                });
                saveData(Object.assign({}, data));
            } })) : null,
        showClearRow || showClearColumn ? React.createElement(MenuDivider, null) : null,
        React.createElement(MenuItem, { label: "Remove all data", onClick: () => {
                reportInteraction(INTERACTION_EVENT_NAME, {
                    item: INTERACTION_ITEM.CONTEXT_MENU_ACTION,
                    menu_action: 'remove_all',
                });
                saveData(EMPTY_DF);
            } }),
        React.createElement(MenuItem, { label: "Search...", onClick: () => {
                reportInteraction(INTERACTION_EVENT_NAME, {
                    item: INTERACTION_ITEM.CONTEXT_MENU_ACTION,
                    menu_action: 'open_search',
                });
                dispatch({ type: DatagridActionType.openSearch });
            } })));
    const renderHeaderMenuItems = () => {
        if (column === null || column === undefined) {
            return null;
        }
        const fieldType = data.fields[column].type;
        const fieldTypeConversionData = [];
        const addToConversionData = (fieldType) => {
            fieldTypeConversionData.push({
                label: capitalize(fieldType),
                options: {
                    targetField: data.fields[column].name,
                    destinationType: fieldType,
                },
            });
        };
        if (fieldType === FieldType.string) {
            addToConversionData(FieldType.number);
            addToConversionData(FieldType.boolean);
        }
        else if (fieldType === FieldType.number) {
            addToConversionData(FieldType.string);
            addToConversionData(FieldType.boolean);
        }
        else if (fieldType === FieldType.boolean) {
            addToConversionData(FieldType.number);
            addToConversionData(FieldType.string);
        }
        else {
            addToConversionData(FieldType.string);
            addToConversionData(FieldType.number);
            addToConversionData(FieldType.boolean);
        }
        let columnFreezeLabel = 'Set column freeze position';
        const columnIndex = column + 1;
        if (columnFreezeIndex === columnIndex) {
            columnFreezeLabel = 'Unset column freeze';
        }
        return (React.createElement(React.Fragment, null,
            fieldTypeConversionData.length ? (React.createElement(MenuGroup, { label: "Set field type" }, fieldTypeConversionData.map((conversionData, index) => (React.createElement(MenuItem, { key: index, label: conversionData.label, onClick: () => {
                    const field = convertFieldType(data.fields[column], conversionData.options);
                    if (conversionData.options.destinationType === FieldType.string) {
                        cleanStringFieldAfterConversion(field);
                    }
                    const copy = {
                        name: data.name,
                        fields: [...data.fields],
                        length: data.length,
                    };
                    copy.fields[column] = field;
                    reportInteraction(INTERACTION_EVENT_NAME, {
                        item: INTERACTION_ITEM.HEADER_MENU_ACTION,
                        menu_action: 'convert_field',
                    });
                    saveData(copy);
                } }))))) : null,
            React.createElement(MenuDivider, null),
            React.createElement(MenuItem, { label: columnFreezeLabel, onClick: () => {
                    reportInteraction(INTERACTION_EVENT_NAME, {
                        item: INTERACTION_ITEM.HEADER_MENU_ACTION,
                        menu_action: 'column_freeze',
                    });
                    if (columnFreezeIndex === columnIndex) {
                        dispatch({ type: DatagridActionType.columnFreezeReset });
                    }
                    else {
                        dispatch({ type: DatagridActionType.columnFreezeChanged, payload: { columnIndex } });
                    }
                } }),
            React.createElement(MenuItem, { label: "Rename column", onClick: renameColumnClicked }),
            React.createElement(MenuDivider, null),
            React.createElement(MenuItem, { label: "Delete column", onClick: () => {
                    reportInteraction(INTERACTION_EVENT_NAME, {
                        item: INTERACTION_ITEM.HEADER_MENU_ACTION,
                        menu_action: 'delete_column',
                    });
                    saveData(Object.assign(Object.assign({}, data), { fields: data.fields.filter((_, index) => index !== column) }));
                    // also clear selection since it will change it if the deleted column is selected or if indexes shift
                    dispatch({ type: DatagridActionType.gridSelectionCleared });
                } }),
            React.createElement(MenuItem, { label: "Clear column", onClick: () => {
                    const field = data.fields[column];
                    field.values = field.values.map(() => null);
                    reportInteraction(INTERACTION_EVENT_NAME, {
                        item: INTERACTION_ITEM.HEADER_MENU_ACTION,
                        menu_action: 'clear_column',
                    });
                    saveData(Object.assign({}, data));
                } })));
    };
    return (React.createElement(ContextMenu, { renderMenuItems: isHeaderMenu ? renderHeaderMenuItems : renderContextMenuItems, x: x, y: y, onClose: closeContextMenu }));
};
//# sourceMappingURL=DatagridContextMenu.js.map