import {
  CellClickedEventArgs,
  GridColumnIcon,
  GridSelection,
  HeaderClickedEventArgs,
  Item,
  Rectangle,
  SizedGridColumn,
} from '@glideapps/glide-data-grid';

import { DataFrame, Field, FieldType, getFieldDisplayName } from '@grafana/data';

import {
  DatagridContextMenuData,
  DEFAULT_CONTEXT_MENU,
  DEFAULT_RENAME_INPUT_DATA,
  EMPTY_GRID_SELECTION,
  getCellWidth,
  isDatagridEditEnabled,
  RenameColumnInputData,
} from './utils';

interface DatagridState {
  columns: SizedGridColumn[];
  contextMenuData: DatagridContextMenuData;
  renameColumnInputData: RenameColumnInputData;
  gridSelection: GridSelection;
  columnFreezeIndex: number;
  toggleSearch: boolean;
  isResizeInProgress: boolean;
}

interface UpdateColumnsPayload {
  frame: DataFrame;
}

interface ColumnResizeStartPayload {
  columnIndex: number;
  width: number;
}

interface OpenCellContextMenuPayload {
  event: CellClickedEventArgs;
  cell: Item;
}

interface OpenHeaderContextMenuPayload {
  event: HeaderClickedEventArgs;
  columnIndex: number;
}

interface OpenHeaderDropdownMenuPayload {
  screenPosition: Rectangle;
  columnIndex: number;
  value: string;
}

interface ColumnMovePayload {
  from: number;
  to: number;
}

interface MultipleCellsSelectedPayload {
  selection: GridSelection;
}

interface ColumnFreezeChangedPayload {
  columnIndex: number;
}

export interface DatagridAction {
  type: DatagridActionType;
  payload?:
    | UpdateColumnsPayload
    | ColumnResizeStartPayload
    | OpenCellContextMenuPayload
    | OpenHeaderContextMenuPayload
    | OpenHeaderDropdownMenuPayload
    | ColumnMovePayload
    | MultipleCellsSelectedPayload
    | ColumnFreezeChangedPayload;
}

export enum DatagridActionType {
  columnResizeStart = 'columnResizeStart',
  columnResizeEnd = 'columnResizeEnd',
  columnMove = 'columnMove',
  updateColumns = 'updateColumns',
  showColumnRenameInput = 'showColumnRenameInput',
  hideColumnRenameInput = 'hideColumnRenameInput',
  openCellContextMenu = 'openCellContextMenu',
  openHeaderContextMenu = 'openHeaderContextMenu',
  openHeaderDropdownMenu = 'openHeaderDropdownMenu',
  closeContextMenu = 'closeContextMenu',
  multipleCellsSelected = 'multipleCellsSelected',
  gridSelectionCleared = 'gridSelectionCleared',
  columnFreezeReset = 'columnFreezeReset',
  columnFreezeChanged = 'columnFreezeChanged',
  openSearch = 'openSearch',
  closeSearch = 'closeSearch',
}

export const initialState: DatagridState = {
  columns: [],
  contextMenuData: DEFAULT_CONTEXT_MENU,
  renameColumnInputData: DEFAULT_RENAME_INPUT_DATA,
  gridSelection: EMPTY_GRID_SELECTION,
  columnFreezeIndex: 0,
  toggleSearch: false,
  isResizeInProgress: false,
};

const typeToIconMap: Map<string, GridColumnIcon> = new Map([
  [FieldType.number, GridColumnIcon.HeaderNumber],
  [FieldType.string, GridColumnIcon.HeaderTextTemplate],
  [FieldType.boolean, GridColumnIcon.HeaderBoolean],
  [FieldType.time, GridColumnIcon.HeaderDate],
  [FieldType.other, GridColumnIcon.HeaderReference],
]);

