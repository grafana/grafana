import { GridColumnIcon, } from '@glideapps/glide-data-grid';
import { FieldType, getFieldDisplayName } from '@grafana/data';
import { isDatagridEnabled } from './featureFlagUtils';
import { DEFAULT_CONTEXT_MENU, DEFAULT_RENAME_INPUT_DATA, EMPTY_GRID_SELECTION, getCellWidth, } from './utils';
export var DatagridActionType;
(function (DatagridActionType) {
    DatagridActionType["columnResizeStart"] = "columnResizeStart";
    DatagridActionType["columnResizeEnd"] = "columnResizeEnd";
    DatagridActionType["columnMove"] = "columnMove";
    DatagridActionType["updateColumns"] = "updateColumns";
    DatagridActionType["showColumnRenameInput"] = "showColumnRenameInput";
    DatagridActionType["hideColumnRenameInput"] = "hideColumnRenameInput";
    DatagridActionType["openCellContextMenu"] = "openCellContextMenu";
    DatagridActionType["openHeaderContextMenu"] = "openHeaderContextMenu";
    DatagridActionType["openHeaderDropdownMenu"] = "openHeaderDropdownMenu";
    DatagridActionType["closeContextMenu"] = "closeContextMenu";
    DatagridActionType["multipleCellsSelected"] = "multipleCellsSelected";
    DatagridActionType["gridSelectionCleared"] = "gridSelectionCleared";
    DatagridActionType["columnFreezeReset"] = "columnFreezeReset";
    DatagridActionType["columnFreezeChanged"] = "columnFreezeChanged";
    DatagridActionType["openSearch"] = "openSearch";
    DatagridActionType["closeSearch"] = "closeSearch";
})(DatagridActionType || (DatagridActionType = {}));
export const initialState = {
    columns: [],
    contextMenuData: DEFAULT_CONTEXT_MENU,
    renameColumnInputData: DEFAULT_RENAME_INPUT_DATA,
    gridSelection: EMPTY_GRID_SELECTION,
    columnFreezeIndex: 0,
    toggleSearch: false,
    isResizeInProgress: false,
};
const typeToIconMap = new Map([
    [FieldType.number, GridColumnIcon.HeaderNumber],
    [FieldType.string, GridColumnIcon.HeaderTextTemplate],
    [FieldType.boolean, GridColumnIcon.HeaderBoolean],
    [FieldType.time, GridColumnIcon.HeaderDate],
    [FieldType.other, GridColumnIcon.HeaderReference],
]);
export const datagridReducer = (state, action) => {
    let columns = [];
    switch (action.type) {
        case DatagridActionType.columnResizeStart:
            columns = [...state.columns];
            const columnResizeStartPayload = action.payload;
            columns[columnResizeStartPayload.columnIndex] = Object.assign(Object.assign({}, state.columns[columnResizeStartPayload.columnIndex]), { width: columnResizeStartPayload.width });
            return Object.assign(Object.assign({}, state), { columns, isResizeInProgress: true });
        case DatagridActionType.columnMove:
            columns = [...state.columns];
            const columnMovePayload = action.payload;
            const widthFrom = state.columns[columnMovePayload.from].width;
            let fromColumn = columns.splice(columnMovePayload.from, 1)[0];
            fromColumn = Object.assign(Object.assign({}, fromColumn), { width: widthFrom });
            columns.splice(columnMovePayload.to, 0, fromColumn);
            return Object.assign(Object.assign({}, state), { columns });
        case DatagridActionType.columnResizeEnd:
            return Object.assign(Object.assign({}, state), { isResizeInProgress: false });
        case DatagridActionType.updateColumns:
            const updateColumnsPayload = action.payload;
            columns = [
                ...updateColumnsPayload.frame.fields.map((field, index) => {
                    var _a;
                    // find column by field name and update width in new set. We cannot use index because
                    // if a column gets deleted we don't know the correct index anymore
                    const width = (_a = state.columns.find((column) => column.title === field.name)) === null || _a === void 0 ? void 0 : _a.width;
                    const displayName = getFieldDisplayName(field, updateColumnsPayload.frame);
                    return {
                        title: displayName,
                        width: width !== null && width !== void 0 ? width : getCellWidth(field),
                        icon: typeToIconMap.get(field.type),
                        hasMenu: isDatagridEnabled(),
                        trailingRowOptions: { targetColumn: --index },
                    };
                }),
            ];
            return Object.assign(Object.assign({}, state), { columns });
        case DatagridActionType.showColumnRenameInput:
            return Object.assign(Object.assign({}, state), { renameColumnInputData: Object.assign(Object.assign({}, state.renameColumnInputData), { isInputOpen: true }) });
        case DatagridActionType.hideColumnRenameInput:
            return Object.assign(Object.assign({}, state), { renameColumnInputData: Object.assign(Object.assign({}, state.renameColumnInputData), { isInputOpen: false }) });
        case DatagridActionType.openCellContextMenu:
            const openCellContextMenuPayload = action.payload;
            const cellEvent = openCellContextMenuPayload.event;
            const cell = openCellContextMenuPayload.cell;
            return Object.assign(Object.assign({}, state), { contextMenuData: {
                    x: cellEvent.bounds.x + cellEvent.localEventX,
                    y: cellEvent.bounds.y + cellEvent.localEventY,
                    column: cell[0] === -1 ? undefined : cell[0],
                    row: cell[1],
                    isContextMenuOpen: true,
                    isHeaderMenu: false,
                } });
        case DatagridActionType.openHeaderContextMenu:
            const openHeaderContextMenuPayload = action.payload;
            const headerEvent = openHeaderContextMenuPayload.event;
            return Object.assign(Object.assign({}, state), { contextMenuData: {
                    x: headerEvent.bounds.x + headerEvent.localEventX,
                    y: headerEvent.bounds.y + headerEvent.localEventY,
                    column: openHeaderContextMenuPayload.columnIndex,
                    row: undefined,
                    isContextMenuOpen: true,
                    isHeaderMenu: false,
                } });
        case DatagridActionType.openHeaderDropdownMenu:
            const openHeaderDropdownMenuPayload = action.payload;
            const screenPosition = openHeaderDropdownMenuPayload.screenPosition;
            return Object.assign(Object.assign({}, state), { contextMenuData: {
                    x: screenPosition.x + screenPosition.width,
                    y: screenPosition.y + screenPosition.height,
                    column: openHeaderDropdownMenuPayload.columnIndex,
                    row: undefined,
                    isContextMenuOpen: true,
                    isHeaderMenu: true,
                }, renameColumnInputData: {
                    x: screenPosition.x,
                    y: screenPosition.y,
                    width: screenPosition.width,
                    height: screenPosition.height,
                    columnIdx: openHeaderDropdownMenuPayload.columnIndex,
                    isInputOpen: false,
                    inputValue: openHeaderDropdownMenuPayload.value,
                } });
        case DatagridActionType.closeContextMenu:
            return Object.assign(Object.assign({}, state), { contextMenuData: {
                    isContextMenuOpen: false,
                } });
        case DatagridActionType.closeSearch:
            return Object.assign(Object.assign({}, state), { toggleSearch: false });
        case DatagridActionType.openSearch:
            return Object.assign(Object.assign({}, state), { toggleSearch: true });
        case DatagridActionType.multipleCellsSelected:
            const multipleCellsSelectedPayload = action.payload;
            return Object.assign(Object.assign({}, state), { gridSelection: multipleCellsSelectedPayload.selection });
        case DatagridActionType.gridSelectionCleared:
            return Object.assign(Object.assign({}, state), { gridSelection: EMPTY_GRID_SELECTION });
        case DatagridActionType.columnFreezeReset:
            return Object.assign(Object.assign({}, state), { columnFreezeIndex: 0 });
        case DatagridActionType.columnFreezeChanged:
            const columnFreezeChangedPayload = action.payload;
            return Object.assign(Object.assign({}, state), { columnFreezeIndex: columnFreezeChangedPayload.columnIndex });
        default:
            return state;
    }
};
//# sourceMappingURL=state.js.map