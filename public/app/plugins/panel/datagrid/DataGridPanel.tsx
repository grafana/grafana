import { css } from '@emotion/css';
import DataEditor, {
  GridCell,
  Item,
  GridColumn,
  GridCellKind,
  EditableGridCell,
  GridColumnIcon,
} from '@glideapps/glide-data-grid';
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
import { GrafanaQuery, GrafanaQueryType } from 'app/plugins/datasource/grafana/types';

import { AddColumn } from './components/AddColumn';
import { PanelOptions } from './models.gen';
import { isNumeric } from './utils';

const ICON_WIDTH = 30;

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
    const typeToIconMap: Map<string, GridColumnIcon> = new Map([
      [FieldType.number, GridColumnIcon.HeaderNumber],
      [FieldType.string, GridColumnIcon.HeaderTextTemplate],
      [FieldType.boolean, GridColumnIcon.HeaderBoolean],
    ]);

    setColumns(
      frame.fields.map((f) => {
        const displayName = getFieldDisplayName(f, frame);
        const width = displayName.length * theme.typography.fontSize + ICON_WIDTH;
        return { title: displayName, width: width, icon: typeToIconMap.get(f.type) };
      })
    );
  }, [frame, theme.typography.fontSize]);

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

      //If we are in panel edit mode, we need to publish an event to update the DS and panel model
      if (dashboard?.panelInEdit?.id === id) {
        dashboard?.events.publish({
          type: DatagridDataChangeEvent.type,
          payload: {
            snapshot,
          },
        });

        return;
      }

      //Otherwise we can just update the panel model directly
      const panelModel = dashboard?.getPanelById(id);
      const query: GrafanaQuery = {
        refId: 'A',
        queryType: GrafanaQueryType.Snapshot,
        snapshot,
        datasource: grafanaDS,
      };

      panelModel!.updateQueries({
        dataSource: grafanaDS,
        queries: [query],
      });

      panelModel!.refresh();
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

    return {
      kind: GridCellKind.Text,
      data: value.toString(),
      allowOverlay: true,
      readonly: false,
      displayData: value.toString(),
    };
  };

  const onCellEdited = (cell: Item, newValue: EditableGridCell) => {
    const [col, row] = cell;
    const field: Field = frame.fields[col];

    if (!field || !newValue.data) {
      throw new Error('OH NO 3');
    }

    const values = field.values.toArray();

    //todo maybe come back to this later and look for a better way
    //Convert field type and value between string and number if needed
    //If field type is number we check if the new value is numeric. If it isn't we change the field type
    let val = newValue.data;
    if (field.type === FieldType.number) {
      if (!isNumeric(val)) {
        field.type = FieldType.string;
      } else {
        val = Number(val);
      }
      //If field type is string we check if the new value is numeric. If it is numeric and all other fields are also numeric we change the field type
      //If we change the field type we also convert all other values to numbers
    } else if (field.type === FieldType.string) {
      if (isNumeric(val) && values.filter((_, index) => index !== row).findIndex((v) => !isNumeric(v)) === -1) {
        field.type = FieldType.number;
        val = Number(val);

        if (values.findIndex((v) => typeof v === 'string') !== -1) {
          values.forEach((v, index) => {
            if (typeof v === 'string') {
              values[index] = Number(v);
            }
          });
        }
      }
    }

    values[row] = val;
    field.values = new ArrayVector(values);

    setIsSnapshotted(true);
    setGridData(new MutableDataFrame(frame));
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
      newColumns[colIndex] = { title: column.title, icon: column.icon, width: newSize };
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
