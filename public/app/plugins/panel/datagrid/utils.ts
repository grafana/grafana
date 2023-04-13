import { CompactSelection, GridCell, GridCellKind } from '@glideapps/glide-data-grid';

import {
  ArrayVector,
  DataFrame,
  DataFrameJSON,
  dataFrameToJSON,
  DatagridDataChangeEvent,
  MutableDataFrame,
  Field,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { GrafanaQuery, GrafanaQueryType } from 'app/plugins/datasource/grafana/types';

const ICON_AND_MENU_WIDTH = 65;
const CELL_PADDING = 20;
const MAX_COLUMN_WIDTH = 300;
const HEADER_FONT_FAMILY = '600 13px Inter';
const CELL_FONT_FAMILY = '400 13px Inter';
const TEXT_CANVAS = document.createElement('canvas');

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
};

export const RIGHT_ELEMENT_PROPS = {
  fill: true,
  sticky: false,
};

export interface DatagridContextMenuData {
  x?: number;
  y?: number;
  column?: number;
  row?: number;
  isHeaderMenu?: boolean;
  isContextMenuOpen: boolean;
}

export interface RenameColumnInputData {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  isInputOpen: boolean;
  inputValue?: string;
  columnIdx?: number;
}

interface CellRange {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const getTextWidth = (text: string, isHeader = false): number => {
  const context = TEXT_CANVAS.getContext('2d');
  context!.font = isHeader ? HEADER_FONT_FAMILY : CELL_FONT_FAMILY;
  const metrics = context!.measureText(text);
  return metrics.width;
};

export const getCellWidth = (field: Field): number => {
  //If header is longer than cell text, get header width that will always fully show the header text
  //otherwise get the longest cell text width if it's shorter than the max column width, or the max column width
  return Math.max(
    getTextWidth(field.name, true) + ICON_AND_MENU_WIDTH, //header text
    Math.min(
      MAX_COLUMN_WIDTH,
      field.values.toArray().reduce((acc: number, val: string | number) => {
        const textWidth = getTextWidth(val?.toString() ?? '');

        if (textWidth > acc) {
          return textWidth;
        }

        return acc;
      }, 0) + CELL_PADDING //cell text
    )
  );
};

export const deleteRows = (gridData: DataFrame, rows: number[], hardDelete = false): DataFrame => {
  for (const field of gridData.fields) {
    const valuesArray = field.values.toArray();

    //delete from the end of the array to avoid index shifting
    for (let i = rows.length - 1; i >= 0; i--) {
      if (hardDelete) {
        valuesArray.splice(rows[i], 1);
      } else {
        valuesArray.splice(rows[i], 1, null);
      }
    }

    field.values = new ArrayVector(valuesArray);
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

export const isDatagridEditEnabled = () => {
  return config.featureToggles.enableDatagridEditing;
};

//Converting an array of nulls or undefineds returns them as strings and prints them in the cells instead of empty cells. Thus the cleanup func
export const cleanStringFieldAfterConversion = (field: Field): void => {
  const valuesArray = field.values.toArray();
  field.values = new ArrayVector(valuesArray.map((val) => (val === 'undefined' || val === 'null' ? null : val)));
  return;
};
