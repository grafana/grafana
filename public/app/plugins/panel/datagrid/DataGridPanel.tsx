import DataEditor, {
  GridCell,
  Item,
  GridColumn,
  EditableGridCell,
  GridSelection,
  CellClickedEventArgs,
  Rectangle,
  HeaderClickedEventArgs,
} from '@glideapps/glide-data-grid';
import React, { useEffect, useReducer } from 'react';

import { Field, PanelProps, FieldType, DataFrame } from '@grafana/data';
import { PanelDataErrorView, reportInteraction } from '@grafana/runtime';
import { usePanelContext, useTheme2 } from '@grafana/ui';

import '@glideapps/glide-data-grid/dist/index.css';

import { AddColumn } from './components/AddColumn';
import { DatagridContextMenu } from './components/DatagridContextMenu';
import { RenameColumnCell } from './components/RenameColumnCell';
import { isDatagridEnabled } from './featureFlagUtils';
import { Options } from './panelcfg.gen';
import { DatagridActionType, datagridReducer, initialState } from './state';
import {
  clearCellsFromRangeSelection,
  deleteRows,
  EMPTY_CELL,
  getGridCellKind,
  getGridTheme,
  RIGHT_ELEMENT_PROPS,
  TRAILING_ROW_OPTIONS,
  getStyles,
  ROW_MARKER_BOTH,
  ROW_MARKER_NUMBER,
  hasGridSelection,
  updateSnapshot,
  INTERACTION_EVENT_NAME,
  INTERACTION_ITEM,
} from './utils';

export interface DataGridProps extends PanelProps<Options> {}

