import { CellClickedEventArgs, GridColumnIcon, GridSelection, HeaderClickedEventArgs, Item, Rectangle, SizedGridColumn } from "@glideapps/glide-data-grid";

import { Field, FieldType, getFieldDisplayName } from "@grafana/data";

import { DatagridContextMenuData, DEFAULT_CONTEXT_MENU, DEFAULT_RENAME_INPUT_DATA, EMPTY_GRID_SELECTION, getCellWidth, isDatagridEditEnabled, RenameColumnInputData } from "./utils";

interface DatagridState {
  columns: SizedGridColumn[],
  contextMenuData: DatagridContextMenuData,
  renameColumnInputData: RenameColumnInputData,
  gridSelection: GridSelection,
  columnFreezeIndex: number,
  toggleSearch: boolean,
  isResizeInProgress: boolean,
}

export interface DatagridAction {
  type: DatagridActionType,
  payload?: any,
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
      columns[action.payload.columnIndex] = {
        ...state.columns[action.payload.columnIndex],
        width: action.payload.width,
      }

      return {
        ...state,
        columns,
        isResizeInProgress: true,
      }
    break;
    case DatagridActionType.columnMove:
      columns = [...state.columns];
      const widthFrom = state.columns[action.payload.from].width;
      //TODO FIX DRAGGING AND DROPPING COLUMNS
      const widthTo = state.columns[action.payload.to].width;

      if (action.payload.from < action.payload.to) {
        for (let i = action.payload.from; i < action.payload.to; i++) {
          columns[i] = {
            ...state.columns[i],
            width: state.columns[i + 1].width,
          };
        }
        // THIS ONE DOESNT WORK YET
      } else {
        for (let i = action.payload.from; i < action.payload.to; i--) {
          columns[i] = {
            ...state.columns[i],
            width: state.columns[i + 1].width,
          };
        }
      }
      
      columns[action.payload.to] = {
        ...state.columns[action.payload.to],
        width: widthFrom,
      };

      return {
        ...state,
        columns,
      }
    break;
    case DatagridActionType.columnResizeEnd:
      return {
        ...state,
        isResizeInProgress: false,
      }
    break;
    case DatagridActionType.updateColumns:
      columns = [
        ...action.payload.frame.fields.map((field: Field, index: number) => {
          const displayName = getFieldDisplayName(field, action.payload.frame);
          return {
            title: displayName,
            width: state.columns[index]?.width ?? getCellWidth(field),
            icon: typeToIconMap.get(field.type),
            hasMenu: isDatagridEditEnabled(),
            trailingRowOptions: { targetColumn: --index },
          };
        })
      ]

      return {
        ...state,
        columns
      }
    break;
    case DatagridActionType.showColumnRenameInput:
      return {
        ...state,
        renameColumnInputData: {
          ...state.renameColumnInputData,
          isInputOpen: true,
        },
      }
    break;
    case DatagridActionType.hideColumnRenameInput:
      return {
        ...state,
        renameColumnInputData: {
          ...state.renameColumnInputData,
          isInputOpen: false,
        },
      }
    break;
    case DatagridActionType.openCellContextMenu:
      const cellEvent: CellClickedEventArgs = action.payload.event;
      const cell: Item = action.payload.cell;

      return {
        ...state,
        contextMenuData: {
          x: cellEvent.bounds.x + cellEvent.localEventX,
          y: cellEvent.bounds.y + cellEvent.localEventY,
          column: cell[0] === -1 ? undefined : cell[0], //row numbers,
          row: cell[1],
          isContextMenuOpen: true,
          isHeaderMenu: false
        },
      }
    break;
    case DatagridActionType.openHeaderContextMenu:
      const headerEvent: HeaderClickedEventArgs = action.payload.event;

      return {
        ...state,
        contextMenuData: {
          x: headerEvent.bounds.x + headerEvent.localEventX,
          y: headerEvent.bounds.y + headerEvent.localEventY,
          column: action.payload.columnIndex,
          row: undefined, //header
          isContextMenuOpen: true,
          isHeaderMenu: false
        },
      }
    break;
    case DatagridActionType.openHeaderDropdownMenu:
      const screenPosition: Rectangle = action.payload.screenPosition;

      return {
        ...state,
        contextMenuData: {
          x: screenPosition.x + screenPosition.width,
          y: screenPosition.y + screenPosition.height,
          column: action.payload.columnIndex,
          row: undefined, //header
          isContextMenuOpen: true,
          isHeaderMenu: true
        },
        renameColumnInputData: {
          x: screenPosition.x,
          y: screenPosition.y,
          width: screenPosition.width,
          height: screenPosition.height,
          columnIdx: action.payload.columnIndex,
          isInputOpen: false,
          inputValue: action.payload.value
        }
      }
    break;
    case DatagridActionType.closeContextMenu:
      return {
        ...state,
        contextMenuData: {
          isContextMenuOpen: false,
        }
      }
    break;
    case DatagridActionType.closeSearch:
      return {
        ...state,
        toggleSearch: false
      }
    break;
    case DatagridActionType.openSearch:
      return {
        ...state,
        toggleSearch: true
      }
    break;
    case DatagridActionType.multipleCellsSelected: 
      return {
        ...state,
        gridSelection: action.payload.selection
      }
    break;
    case DatagridActionType.gridSelectionCleared:
      return {
        ...state,
        gridSelection: EMPTY_GRID_SELECTION
      }
    break;
    case DatagridActionType.columnFreezeReset:
      return {
        ...state,
        columnFreezeIndex: 0
      }
    break;
    case DatagridActionType.columnFreezeChanged:
      return {
        ...state,
        columnFreezeIndex: action.payload.columnIndex
      }
    break;
    default:
      return state;
  }
};
