import { __awaiter } from "tslib";
import DataEditor from '@glideapps/glide-data-grid';
import React, { useEffect, useReducer } from 'react';
import { FieldType } from '@grafana/data';
import { PanelDataErrorView, reportInteraction } from '@grafana/runtime';
import { usePanelContext, useTheme2 } from '@grafana/ui';
import '@glideapps/glide-data-grid/dist/index.css';
import { AddColumn } from './components/AddColumn';
import { DatagridContextMenu } from './components/DatagridContextMenu';
import { RenameColumnCell } from './components/RenameColumnCell';
import { isDatagridEnabled } from './featureFlagUtils';
import { DatagridActionType, datagridReducer, initialState } from './state';
import { clearCellsFromRangeSelection, deleteRows, EMPTY_CELL, getGridCellKind, getGridTheme, RIGHT_ELEMENT_PROPS, TRAILING_ROW_OPTIONS, getStyles, ROW_MARKER_BOTH, ROW_MARKER_NUMBER, hasGridSelection, updateSnapshot, INTERACTION_EVENT_NAME, INTERACTION_ITEM, } from './utils';
export function DataGridPanel({ options, data, id, fieldConfig, width, height }) {
    var _a;
    const [state, dispatch] = useReducer(datagridReducer, initialState);
    const { onUpdateData } = usePanelContext();
    const { columns, contextMenuData, renameColumnInputData, gridSelection, columnFreezeIndex, toggleSearch, isResizeInProgress, } = state;
    const frame = data.series[(_a = options.selectedSeries) !== null && _a !== void 0 ? _a : 0];
    const theme = useTheme2();
    const gridTheme = getGridTheme(theme);
    useEffect(() => {
        if (!frame) {
            return;
        }
        dispatch({ type: DatagridActionType.updateColumns, payload: { frame } });
    }, [frame]);
    const getCellContent = ([col, row]) => {
        const field = frame.fields[col];
        if (!field || row > frame.length) {
            return EMPTY_CELL;
        }
        return getGridCellKind(field, row, hasGridSelection(gridSelection));
    };
    const onCellEdited = (cell, newValue) => {
        // if there are rows selected, return early, we don't want to edit any cell
        if (hasGridSelection(gridSelection)) {
            return;
        }
        const [col, row] = cell;
        const frameCopy = Object.assign(Object.assign({}, frame), { fields: frame.fields.map((f) => {
                return Object.assign(Object.assign({}, f), { values: [...f.values] });
            }) });
        const field = frameCopy.fields[col];
        if (!field) {
            return;
        }
        const values = field.values.toArray();
        values[row] = newValue.data;
        field.values = [...values];
        reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.EDIT_CELL });
        updateSnapshot(frameCopy, onUpdateData);
    };
    const onColumnInputBlur = (columnName) => {
        var _a;
        const len = (_a = frame.length) !== null && _a !== void 0 ? _a : 0;
        reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.APPEND_COLUMN });
        updateSnapshot(Object.assign(Object.assign({}, frame), { fields: [
                ...frame.fields,
                {
                    name: columnName,
                    type: FieldType.string,
                    config: {},
                    values: new Array(len).fill(''),
                },
            ] }), onUpdateData);
    };
    const addNewRow = () => {
        const fields = frame.fields.map((f) => {
            const values = f.values.slice(); // copy
            values.push(null);
            return Object.assign(Object.assign({}, f), { values });
        });
        reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.APPEND_ROW });
        updateSnapshot(Object.assign(Object.assign({}, frame), { fields, length: frame.length + 1 }), onUpdateData);
    };
    const onColumnResize = (column, width, columnIndex, newSizeWithGrow) => {
        reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.COLUMN_RESIZE });
        dispatch({ type: DatagridActionType.columnResizeStart, payload: { columnIndex, width } });
    };
    //Hack used to allow resizing last column, near add column btn. This is a workaround for a bug in the grid component
    const onColumnResizeEnd = (column, newSize, colIndex, newSizeWithGrow) => {
        dispatch({ type: DatagridActionType.columnResizeEnd });
    };
    const closeContextMenu = () => {
        dispatch({ type: DatagridActionType.closeContextMenu });
    };
    const onDeletePressed = (selection) => {
        if (selection.current && selection.current.range) {
            reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.DELETE_BTN_PRESSED, selection: 'grid-cell' });
            updateSnapshot(clearCellsFromRangeSelection(frame, selection.current.range), onUpdateData);
            return true;
        }
        const rows = selection.rows.toArray();
        const cols = selection.columns.toArray();
        if (rows.length) {
            reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.DELETE_BTN_PRESSED, selection: 'rows' });
            updateSnapshot(deleteRows(frame, rows), onUpdateData);
            return true;
        }
        if (cols.length) {
            const copiedFrame = Object.assign(Object.assign({}, frame), { fields: frame.fields.map((field, index) => {
                    if (cols.includes(index)) {
                        return Object.assign(Object.assign({}, field), { values: new Array(frame.length).fill(null) });
                    }
                    return field;
                }) });
            reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.DELETE_BTN_PRESSED, selection: 'columns' });
            updateSnapshot(copiedFrame, onUpdateData);
            return true;
        }
        return false;
    };
    const onCellContextMenu = (cell, event) => {
        event.preventDefault();
        dispatch({ type: DatagridActionType.openCellContextMenu, payload: { event, cell } });
    };
    const onHeaderContextMenu = (columnIndex, event) => {
        event.preventDefault();
        dispatch({ type: DatagridActionType.openHeaderContextMenu, payload: { event, columnIndex } });
    };
    const onHeaderMenuClick = (col, screenPosition) => {
        dispatch({
            type: DatagridActionType.openHeaderDropdownMenu,
            payload: { screenPosition, columnIndex: col, value: state.columns[col].title },
        });
    };
    const onColumnMove = (from, to) => __awaiter(this, void 0, void 0, function* () {
        const fields = frame.fields.map((f) => f);
        const field = fields[from];
        fields.splice(from, 1);
        fields.splice(to, 0, field);
        const hasUpdated = yield updateSnapshot(Object.assign(Object.assign({}, frame), { fields }), onUpdateData);
        if (hasUpdated) {
            reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.COLUMN_REORDER });
            dispatch({ type: DatagridActionType.columnMove, payload: { from, to } });
        }
    });
    const onRowMove = (from, to) => {
        const fields = frame.fields.map((f) => (Object.assign(Object.assign({}, f), { values: f.values.slice() })));
        for (const field of fields) {
            const value = field.values[from];
            field.values.splice(from, 1);
            field.values.splice(to, 0, value);
        }
        reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.ROW_REORDER });
        updateSnapshot(Object.assign(Object.assign({}, frame), { fields }), onUpdateData);
    };
    const onColumnRename = () => {
        reportInteraction(INTERACTION_EVENT_NAME, {
            item: INTERACTION_ITEM.HEADER_MENU_ACTION,
            menu_action: 'rename_column',
        });
        dispatch({ type: DatagridActionType.showColumnRenameInput });
    };
    const onRenameInputBlur = (columnName, columnIdx) => {
        const fields = frame.fields.map((f) => f);
        fields[columnIdx].name = columnName;
        dispatch({ type: DatagridActionType.hideColumnRenameInput });
        updateSnapshot(Object.assign(Object.assign({}, frame), { fields }), onUpdateData);
    };
    const onSearchClose = () => {
        dispatch({ type: DatagridActionType.closeSearch });
    };
    const onGridSelectionChange = (selection) => {
        reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.GRID_SELECTED });
        dispatch({ type: DatagridActionType.multipleCellsSelected, payload: { selection } });
    };
    const onContextMenuSave = (data) => {
        updateSnapshot(data, onUpdateData);
    };
    if (!frame) {
        return React.createElement(PanelDataErrorView, { panelId: id, fieldConfig: fieldConfig, data: data });
    }
    if (!isDatagridEnabled()) {
        return React.createElement(PanelDataErrorView, { panelId: id, message: "Datagrid is not enabled", fieldConfig: fieldConfig, data: data });
    }
    if (!document.getElementById('portal')) {
        const portal = document.createElement('div');
        portal.id = 'portal';
        document.body.appendChild(portal);
    }
    const styles = getStyles(theme, isResizeInProgress);
    return (React.createElement(React.Fragment, null,
        React.createElement(DataEditor, { className: styles.dataEditor, getCellContent: getCellContent, columns: columns, rows: frame.length, width: width, height: height, initialSize: [width, height], theme: gridTheme, smoothScrollX: true, smoothScrollY: true, overscrollY: 50, onCellEdited: isDatagridEnabled() ? onCellEdited : undefined, getCellsForSelection: isDatagridEnabled() ? true : undefined, showSearch: isDatagridEnabled() ? toggleSearch : false, onSearchClose: onSearchClose, gridSelection: gridSelection, onGridSelectionChange: isDatagridEnabled() ? onGridSelectionChange : undefined, onRowAppended: isDatagridEnabled() ? addNewRow : undefined, onDelete: isDatagridEnabled() ? onDeletePressed : undefined, rowMarkers: isDatagridEnabled() ? ROW_MARKER_BOTH : ROW_MARKER_NUMBER, onColumnResize: onColumnResize, onColumnResizeEnd: onColumnResizeEnd, onCellContextMenu: isDatagridEnabled() ? onCellContextMenu : undefined, onHeaderContextMenu: isDatagridEnabled() ? onHeaderContextMenu : undefined, onHeaderMenuClick: isDatagridEnabled() ? onHeaderMenuClick : undefined, trailingRowOptions: TRAILING_ROW_OPTIONS, rightElement: isDatagridEnabled() ? (React.createElement(AddColumn, { onColumnInputBlur: onColumnInputBlur, divStyle: styles.addColumnDiv })) : null, rightElementProps: RIGHT_ELEMENT_PROPS, freezeColumns: columnFreezeIndex, onRowMoved: isDatagridEnabled() ? onRowMove : undefined, onColumnMoved: isDatagridEnabled() ? onColumnMove : undefined }),
        contextMenuData.isContextMenuOpen && (React.createElement(DatagridContextMenu, { menuData: contextMenuData, data: frame, saveData: onContextMenuSave, closeContextMenu: closeContextMenu, dispatch: dispatch, gridSelection: gridSelection, columnFreezeIndex: columnFreezeIndex, renameColumnClicked: onColumnRename })),
        renameColumnInputData.isInputOpen ? (React.createElement(RenameColumnCell, { onColumnInputBlur: onRenameInputBlur, renameColumnData: renameColumnInputData, classStyle: styles.renameColumnInput })) : null));
}
//# sourceMappingURL=DataGridPanel.js.map