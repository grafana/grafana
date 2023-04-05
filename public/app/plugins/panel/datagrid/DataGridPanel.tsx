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
  DataFrame,
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

import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { AddColumn } from './components/AddColumn';
import { DatagridContextMenu } from './components/DatagridContextMenu';
import { PanelOptions } from './panelcfg.gen';
import {
  clearCellsFromRangeSelection,
  deleteRows,
  EMPTY_CELL,
  EMPTY_GRID_SELECTION,
  getCellWidth,
  GRAFANA_DS,
  publishSnapshot,
  RIGHT_ELEMENT_PROPS,
  TRAILING_ROW_OPTIONS,
} from './utils';

interface DatagridContextMenuData {
  x?: number;
  y?: number;
  column?: number;
  row?: number;
  isHeaderMenu?: boolean;
  isContextMenuOpen: boolean;
}

interface Props extends PanelProps<PanelOptions> {}

export const DataGridPanel: React.FC<Props> = ({ options, data, id, fieldConfig }) => {
  const [gridData, setGridData] = useState<DataFrame>(data.series[options.selectedSeries ?? 0]);
  const [columns, setColumns] = useState<SizedGridColumn[]>([]);
  const [contextMenuData, setContextMenuData] = useState<DatagridContextMenuData>({ isContextMenuOpen: false });
  const [gridSelection, setGridSelection] = useState<GridSelection>(EMPTY_GRID_SELECTION);
  const [columnFreezeIndex, setColumnFreezeIndex] = useState<number>(-1);
  const [toggleSearch, setToggleSearch] = useState<boolean>(false);
  const [isSnapshotted, setIsSnapshotted] = useState<boolean>(false);

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
    ]);

    if (!gridData) {
      return;
    }

    setColumns((prevColumns) => [
      ...gridData.fields.map((f, i) => {
        const displayName = getFieldDisplayName(f, gridData);
        const width = prevColumns[i]?.width ?? getCellWidth(f, theme.typography.fontSize);
        return { title: displayName, width: width, icon: typeToIconMap.get(f.type), hasMenu: true };
      }),
    ]);
  }, [gridData, theme.typography.fontSize]);

  useEffect(() => {
    setGridColumns();
  }, [gridData, setGridColumns]);

  useEffect(() => {
    const panelModel = getDashboardSrv().getCurrent()?.getPanelById(id);

    if (panelModel?.datasource?.type !== GRAFANA_DS.type) {
      setIsSnapshotted(false);
    } else {
      setIsSnapshotted(true);
    }
  }, [id, options, data]);

  useEffect(() => {
    if (!isSnapshotted) {
      setGridData(data.series[options.selectedSeries ?? 0]);
    }
  }, [data, isSnapshotted, options.selectedSeries]);

  useEffect(() => {
    if (isSnapshotted) {
      publishSnapshot(gridData, id);
    }
  }, [gridData, id, isSnapshotted]);

  const getCellContent = ([col, row]: Item): GridCell => {
    const field: Field = gridData.fields[col];

    if (!field) {
      return EMPTY_CELL;
    }

    const value = field.values.get(row);

    if (value === undefined || value === null) {
      return EMPTY_CELL;
    }

    switch (field.type) {
      case FieldType.boolean:
        return {
          kind: GridCellKind.Boolean,
          data: value,
          allowOverlay: false,
        };
      case FieldType.number:
        return {
          kind: GridCellKind.Number,
          data: value,
          allowOverlay: true,
          readonly: false,
          displayData: value.toString(),
        };
      default:
        return {
          kind: GridCellKind.Text,
          data: value,
          allowOverlay: true,
          readonly: false,
          displayData: value.toString(),
        };
    }
  };

  const onCellEdited = (cell: Item, newValue: EditableGridCell) => {
    const [col, row] = cell;
    const field: Field = gridData.fields[col];

    if (!field || !newValue.data) {
      return;
    }

    const values = field.values.toArray();

    //TODO REMOVE THIS AND LET THE USER CHOOSE THE TYPE BY APPLYING TRANSFORMS!
    // //todo maybe come back to this later and look for a better way
    // //Convert field type and value between string and number if needed
    // //If field type is number we check if the new value is numeric. If it isn't we change the field type
    // let val = newValue.data;
    // if (field.type === FieldType.number) {
    //   if (!isNumeric(val)) {
    //     field.type = FieldType.string;
    //   } else {
    //     val = Number(val);
    //   }
    //   //If field type is string we check if the new value is numeric. If it is numeric and all other fields are also numeric we change the field type
    //   //If we change the field type we also convert all other values to numbers
    // } else if (field.type === FieldType.string) {
    //   if (isNumeric(val) && values.filter((_, index) => index !== row).findIndex((v) => !isNumeric(v)) === -1) {
    //     field.type = FieldType.number;
    //     val = Number(val);

    //     if (values.findIndex((v) => typeof v === 'string') !== -1) {
    //       values.forEach((v, index) => {
    //         if (typeof v === 'string') {
    //           values[index] = Number(v);
    //         }
    //       });
    //     }
    //   }
    // }

    values[row] = newValue.data;
    field.values = new ArrayVector(values);

    setIsSnapshotted(true);
    setGridData(new MutableDataFrame(gridData));
  };

  const onColumnInputBlur = (columnName: string) => {
    const len = gridData.length ?? 50; //todo ?????? 50????

    const newFrame = new MutableDataFrame(gridData);

    const field: Field = {
      name: columnName,
      type: FieldType.string,
      config: {},
      values: new ArrayVector(new Array(len).fill('')),
    };

    newFrame.addField(field);

    setIsSnapshotted(true);
    setGridData(newFrame);
  };

  const addNewRow = () => {
    const newFrame = new MutableDataFrame(gridData);
    newFrame.appendRow(new Array(newFrame.fields.length).fill(null));

    setIsSnapshotted(true);
    setGridData(newFrame);
  };

  const onColumnResize = (column: GridColumn, newSize: number, colIndex: number, newSizeWithGrow: number) => {
    setColumns((prevColumns) => {
      const newColumns = [...prevColumns];
      newColumns[colIndex] = { title: column.title, icon: column.icon, width: newSize, hasMenu: true };
      return newColumns;
    });
  };

  const closeContextMenu = () => {
    setContextMenuData({ isContextMenuOpen: false });
  };

  const onDeletePressed = (selection: GridSelection) => {
    if (selection.current && selection.current.range) {
      setGridData(clearCellsFromRangeSelection(gridData, selection.current.range));
      return true;
    }

    if (selection.rows) {
      setGridData(deleteRows(gridData, selection.rows.toArray()));
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
  };

  const onColumnMove = (from: number, to: number) => {
    const newFrame = new MutableDataFrame(gridData);
    const field = newFrame.fields[from];
    newFrame.fields.splice(from, 1);
    newFrame.fields.splice(to, 0, field);

    setIsSnapshotted(true);
    setGridData(newFrame);
  };

  const onRowMove = (from: number, to: number) => {
    const newFrame = new MutableDataFrame(gridData);

    for (const field of newFrame.fields) {
      const values = field.values.toArray();
      const value = values[from];
      values.splice(from, 1);
      values.splice(to, 0, value);
      field.values = new ArrayVector(values);
    }

    setIsSnapshotted(true);
    setGridData(newFrame);
  };

  if (!document.getElementById('portal')) {
    const portal = document.createElement('div');
    portal.id = 'portal';
    document.body.appendChild(portal);
  }

  if (!gridData) {
    return <PanelDataErrorView panelId={id} fieldConfig={fieldConfig} data={data} />;
  }

  const numRows = gridData.length;
  const styles = getStyles(theme);

  return (
    <>
      <DataEditor
        getCellContent={getCellContent}
        columns={columns}
        rows={numRows}
        width={'100%'}
        height={'100%'}
        theme={gridTheme}
        onCellEdited={onCellEdited}
        getCellsForSelection={true}
        showSearch={toggleSearch}
        onSearchClose={() => setToggleSearch(false)}
        onPaste={true}
        gridSelection={gridSelection}
        onGridSelectionChange={setGridSelection}
        onRowAppended={addNewRow}
        onDelete={onDeletePressed}
        rowMarkers={'clickable-number'}
        onColumnResize={onColumnResize}
        onCellContextMenu={onCellContextMenu}
        onHeaderContextMenu={onHeaderContextMenu}
        onHeaderMenuClick={onHeaderMenuClick}
        trailingRowOptions={TRAILING_ROW_OPTIONS}
        rightElement={<AddColumn onColumnInputBlur={onColumnInputBlur} divStyle={styles.addColumnDiv} />}
        rightElementProps={RIGHT_ELEMENT_PROPS}
        freezeColumns={columnFreezeIndex}
        onRowMoved={onRowMove}
        onColumnMoved={onColumnMove}
      />
      {contextMenuData.isContextMenuOpen && (
        <DatagridContextMenu
          x={contextMenuData.x!}
          y={contextMenuData.y!}
          column={contextMenuData.column}
          row={contextMenuData.row}
          data={gridData}
          saveData={setGridData}
          closeContextMenu={closeContextMenu}
          setToggleSearch={setToggleSearch}
          gridSelection={gridSelection}
          isHeaderMenu={contextMenuData.isHeaderMenu}
          setColumnFreezeIndex={setColumnFreezeIndex}
          columnFreezeIndex={columnFreezeIndex}
        />
      )}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  const height = '37px';
  const width = '120px';

  return {
    addColumnDiv: css`
      width: ${width};
      display: flex;
      flex-direction: column;
      background-color: ${theme.colors.background.primary};
      button {
        border: none;
        outline: none;
        height: ${height};
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
        height: ${height};
        border: 1px solid ${theme.colors.primary.main};
        :focus {
          outline: none;
        }
      }
    `,
  };
};
