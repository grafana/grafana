import { CompactSelection, GridCell, GridCellKind } from '@glideapps/glide-data-grid';

import {
  ArrayVector,
  DataFrame,
  DataFrameJSON,
  dataFrameToJSON,
  DatagridDataChangeEvent,
  MutableDataFrame,
} from '@grafana/data';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { GrafanaQuery, GrafanaQueryType } from 'app/plugins/datasource/grafana/types';

export const EMPTY_DF = {
  name: 'A',
  fields: [],
  length: 0,
};

export const GRAFANA_DS = {
  type: 'grafana',
  uid: 'grafana',
};

export const EMPTY_CELL: GridCell = {
  kind: GridCellKind.Text,
  data: '',
  allowOverlay: true,
  readonly: false,
  displayData: '',
};

export const EMPTY_GRID_SELECTION = {
  columns: CompactSelection.empty(),
  rows: CompactSelection.empty(),
};

export const TRAILING_ROW_OPTIONS = {
  sticky: false,
  tint: true,
  targetColumn: 0,
};

export const RIGHT_ELEMENT_PROPS = {
  fill: true,
  sticky: false,
};

interface CellRange {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const deleteRows = (gridData: DataFrame, rows: number[], hardDelete = false): DataFrame => {
  for (let i = 0; i < rows.length; i++) {
    for (let j = 0; j < gridData.fields.length; j++) {
      const field = gridData.fields[j];

      const rowIndex = rows[i];

      const valuesArray = field.values.toArray();

      if (hardDelete) {
        valuesArray.splice(rowIndex, 1);
      } else {
        valuesArray.splice(rowIndex, 1, null);
      }

      field.values = new ArrayVector(valuesArray);
    }
  }

  return new MutableDataFrame(gridData);
};

export const clearCellsFromRangeSelection = (gridData: DataFrame, range: CellRange): DataFrame => {
  const colFrom: number = range.x;
  const rowFrom: number = range.y;
  const colTo: number = range.x + range.width - 1;

  for (let i = colFrom; i <= colTo; i++) {
    const field = gridData.fields[i];

    const valuesArray = field.values.toArray();
    valuesArray.splice(rowFrom, range.height, ...new Array(range.height).fill(null));
    field.values = new ArrayVector(valuesArray);
  }

  return new MutableDataFrame(gridData);
};

export const publishSnapshot = (data: DataFrame, panelID: number): void => {
  const snapshot: DataFrameJSON[] = [dataFrameToJSON(data)];
  const dashboard = getDashboardSrv().getCurrent();
  const panelModel = dashboard?.getPanelById(panelID);

  if (dashboard?.panelInEdit?.id === panelID) {
    dashboard?.events.publish({
      type: DatagridDataChangeEvent.type,
      payload: {
        snapshot,
      },
    });
  }

  const query: GrafanaQuery = {
    refId: 'A',
    queryType: GrafanaQueryType.Snapshot,
    snapshot,
    datasource: GRAFANA_DS,
  };

  panelModel!.updateQueries({
    dataSource: GRAFANA_DS,
    queries: [query],
  });

  panelModel!.refresh();
};