export const datagridReducer = (state: DatagridState, action: DatagridAction): DatagridState => {
  let columns: SizedGridColumn[] = [];

  switch (action.type) {
    case DatagridActionType.columnResizeStart:
      columns = [...state.columns];
      const columnResizeStartPayload: ColumnResizeStartPayload = action.payload as ColumnResizeStartPayload;

      columns[columnResizeStartPayload.columnIndex] = {
        ...state.columns[columnResizeStartPayload.columnIndex],
        width: columnResizeStartPayload.width,
      };

      return {
        ...state,
        columns,
        isResizeInProgress: true,
      };
      break;
    case DatagridActionType.columnMove:
      columns = [...state.columns];
      const columnMovePayload: ColumnMovePayload = action.payload as ColumnMovePayload;

      const widthFrom = state.columns[columnMovePayload.from].width;

      let fromColumn = columns.splice(columnMovePayload.from, 1)[0];

      fromColumn = {
        ...fromColumn,
        width: widthFrom,
      };

      columns.splice(columnMovePayload.to, 0, fromColumn);

      return {
        ...state,
        columns,
      };
      break;
    case DatagridActionType.columnResizeEnd:
      return {
        ...state,
        isResizeInProgress: false,
      };
      break;
    case DatagridActionType.updateColumns:
      const updateColumnsPayload: UpdateColumnsPayload = action.payload as UpdateColumnsPayload;

      columns = [
        ...updateColumnsPayload.frame.fields.map((field: Field, index: number) => {
          const displayName = getFieldDisplayName(field, updateColumnsPayload.frame);
          return {
            title: displayName,
            width: state.columns[index]?.width ?? getCellWidth(field),
            icon: typeToIconMap.get(field.type),
            hasMenu: isDatagridEditEnabled(),
            trailingRowOptions: { targetColumn: --index },
          };
        }),
      ];

      return {
        ...state,
        columns,
      };
      break;
    case DatagridActionType.showColumnRenameInput:
      return {
        ...state,
        renameColumnInputData: {
          ...state.renameColumnInputData,
          isInputOpen: true,
        },
      };
      break;
    case DatagridActionType.hideColumnRenameInput:
      return {
        ...state,
        renameColumnInputData: {
          ...state.renameColumnInputData,
          isInputOpen: false,
        },
      };
      break;
    case DatagridActionType.openCellContextMenu:
      const openCellContextMenuPayload: OpenCellContextMenuPayload = action.payload as OpenCellContextMenuPayload;
      const cellEvent: CellClickedEventArgs = openCellContextMenuPayload.event;
      const cell: Item = openCellContextMenuPayload.cell;

      return {
        ...state,
        contextMenuData: {
          x: cellEvent.bounds.x + cellEvent.localEventX,
          y: cellEvent.bounds.y + cellEvent.localEventY,
          column: cell[0] === -1 ? undefined : cell[0], //row numbers,
          row: cell[1],
          isContextMenuOpen: true,
          isHeaderMenu: false,
        },
      };
      break;
    case DatagridActionType.openHeaderContextMenu:
      const openHeaderContextMenuPayload: OpenHeaderContextMenuPayload = action.payload as OpenHeaderContextMenuPayload;
      const headerEvent: HeaderClickedEventArgs = openHeaderContextMenuPayload.event;

      return {
        ...state,
        contextMenuData: {
          x: headerEvent.bounds.x + headerEvent.localEventX,
          y: headerEvent.bounds.y + headerEvent.localEventY,
          column: openHeaderContextMenuPayload.columnIndex,
          row: undefined, //header
          isContextMenuOpen: true,
          isHeaderMenu: false,
        },
      };
      break;
    case DatagridActionType.openHeaderDropdownMenu:
      const openHeaderDropdownMenuPayload: OpenHeaderDropdownMenuPayload =
        action.payload as OpenHeaderDropdownMenuPayload;
      const screenPosition: Rectangle = openHeaderDropdownMenuPayload.screenPosition;

      return {
        ...state,
        contextMenuData: {
          x: screenPosition.x + screenPosition.width,
          y: screenPosition.y + screenPosition.height,
          column: openHeaderDropdownMenuPayload.columnIndex,
          row: undefined, //header
          isContextMenuOpen: true,
          isHeaderMenu: true,
        },
        renameColumnInputData: {
          x: screenPosition.x,
          y: screenPosition.y,
          width: screenPosition.width,
          height: screenPosition.height,
          columnIdx: openHeaderDropdownMenuPayload.columnIndex,
          isInputOpen: false,
          inputValue: openHeaderDropdownMenuPayload.value,
        },
      };
      break;
    case DatagridActionType.closeContextMenu:
      return {
        ...state,
        contextMenuData: {
          isContextMenuOpen: false,
        },
      };
      break;
    case DatagridActionType.closeSearch:
      return {
        ...state,
        toggleSearch: false,
      };
      break;
    case DatagridActionType.openSearch:
      return {
        ...state,
        toggleSearch: true,
      };
      break;
    case DatagridActionType.multipleCellsSelected:
      const multipleCellsSelectedPayload: MultipleCellsSelectedPayload = action.payload as MultipleCellsSelectedPayload;

      return {
        ...state,
        gridSelection: multipleCellsSelectedPayload.selection,
      };
      break;
    case DatagridActionType.gridSelectionCleared:
      return {
        ...state,
        gridSelection: EMPTY_GRID_SELECTION,
      };
      break;
    case DatagridActionType.columnFreezeReset:
      return {
        ...state,
        columnFreezeIndex: 0,
      };
      break;
    case DatagridActionType.columnFreezeChanged:
      const columnFreezeChangedPayload: ColumnFreezeChangedPayload = action.payload as ColumnFreezeChangedPayload;

      return {
        ...state,
        columnFreezeIndex: columnFreezeChangedPayload.columnIndex,
      };
      break;
    default:
      return state;
  }
};
