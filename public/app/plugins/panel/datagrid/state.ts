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

import { isDatagridEnabled } from './featureFlagUtils';
import {
  DatagridContextMenuData,
  DEFAULT_CONTEXT_MENU,
  DEFAULT_RENAME_INPUT_DATA,
  EMPTY_GRID_SELECTION,
  getCellWidth,
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

interface UpdateColumnsAction {
  type: DatagridActionType.updateColumns;
  payload: {
    frame: DataFrame;
  };
}

interface ColumnResizeStartAction {
  type: DatagridActionType.columnResizeStart;
  payload: {
    columnIndex: number;
    width: number;
  };
}

interface OpenCellContextMenuAction {
  type: DatagridActionType.openCellContextMenu;
  payload: {
    event: CellClickedEventArgs;
    cell: Item;
  };
}

interface OpenHeaderContextMenuAction {
  type: DatagridActionType.openHeaderContextMenu;
  payload: {
    event: HeaderClickedEventArgs;
    columnIndex: number;
  };
}

interface OpenHeaderDropdownMenuAction {
  type: DatagridActionType.openHeaderDropdownMenu;
  payload: {
    screenPosition: Rectangle;
    columnIndex: number;
    value: string;
  };
}

interface ColumnMoveAction {
  type: DatagridActionType.columnMove;
  payload: {
    from: number;
    to: number;
  };
}

interface MultipleCellsSelectedAction {
  type: DatagridActionType.multipleCellsSelected;
  payload: {
    selection: GridSelection;
  };
}

interface ColumnFreezeChangedAction {
  type: DatagridActionType.columnFreezeChanged;
  payload: {
    columnIndex: number;
  };
}

interface ColumnResizeEndAction {
  type: DatagridActionType.columnResizeEnd;
}
interface ShowColumnRenameInputAction {
  type: DatagridActionType.showColumnRenameInput;
}
interface HideColumnRenameInputAction {
  type: DatagridActionType.hideColumnRenameInput;
}
interface CloseContextMenuAction {
  type: DatagridActionType.closeContextMenu;
}
interface CloseSearchAction {
  type: DatagridActionType.closeSearch;
}
interface OpenSearchAction {
  type: DatagridActionType.openSearch;
}
interface GridSelectionClearedAction {
  type: DatagridActionType.gridSelectionCleared;
}
interface ColumnFreezeResetAction {
  type: DatagridActionType.columnFreezeReset;
}

export type DatagridAction =
  | UpdateColumnsAction
  | ColumnResizeStartAction
  | OpenCellContextMenuAction
  | OpenHeaderContextMenuAction
  | OpenHeaderDropdownMenuAction
  | ColumnMoveAction
  | MultipleCellsSelectedAction
  | ColumnFreezeChangedAction
  | ColumnResizeEndAction
  | ShowColumnRenameInputAction
  | HideColumnRenameInputAction
  | CloseContextMenuAction
  | CloseSearchAction
  | OpenSearchAction
  | GridSelectionClearedAction
  | ColumnFreezeResetAction;

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
      const columnResizeStartPayload = action.payload;

      columns[columnResizeStartPayload.columnIndex] = {
        ...state.columns[columnResizeStartPayload.columnIndex],
        width: columnResizeStartPayload.width,
      };

      return {
        ...state,
        columns,
        isResizeInProgress: true,
      };
    case DatagridActionType.columnMove:
      columns = [...state.columns];
      const columnMovePayload = action.payload;

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
    case DatagridActionType.columnResizeEnd:
      return {
        ...state,
        isResizeInProgress: false,
      };
    case DatagridActionType.updateColumns:
      const updateColumnsPayload = action.payload;

      columns = [
        ...updateColumnsPayload.frame.fields.map((field: Field, index: number) => {
          // find column by field name and update width in new set. We cannot use index because
          // if a column gets deleted we don't know the correct index anymore
          const width = state.columns.find((column) => column.title === field.name)?.width;
          const displayName = getFieldDisplayName(field, updateColumnsPayload.frame);

          return {
            title: displayName,
            width: width ?? getCellWidth(field),
            icon: typeToIconMap.get(field.type),
            hasMenu: isDatagridEnabled(),
            trailingRowOptions: { targetColumn: --index },
          };
        }),
      ];

      return {
        ...state,
        columns,
      };
    case DatagridActionType.showColumnRenameInput:
      return {
        ...state,
        renameColumnInputData: {
          ...state.renameColumnInputData,
          isInputOpen: true,
        },
      };
    case DatagridActionType.hideColumnRenameInput:
      return {
        ...state,
        renameColumnInputData: {
          ...state.renameColumnInputData,
          isInputOpen: false,
        },
      };
    case DatagridActionType.openCellContextMenu:
      const openCellContextMenuPayload = action.payload;
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
    case DatagridActionType.openHeaderContextMenu:
      const openHeaderContextMenuPayload = action.payload;
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
    case DatagridActionType.openHeaderDropdownMenu:
      const openHeaderDropdownMenuPayload = action.payload;
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
    case DatagridActionType.closeContextMenu:
      return {
        ...state,
        contextMenuData: {
          isContextMenuOpen: false,
        },
      };
    case DatagridActionType.closeSearch:
      return {
        ...state,
        toggleSearch: false,
      };
    case DatagridActionType.openSearch:
      return {
        ...state,
        toggleSearch: true,
      };
    case DatagridActionType.multipleCellsSelected:
      const multipleCellsSelectedPayload = action.payload;

      return {
        ...state,
        gridSelection: multipleCellsSelectedPayload.selection,
      };
    case DatagridActionType.gridSelectionCleared:
      return {
        ...state,
        gridSelection: EMPTY_GRID_SELECTION,
      };
    case DatagridActionType.columnFreezeReset:
      return {
        ...state,
        columnFreezeIndex: 0,
      };
    case DatagridActionType.columnFreezeChanged:
      const columnFreezeChangedPayload = action.payload;

      return {
        ...state,
        columnFreezeIndex: columnFreezeChangedPayload.columnIndex,
      };
    default:
      return state;
  }
};
