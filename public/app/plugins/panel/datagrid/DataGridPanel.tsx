import { css } from '@emotion/css';
import DataEditor, {
  GridCell,
  Item,
  GridColumn,
  GridCellKind,
  EditableGridCell,
  GridColumnIcon,
  GridSelection,
  CellClickedEventArgs,
  Rectangle,
  HeaderClickedEventArgs,
  SizedGridColumn,
} from '@glideapps/glide-data-grid';
import React, { useCallback, useEffect, useState } from 'react';

import {
  ArrayVector,
  Field,
  MutableDataFrame,
  PanelProps,
  GrafanaTheme2,
  getFieldDisplayName,
  FieldType,
} from '@grafana/data';
import { PanelDataErrorView } from '@grafana/runtime';
// eslint-disable-next-line import/order
import { useTheme2 } from '@grafana/ui';

import '@glideapps/glide-data-grid/dist/index.css';

import { AddColumn } from './components/AddColumn';
import { DatagridContextMenu } from './components/DatagridContextMenu';
import { RenameColumnCell } from './components/RenameColumnCell';
import { PanelOptions } from './panelcfg.gen';
import {
  RenameColumnInputData,
  clearCellsFromRangeSelection,
  DatagridContextMenuData,
  deleteRows,
  EMPTY_CELL,
  EMPTY_GRID_SELECTION,
  getCellWidth,
  isDatagridEditEnabled,
  publishSnapshot,
  RIGHT_ELEMENT_PROPS,
  TRAILING_ROW_OPTIONS,
} from './utils';

interface Props extends PanelProps<PanelOptions> {}

