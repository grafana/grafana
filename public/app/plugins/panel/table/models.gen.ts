//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// NOTE: This file will be auto generated from models.cue
// It is currenty hand written but will serve as the target for cuetsy
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

import { TableCellDisplayMode, TableSortByFieldState, TableFooterCalc } from '@grafana/ui';
import { TableFieldOptions } from '@grafana/schema';

// Only the latest schema version is translated to TypeScript, on the premise
// that either the dashboard loading process, or (eventually) CUE-defined
// migrations ensure that bulk of the frontend application only ever
// need directly consider the most recent version of the schema.
export const modelVersion = Object.freeze([1, 0]);

export interface PanelOptions {
  frameIndex: number;
  showHeader: boolean;
  showTypeIcons?: boolean;
  sortBy?: TableSortByFieldState[];
  footer?: TableFooterCalc; // TODO: should be array (options builder is limited)
}

export const defaultPanelOptions: PanelOptions = {
  frameIndex: 0,
  showHeader: true,
  showTypeIcons: false,
  footer: {
    show: false,
    reducer: [],
  },
};

export const defaultPanelFieldConfig: TableFieldOptions = {
  displayMode: TableCellDisplayMode.Auto,
  align: 'auto',
  inspect: false,
};
