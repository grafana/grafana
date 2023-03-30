import { css } from '@emotion/css';
import DataEditor, { GridCell, Item, GridColumn, GridCellKind, EditableGridCell } from '@glideapps/glide-data-grid';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  ArrayVector,
  DataFrame,
  DataFrameJSON,
  dataFrameToJSON,
  Field,
  MutableDataFrame,
  PanelProps,
  DatagridDataChangeEvent,
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
import { PanelOptions } from './models.gen';

interface Props extends PanelProps<PanelOptions> {}

export const DataGridPanel: React.FC<Props> = ({ options, data, id, width, height, fieldConfig }) => {
  const [gridData, setGridData] = useState<DataFrame | null>(data.series[0]);
  const [columns, setColumns] = useState<GridColumn[]>([]);
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
  const grafanaDS = {
    type: 'grafana',
    uid: 'grafana',
  };

  const frame = useMemo((): DataFrame => {
    if (gridData && isSnapshotted) {
      return gridData;
    }

    return data.series[0];
  }, [gridData, data, isSnapshotted]);

  const setGridColumns = useCallback(() => {
    setColumns(
      frame.fields.map((f, i) => {
        const displayName = getFieldDisplayName(f, frame);
        const width = displayName.length * theme.typography.fontSize;
        return { title: displayName, width: width };
      })
    );
  }, [frame, theme]);

  useEffect(() => {
    setGridColumns();
  }, [frame, setGridColumns]);

  useEffect(() => {
    const panelModel = getDashboardSrv().getCurrent()?.getPanelById(id);

    if (panelModel?.datasource !== grafanaDS) {
      setIsSnapshotted(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    if (!isSnapshotted) {
      return;
    }

    if (gridData) {
      console.log('Updating panel model', gridData);
      const snapshot: DataFrameJSON[] = [dataFrameToJSON(gridData)];
      const dashboard = getDashboardSrv().getCurrent();
      dashboard?.events.publish({
        type: DatagridDataChangeEvent.type,
        payload: {
          snapshot,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gridData]);

  const getCellContent = ([col, row]: Item): GridCell => {
    const field: Field = frame.fields[col];

    if (!field) {
      throw new Error('OH NO');
    }

    const value = field.values.get(row);

    if (value === undefined || value === null) {
      throw new Error('OH NO 2');
    }

    //TODO there is an error with number gridcells when opening the overlay and editing. so I ignored and made everything text for now

    return {
      kind: GridCellKind.Text,
      data: value,
      allowOverlay: true,
      readonly: false,
      displayData: value.toString(),
    };

    // switch (field.type) {
    //   case FieldType.number:
    //     return {
    //       kind: GridCellKind.Number,
    //       data: value.toString(),
    //       allowOverlay: true,
    //       readonly: false,
    //       displayData: value.toString(),
    //     };
    //   case FieldType.time:
    //     return {
    //       kind: GridCellKind.Text,
    //       data: value,
    //       allowOverlay: true,
    //       readonly: false,
    //       displayData: new Date(value).toTimeString(),
    //     };
    //   case FieldType.string:
    //     return {
    //       kind: GridCellKind.Text,
    //       data: value,
    //       allowOverlay: true,
    //       readonly: false,
    //       displayData: value.toString(),
    //     };
    //   default:
    //     //TODO ?????? ^^^^^^
    //     return {
    //       kind: GridCellKind.Text,
    //       data: value,
    //       allowOverlay: true,
    //       readonly: false,
    //       displayData: value.toString(),
    //     };
    // }
  };

  const onCellEdited = (cell: Item, newValue: EditableGridCell) => {
    const [col, row] = cell;
    const field: Field = frame.fields[col];

    if (!field) {
      throw new Error('OH NO 3');
    }

    const values = field.values.toArray();
    values[row] = newValue.data;
    field.values = new ArrayVector(values);

    if (gridData) {
      const newFrame = new MutableDataFrame(frame);
      const values = newFrame.fields[col].values.toArray();
      values[row] = String(newValue.data) ?? '';
      newFrame.fields[col].values = new ArrayVector(values);

      setIsSnapshotted(true);
      setGridData(newFrame);
    }
  };

  const onColumnInputBlur = (columnName: string) => {
    //todo need to rethink this for blank slate case
    if (!gridData) {
      return;
    }

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
    //todo need to rethink this for blank slate case
    if (!gridData) {
      return;
    }

    const newFrame = new MutableDataFrame(gridData);

    for (const field of newFrame.fields) {
      field.values.add('');
    }

    setIsSnapshotted(true);
    setGridData(newFrame);
  };

  const onColumnResize = (column: GridColumn, newSize: number, colIndex: number, newSizeWithGrow: number) => {
    setColumns((prevColumns) => {
      const newColumns = [...prevColumns];
      newColumns[colIndex] = { title: column.title, width: newSize };
      return newColumns;
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

  //TODO multiple series support
  const numRows = frame.length;
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
        onHeaderClicked={() => {
          console.log('header clicked');
        }}
        onRowAppended={addNewRow}
        rowMarkers={'clickable-number'}
        onColumnResize={onColumnResize}
        trailingRowOptions={{
          sticky: false,
          tint: true,
          targetColumn: 0,
        }}
        rightElement={<AddColumn onColumnInputBlur={onColumnInputBlur} divStyle={styles.addColumnDiv} />}
        rightElementProps={{
          fill: true,
          sticky: false,
        }}
      />
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