export const DataGridPanel: React.FC<Props> = ({ options, data, id, fieldConfig }) => {
  const [columnWidths, setColumnWidths] = useState<Map<number, number>>(new Map());
  const [columns, setColumns] = useState<SizedGridColumn[]>([]);
  const [contextMenuData, setContextMenuData] = useState<DatagridContextMenuData>({ isContextMenuOpen: false });
  const [renameColumnInputData, setRenameColumnInputData] = useState<RenameColumnInputData>({ isInputOpen: false });
  const [gridSelection, setGridSelection] = useState<GridSelection>(EMPTY_GRID_SELECTION);
  const [columnFreezeIndex, setColumnFreezeIndex] = useState<number>(0);
  const [toggleSearch, setToggleSearch] = useState<boolean>(false);
  const [isResizeInProgress, setIsResizeInProgress] = useState<boolean>(false);

  const frame = data.series[options.selectedSeries ?? 0];

  const theme = useTheme2();
  const gridTheme = {
    accentColor: theme.colors.primary.main,
    accentFg: theme.colors.secondary.main,
    textDark: theme.colors.text.primary,
    textMedium: theme.colors.text.primary,
    textLight: theme.colors.text.primary,
    textBubble: theme.colors.text.primary,
    textHeader: theme.colors.text.primary,
    bgCell: theme.colors.background.primary,
    bgCellMedium: theme.colors.background.primary,
    bgHeader: theme.colors.background.secondary,
    bgHeaderHasFocus: theme.colors.background.secondary,
    bgHeaderHovered: theme.colors.background.secondary,
  };

  const setGridColumns = useCallback(() => {
    const typeToIconMap: Map<string, GridColumnIcon> = new Map([
      [FieldType.number, GridColumnIcon.HeaderNumber],
      [FieldType.string, GridColumnIcon.HeaderTextTemplate],
      [FieldType.boolean, GridColumnIcon.HeaderBoolean],
      [FieldType.time, GridColumnIcon.HeaderDate],
      [FieldType.other, GridColumnIcon.HeaderReference],
    ]);

    if (!frame) {
      return;
    }

    setColumns([
      ...frame.fields.map((f, i) => {
        const displayName = getFieldDisplayName(f, frame);
        const width = columnWidths.get(i) ?? getCellWidth(f);
        return {
          title: displayName,
          width: width,
          icon: typeToIconMap.get(f.type),
          hasMenu: isDatagridEditEnabled(),
          trailingRowOptions: { targetColumn: --i },
        };
      }),
    ]);
  }, [columnWidths, frame]);

  useEffect(() => {
    setGridColumns();
  }, [frame, setGridColumns]);

  const getCellContent = ([col, row]: Item): GridCell => {
    const field: Field = frame.fields[col];

    if (!field) {
      return EMPTY_CELL;
    }

    const value = field.values.get(row);

    switch (field.type) {
      case FieldType.boolean:
        return {
          kind: GridCellKind.Boolean,
          data: value ? value : false,
          allowOverlay: false,
          readonly: false,
        };
      case FieldType.number:
        return {
          kind: GridCellKind.Number,
          data: value ? value : 0,
          allowOverlay: isDatagridEditEnabled()!,
          readonly: false,
          displayData: value !== null && value !== undefined ? value.toString() : '',
        };
      case FieldType.string:
        return {
          kind: GridCellKind.Text,
          data: value ? value : '',
          allowOverlay: isDatagridEditEnabled()!,
          readonly: false,
          displayData: value !== null && value !== undefined ? value.toString() : '',
        };
      default:
        return {
          kind: GridCellKind.Text,
          data: value ? value : '',
          allowOverlay: isDatagridEditEnabled()!,
          readonly: false,
          displayData: value !== null && value !== undefined ? value.toString() : '',
        };
    }
  };

  const onCellEdited = (cell: Item, newValue: EditableGridCell) => {
    const [col, row] = cell;
    const field: Field = frame.fields[col];

    if (!field) {
      return;
    }

    const values = field.values.toArray();

    values[row] = newValue.data;
    field.values = new ArrayVector(values);

    publishSnapshot(new MutableDataFrame(frame), id);
  };

  const onColumnInputBlur = (columnName: string) => {
    const len = frame.length ?? 0;
    const newFrame = new MutableDataFrame(frame);

    const field: Field = {
      name: newFrame.fields.find((f) => f.name === columnName) ? `Column ${newFrame.fields.length}` : columnName,
      type: FieldType.string,
      config: {},
      values: new ArrayVector(new Array(len).fill('')),
    };

    newFrame.addField(field);

    publishSnapshot(newFrame, id);
  };

  const addNewRow = () => {
    const newFrame = new MutableDataFrame(frame);
    newFrame.appendRow(new Array(newFrame.fields.length).fill(null));

    publishSnapshot(newFrame, id);
  };

  const onColumnResize = (column: GridColumn, newSize: number, colIndex: number, newSizeWithGrow: number) => {
    setColumnWidths((prevWidths) => {
      const newWidths = new Map(prevWidths);
      newWidths.set(colIndex, newSize);

      return newWidths;
    });

    setIsResizeInProgress(true);
  };

  const onColumnResizeEnd = (column: GridColumn, newSize: number, colIndex: number, newSizeWithGrow: number) => {
    setIsResizeInProgress(false);
  };

  const closeContextMenu = () => {
    setContextMenuData({ isContextMenuOpen: false });
  };

  const onDeletePressed = (selection: GridSelection) => {
    if (selection.current && selection.current.range) {
      publishSnapshot(clearCellsFromRangeSelection(frame, selection.current.range), id);
      return true;
    }

    if (selection.rows) {
      publishSnapshot(deleteRows(frame, selection.rows.toArray()), id);
      return true;
    }

    return false;
  };

  const onCellContextMenu = (cell: Item, event: CellClickedEventArgs) => {
    event.preventDefault();
    setContextMenuData({
      x: event.bounds.x + event.localEventX,
      y: event.bounds.y + event.localEventY,
      column: cell[0] === -1 ? undefined : cell[0], //row numbers
      row: cell[1],
      isContextMenuOpen: true,
      isHeaderMenu: false,
    });
  };

  const onHeaderContextMenu = (colIndex: number, event: HeaderClickedEventArgs) => {
    event.preventDefault();
    setContextMenuData({
      x: event.bounds.x + event.localEventX,
      y: event.bounds.y + event.localEventY,
      column: colIndex,
      row: undefined, //header
      isContextMenuOpen: true,
      isHeaderMenu: false,
    });
  };

  const onHeaderMenuClick = (col: number, screenPosition: Rectangle) => {
    setContextMenuData({
      x: screenPosition.x + screenPosition.width,
      y: screenPosition.y + screenPosition.height,
      column: col,
      row: undefined, //header
      isContextMenuOpen: true,
      isHeaderMenu: true,
    });

    setRenameColumnInputData({
      x: screenPosition.x,
      y: screenPosition.y,
      width: screenPosition.width,
      height: screenPosition.height,
      columnIdx: col,
      isInputOpen: false,
      inputValue: frame.fields[col].name,
    });
  };

  const onColumnMove = (from: number, to: number) => {
    const newFrame = new MutableDataFrame(frame);
    const field = newFrame.fields[from];
    newFrame.fields.splice(from, 1);
    newFrame.fields.splice(to, 0, field);

    publishSnapshot(newFrame, id);
  };

  const onRowMove = (from: number, to: number) => {
    const newFrame = new MutableDataFrame(frame);

    for (const field of newFrame.fields) {
      const values = field.values.toArray();
      const value = values[from];
      values.splice(from, 1);
      values.splice(to, 0, value);
      field.values = new ArrayVector(values);
    }

    publishSnapshot(newFrame, id);
  };

  const onColumnRename = () => {
    setRenameColumnInputData((prevData) => {
      return {
        ...prevData,
        isInputOpen: true,
      };
    });
  };

  const onRenameInputBlur = (columnName: string, columnIdx: number) => {
    const newFrame = new MutableDataFrame(frame);
    newFrame.fields[columnIdx].name = newFrame.fields.find((f) => f.name === columnName)
      ? `Column ${columnIdx}`
      : columnName;

    publishSnapshot(newFrame, id);

    setRenameColumnInputData((prevData) => {
      return {
        ...prevData,
        isInputOpen: false,
      };
    });
  };

  if (!document.getElementById('portal')) {
    const portal = document.createElement('div');
    portal.id = 'portal';
    document.body.appendChild(portal);
  }

  if (!frame) {
    return <PanelDataErrorView panelId={id} fieldConfig={fieldConfig} data={data} />;
  }

  const numRows = frame.length;
  const styles = getStyles(theme, isResizeInProgress);

  return (
    <>
      <DataEditor
        className={styles.dataEditor}
        getCellContent={getCellContent}
        columns={columns}
        rows={numRows}
        width={'100%'}
        height={'100%'}
        theme={gridTheme}
        smoothScrollX
        smoothScrollY
        overscrollY={50}
        onCellEdited={isDatagridEditEnabled() ? onCellEdited : undefined}
        getCellsForSelection={isDatagridEditEnabled() ? true : undefined}
        showSearch={isDatagridEditEnabled() ? toggleSearch : false}
        onSearchClose={() => setToggleSearch(false)}
        onPaste={isDatagridEditEnabled() ? true : undefined}
        gridSelection={gridSelection}
        onGridSelectionChange={isDatagridEditEnabled() ? setGridSelection : undefined}
        onRowAppended={isDatagridEditEnabled() ? addNewRow : undefined}
        onDelete={isDatagridEditEnabled() ? onDeletePressed : undefined}
        rowMarkers={isDatagridEditEnabled() ? 'both' : 'number'}
        onColumnResize={onColumnResize}
        onColumnResizeEnd={onColumnResizeEnd}
        onCellContextMenu={isDatagridEditEnabled() ? onCellContextMenu : undefined}
        onHeaderContextMenu={isDatagridEditEnabled() ? onHeaderContextMenu : undefined}
        onHeaderMenuClick={isDatagridEditEnabled() ? onHeaderMenuClick : undefined}
        trailingRowOptions={TRAILING_ROW_OPTIONS}
        rightElement={
          isDatagridEditEnabled() ? (
            <AddColumn onColumnInputBlur={onColumnInputBlur} divStyle={styles.addColumnDiv} />
          ) : null
        }
        rightElementProps={RIGHT_ELEMENT_PROPS}
        freezeColumns={columnFreezeIndex}
        onRowMoved={isDatagridEditEnabled() ? onRowMove : undefined}
        onColumnMoved={isDatagridEditEnabled() ? onColumnMove : undefined}
      />
      {contextMenuData.isContextMenuOpen && (
        <DatagridContextMenu
          menuData={contextMenuData}
          data={frame}
          saveData={(data) => publishSnapshot(data, id)}
          closeContextMenu={closeContextMenu}
          setToggleSearch={setToggleSearch}
          gridSelection={gridSelection}
          setGridSelection={setGridSelection}
          setColumnFreezeIndex={setColumnFreezeIndex}
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
};

const getStyles = (theme: GrafanaTheme2, isResizeInProgress: boolean) => {
  return {
    dataEditor: css`
      .dvn-scroll-inner > div:nth-child(2) {
        pointer-events: none !important;
      }
      scrollbar-color: ${theme.colors.background.secondary} ${theme.colors.background.primary};
      ::-webkit-scrollbar {
        width: 10px;
        height: 10px;
      }
      ::-webkit-scrollbar-track {
        background: ${theme.colors.background.primary};
      }
      ::-webkit-scrollbar-thumb {
        border-radius: 10px;
      }
      ::-webkit-scrollbar-corner {
        display: none;
      }
    `,
    addColumnDiv: css`
      width: 120px;
      display: flex;
      flex-direction: column;
      background-color: ${theme.colors.background.primary};
      button {
        pointer-events: ${isResizeInProgress ? 'none' : 'auto'};
        border: none;
        outline: none;
        height: 37px;
        font-size: 20px;
        background-color: ${theme.colors.background.secondary};
        color: ${theme.colors.text.primary};
        border-right: 1px solid ${theme.components.panel.borderColor};
        border-bottom: 1px solid ${theme.components.panel.borderColor};
        transition: background-color 200ms;
        cursor: pointer;
        :hover {
          background-color: ${theme.colors.secondary.shade};
        }
      }
      input {
        height: 37px;
        border: 1px solid ${theme.colors.primary.main};
        :focus {
          outline: none;
        }
      }
    `,
    renameColumnInput: css`
      height: 37px;
      border: 1px solid ${theme.colors.primary.main};
      :focus {
        outline: none;
      }
    `,
  };
};