export function DataGridPanel({ options, data, id, fieldConfig, width, height }: DataGridProps) {
  const [state, dispatch] = useReducer(datagridReducer, initialState);
  const { onUpdateData } = usePanelContext();

  const {
    columns,
    contextMenuData,
    renameColumnInputData,
    gridSelection,
    columnFreezeIndex,
    toggleSearch,
    isResizeInProgress,
  } = state;

  const frame = data.series[options.selectedSeries ?? 0];

  const theme = useTheme2();
  const gridTheme = getGridTheme(theme);

  useEffect(() => {
    if (!frame) {
      return;
    }

    dispatch({ type: DatagridActionType.updateColumns, payload: { frame } });
  }, [frame]);

  const getCellContent = ([col, row]: Item): GridCell => {
    const field: Field = frame.fields[col];

    if (!field || row > frame.length) {
      return EMPTY_CELL;
    }

    return getGridCellKind(field, row, hasGridSelection(gridSelection));
  };

  const onCellEdited = (cell: Item, newValue: EditableGridCell) => {
    // if there are rows selected, return early, we don't want to edit any cell
    if (hasGridSelection(gridSelection)) {
      return;
    }

    const [col, row] = cell;
    const frameCopy = {
      ...frame,
      fields: frame.fields.map((f) => {
        return {
          ...f,
          values: [...f.values],
        };
      }),
    };
    const field: Field = frameCopy.fields[col];

    if (!field) {
      return;
    }

    const values = field.values.toArray();

    values[row] = newValue.data;
    field.values = [...values];

    reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.EDIT_CELL });

    updateSnapshot(frameCopy, onUpdateData);
  };

  const onColumnInputBlur = (columnName: string) => {
    const len = frame.length ?? 0;
    reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.APPEND_COLUMN });
    updateSnapshot(
      {
        ...frame,
        fields: [
          ...frame.fields,
          {
            name: columnName,
            type: FieldType.string,
            config: {},
            values: new Array(len).fill(''),
          },
        ],
      },
      onUpdateData
    );
  };

  const addNewRow = () => {
    const fields = frame.fields.map((f) => {
      const values = f.values.slice(); // copy
      values.push(null);
      return { ...f, values };
    });

    reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.APPEND_ROW });
    updateSnapshot({ ...frame, fields, length: frame.length + 1 }, onUpdateData);
  };

  const onColumnResize = (column: GridColumn, width: number, columnIndex: number, newSizeWithGrow: number) => {
    reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.COLUMN_RESIZE });
    dispatch({ type: DatagridActionType.columnResizeStart, payload: { columnIndex, width } });
  };

  //Hack used to allow resizing last column, near add column btn. This is a workaround for a bug in the grid component
  const onColumnResizeEnd = (column: GridColumn, newSize: number, colIndex: number, newSizeWithGrow: number) => {
    dispatch({ type: DatagridActionType.columnResizeEnd });
  };

  const closeContextMenu = () => {
    dispatch({ type: DatagridActionType.closeContextMenu });
  };

  const onDeletePressed = (selection: GridSelection) => {
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
      const copiedFrame = {
        ...frame,
        fields: frame.fields.map((field, index) => {
          if (cols.includes(index)) {
            return {
              ...field,
              values: new Array(frame.length).fill(null),
            };
          }

          return field;
        }),
      };
      reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.DELETE_BTN_PRESSED, selection: 'columns' });
      updateSnapshot(copiedFrame, onUpdateData);
      return true;
    }

    return false;
  };

  const onCellContextMenu = (cell: Item, event: CellClickedEventArgs) => {
    event.preventDefault();
    dispatch({ type: DatagridActionType.openCellContextMenu, payload: { event, cell } });
  };

  const onHeaderContextMenu = (columnIndex: number, event: HeaderClickedEventArgs) => {
    event.preventDefault();
    dispatch({ type: DatagridActionType.openHeaderContextMenu, payload: { event, columnIndex } });
  };

  const onHeaderMenuClick = (col: number, screenPosition: Rectangle) => {
    dispatch({
      type: DatagridActionType.openHeaderDropdownMenu,
      payload: { screenPosition, columnIndex: col, value: state.columns[col].title },
    });
  };

  const onColumnMove = async (from: number, to: number) => {
    const fields = frame.fields.map((f) => f);
    const field = fields[from];
    fields.splice(from, 1);
    fields.splice(to, 0, field);

    const hasUpdated = await updateSnapshot({ ...frame, fields }, onUpdateData);

    if (hasUpdated) {
      reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.COLUMN_REORDER });
      dispatch({ type: DatagridActionType.columnMove, payload: { from, to } });
    }
  };

  const onRowMove = (from: number, to: number) => {
    const fields = frame.fields.map((f) => ({ ...f, values: f.values.slice() }));

    for (const field of fields) {
      const value = field.values[from];
      field.values.splice(from, 1);
      field.values.splice(to, 0, value);
    }

    reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.ROW_REORDER });
    updateSnapshot({ ...frame, fields }, onUpdateData);
  };

  const onColumnRename = () => {
    reportInteraction(INTERACTION_EVENT_NAME, {
      item: INTERACTION_ITEM.HEADER_MENU_ACTION,
      menu_action: 'rename_column',
    });
    dispatch({ type: DatagridActionType.showColumnRenameInput });
  };

  const onRenameInputBlur = (columnName: string, columnIdx: number) => {
    const fields = frame.fields.map((f) => f);
    fields[columnIdx].name = columnName;

    dispatch({ type: DatagridActionType.hideColumnRenameInput });

    updateSnapshot({ ...frame, fields }, onUpdateData);
  };

  const onSearchClose = () => {
    dispatch({ type: DatagridActionType.closeSearch });
  };

  const onGridSelectionChange = (selection: GridSelection) => {
    reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.GRID_SELECTED });
    dispatch({ type: DatagridActionType.multipleCellsSelected, payload: { selection } });
  };

  const onContextMenuSave = (data: DataFrame) => {
    updateSnapshot(data, onUpdateData);
  };

  if (!frame) {
    return <PanelDataErrorView panelId={id} fieldConfig={fieldConfig} data={data} />;
  }

  if (!isDatagridEnabled()) {
    return <PanelDataErrorView panelId={id} message="Datagrid is not enabled" fieldConfig={fieldConfig} data={data} />;
  }

  if (!document.getElementById('portal')) {
    const portal = document.createElement('div');
    portal.id = 'portal';
    document.body.appendChild(portal);
  }

  const styles = getStyles(theme, isResizeInProgress);

  return (
    <>
      <DataEditor
        className={styles.dataEditor}
        getCellContent={getCellContent}
        columns={columns}
        rows={frame.length}
        width={width}
        height={height}
        initialSize={[width, height]}
        theme={gridTheme}
        smoothScrollX
        smoothScrollY
        overscrollY={50}
        onCellEdited={isDatagridEnabled() ? onCellEdited : undefined}
        getCellsForSelection={isDatagridEnabled() ? true : undefined}
        showSearch={isDatagridEnabled() ? toggleSearch : false}
        onSearchClose={onSearchClose}
        gridSelection={gridSelection}
        onGridSelectionChange={isDatagridEnabled() ? onGridSelectionChange : undefined}
        onRowAppended={isDatagridEnabled() ? addNewRow : undefined}
        onDelete={isDatagridEnabled() ? onDeletePressed : undefined}
        rowMarkers={isDatagridEnabled() ? ROW_MARKER_BOTH : ROW_MARKER_NUMBER}
        onColumnResize={onColumnResize}
        onColumnResizeEnd={onColumnResizeEnd}
        onCellContextMenu={isDatagridEnabled() ? onCellContextMenu : undefined}
        onHeaderContextMenu={isDatagridEnabled() ? onHeaderContextMenu : undefined}
        onHeaderMenuClick={isDatagridEnabled() ? onHeaderMenuClick : undefined}
        trailingRowOptions={TRAILING_ROW_OPTIONS}
        rightElement={
          isDatagridEnabled() ? (
            <AddColumn onColumnInputBlur={onColumnInputBlur} divStyle={styles.addColumnDiv} />
          ) : null
        }
        rightElementProps={RIGHT_ELEMENT_PROPS}
        freezeColumns={columnFreezeIndex}
        onRowMoved={isDatagridEnabled() ? onRowMove : undefined}
        onColumnMoved={isDatagridEnabled() ? onColumnMove : undefined}
      />
      {contextMenuData.isContextMenuOpen && (
        <DatagridContextMenu
          menuData={contextMenuData}
          data={frame}
          saveData={onContextMenuSave}
          closeContextMenu={closeContextMenu}
          dispatch={dispatch}
          gridSelection={gridSelection}
          columnFreezeIndex={columnFreezeIndex}
          renameColumnClicked={onColumnRename}
        />
      )}
      {renameColumnInputData.isInputOpen ? (
        <RenameColumnCell
          onColumnInputBlur={onRenameInputBlur}
          renameColumnData={renameColumnInputData}
          classStyle={styles.renameColumnInput}
        />
      ) : null}
    </>
  );
}
