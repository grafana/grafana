import { Property } from 'csstype';
import { clone } from 'lodash';
import memoizeOne from 'memoize-one';
import { Row } from 'react-table';

import {
  DataFrame,
  Field,
  FieldType,
  formattedValueToString,
  getFieldDisplayName,
  SelectableValue,
  fieldReducers,
  getDisplayProcessor,
  reduceField,
  GrafanaTheme2,
  ArrayVector,
  isDataFrame,
  isTimeSeriesFrame,
} from '@grafana/data';
import {
  BarGaugeDisplayMode,
  TableAutoCellOptions,
  TableCellBackgroundDisplayMode,
  TableCellOptions,
} from '@grafana/schema';

import { BarGaugeCell } from './BarGaugeCell';
import { DefaultCell } from './DefaultCell';
import { getFooterValue } from './FooterRow';
import { GeoCell } from './GeoCell';
import { ImageCell } from './ImageCell';
import { JSONViewCell } from './JSONViewCell';
import { RowExpander } from './RowExpander';
import { SparklineCell } from './SparklineCell';
import {
  CellComponent,
  TableCellDisplayMode,
  TableFieldOptions,
  FooterItem,
  GrafanaTableColumn,
  TableFooterCalc,
} from './types';

export const EXPANDER_WIDTH = 50;
export const OPTIONAL_ROW_NUMBER_COLUMN_WIDTH = 50;

export function getTextAlign(field?: Field): Property.JustifyContent {
  if (!field) {
    return 'flex-start';
  }

  if (field.config.custom) {
    const custom = field.config.custom as TableFieldOptions;

    switch (custom.align) {
      case 'right':
        return 'flex-end';
      case 'left':
        return 'flex-start';
      case 'center':
        return 'center';
    }
  }

  if (field.type === FieldType.number) {
    return 'flex-end';
  }

  return 'flex-start';
}

export function getColumns(
  data: DataFrame,
  availableWidth: number,
  columnMinWidth: number,
  expander: boolean,
  footerValues?: FooterItem[],
  isCountRowsSet?: boolean
): GrafanaTableColumn[] {
  const columns: GrafanaTableColumn[] = [];
  let fieldCountWithoutWidth = 0;

  if (expander) {
    columns.push({
      // Make an expander cell
      Header: () => null, // No header
      id: 'expander', // It needs an ID
      Cell: RowExpander,
      width: EXPANDER_WIDTH,
      minWidth: EXPANDER_WIDTH,
      filter: (_rows: Row[], _id: string, _filterValues?: SelectableValue[]) => {
        return [];
      },
      justifyContent: 'left',
      field: data.fields[0],
      sortType: 'basic',
    });

    availableWidth -= EXPANDER_WIDTH;
  }

  for (const [fieldIndex, field] of data.fields.entries()) {
    const fieldTableOptions = (field.config.custom || {}) as TableFieldOptions;
    if (fieldTableOptions.hidden) {
      continue;
    }

    if (fieldTableOptions.width) {
      availableWidth -= fieldTableOptions.width;
    } else {
      fieldCountWithoutWidth++;
    }

    const selectSortType = (type: FieldType) => {
      switch (type) {
        case FieldType.number:
          return 'number';
        case FieldType.time:
          return 'basic';
        default:
          return 'alphanumeric-insensitive';
      }
    };

    const Cell = getCellComponent(fieldTableOptions.cellOptions?.type, field);
    columns.push({
      Cell,
      id: fieldIndex.toString(),
      field: field,
      Header: getFieldDisplayName(field, data),
      accessor: (_row: any, i: number) => {
        return field.values.get(i);
      },
      sortType: selectSortType(field.type),
      width: fieldTableOptions.width,
      minWidth: fieldTableOptions.minWidth ?? columnMinWidth,
      filter: memoizeOne(filterByValue(field)),
      justifyContent: getTextAlign(field),
      Footer: getFooterValue(fieldIndex, footerValues, isCountRowsSet),
    });
  }

  // set columns that are at minimum width
  let sharedWidth = availableWidth / fieldCountWithoutWidth;
  for (let i = fieldCountWithoutWidth; i > 0; i--) {
    for (const column of columns) {
      if (!column.width && column.minWidth > sharedWidth) {
        column.width = column.minWidth;
        availableWidth -= column.width;
        fieldCountWithoutWidth -= 1;
        sharedWidth = availableWidth / fieldCountWithoutWidth;
      }
    }
  }

  // divide up the rest of the space
  for (const column of columns) {
    if (!column.width) {
      column.width = sharedWidth;
    }
    column.minWidth = 50;
  }

  return columns;
}

/*
  Build `Field` data for row numbers and prepend to the field array;
  this way, on other column's sort, the row numbers will persist in their proper place.
*/
export function buildFieldsForOptionalRowNums(totalRows: number): Field {
  return {
    ...defaultRowNumberColumnFieldData,
    values: buildBufferedEmptyValues(totalRows),
  };
}

/*
  This gives us an empty buffered ArrayVector of the desired length to match the table data.
  It is simply a data placeholder for the Row Number column data.
*/
export function buildBufferedEmptyValues(totalRows: number): ArrayVector<string> {
  return new ArrayVector(new Array(totalRows));
}

export function getCellComponent(displayMode: TableCellDisplayMode, field: Field): CellComponent {
  switch (displayMode) {
    case TableCellDisplayMode.ColorText:
    case TableCellDisplayMode.ColorBackground:
      return DefaultCell;
    case TableCellDisplayMode.Image:
      return ImageCell;
    case TableCellDisplayMode.Gauge:
      return BarGaugeCell;
    case TableCellDisplayMode.Sparkline:
      return SparklineCell;
    case TableCellDisplayMode.JSONView:
      return JSONViewCell;
  }

  if (field.type === FieldType.geo) {
    return GeoCell;
  }

  if (field.type === FieldType.frame) {
    const firstValue = field.values.get(0);
    if (isDataFrame(firstValue) && isTimeSeriesFrame(firstValue)) {
      return SparklineCell;
    }

    return JSONViewCell;
  }

  // Default or Auto
  if (field.type === FieldType.other) {
    return JSONViewCell;
  }

  return DefaultCell;
}

export function filterByValue(field?: Field) {
  return function (rows: Row[], id: string, filterValues?: SelectableValue[]) {
    if (rows.length === 0) {
      return rows;
    }

    if (!filterValues) {
      return rows;
    }

    if (!field) {
      return rows;
    }

    return rows.filter((row) => {
      if (!row.values.hasOwnProperty(id)) {
        return false;
      }
      const value = rowToFieldValue(row, field);
      return filterValues.find((filter) => filter.value === value) !== undefined;
    });
  };
}

export function calculateUniqueFieldValues(rows: any[], field?: Field) {
  if (!field || rows.length === 0) {
    return {};
  }

  const set: Record<string, string> = {};

  for (let index = 0; index < rows.length; index++) {
    const value = rowToFieldValue(rows[index], field);
    set[value || '(Blanks)'] = value;
  }

  return set;
}

export function rowToFieldValue(row: any, field?: Field): string {
  if (!field || !row) {
    return '';
  }

  const fieldValue = field.values.get(row.index);
  const displayValue = field.display ? field.display(fieldValue) : fieldValue;
  const value = field.display ? formattedValueToString(displayValue) : displayValue;

  return value;
}

export function valuesToOptions(unique: Record<string, any>): SelectableValue[] {
  return Object.keys(unique)
    .reduce((all, key) => all.concat({ value: unique[key], label: key }), [] as SelectableValue[])
    .sort(sortOptions);
}

export function sortOptions(a: SelectableValue, b: SelectableValue): number {
  if (a.label === undefined && b.label === undefined) {
    return 0;
  }

  if (a.label === undefined && b.label !== undefined) {
    return -1;
  }

  if (a.label !== undefined && b.label === undefined) {
    return 1;
  }

  if (a.label! < b.label!) {
    return -1;
  }

  if (a.label! > b.label!) {
    return 1;
  }

  return 0;
}

export function getFilteredOptions(options: SelectableValue[], filterValues?: SelectableValue[]): SelectableValue[] {
  if (!filterValues) {
    return [];
  }

  return options.filter((option) => filterValues.some((filtered) => filtered.value === option.value));
}

export function sortCaseInsensitive(a: Row<any>, b: Row<any>, id: string) {
  return String(a.values[id]).localeCompare(String(b.values[id]), undefined, { sensitivity: 'base' });
}

// sortNumber needs to have great performance as it is called a lot
export function sortNumber(rowA: Row<any>, rowB: Row<any>, id: string) {
  const a = toNumber(rowA.values[id]);
  const b = toNumber(rowB.values[id]);
  return a === b ? 0 : a > b ? 1 : -1;
}

function toNumber(value: any): number {
  if (value === null || value === undefined || value === '' || isNaN(value)) {
    return Number.NEGATIVE_INFINITY;
  }

  if (typeof value === 'number') {
    return value;
  }

  return Number(value);
}

export function getFooterItems(
  filterFields: Array<{ id: string; field?: Field } | undefined>,
  values: any[number],
  options: TableFooterCalc,
  theme2: GrafanaTheme2
): FooterItem[] {
  /*
    Here, `filterFields` is passed as the `headerGroups[0].headers` array
    that was destructured from the `useTable` hook. Unfortunately, since
    the `headerGroups` object is data based ONLY on the rendered "non-hidden"
    column headers, it will NOT include the Row Number column if it has been
    toggled off. This will shift the rendering of the footer left 1 column,
    creating an off-by-one issue. This is why we test for a `field.id` of "0".
    If the condition is truthy, the togglable Row Number column is being rendered,
    and we can proceed normally. If not, we must add the field data in its place
    so that the footer data renders in the expected column.
  */
  if (!filterFields.some((field) => field?.id === '0')) {
    const length = values.length;
    // Build the additional field that will correct the off-by-one footer issue.
    const fieldToAdd = { id: '0', field: buildFieldsForOptionalRowNums(length) };
    filterFields = [fieldToAdd, ...filterFields];
  }

  /*
    The FooterItems[] are calculated using both the `headerGroups[0].headers`
    (filterFields) and `rows` (values) destructured from the useTable() hook.
    This cacluation is based on the data from each index in `filterFields`
    array as well as the corresponding index in the `values` array.
    When the user hides a column through an override, the getColumns()
    hook is invoked, removes said hidden column, sends the updated column
    data to the useTable() hook, which then builds `headerGroups[0].headers`
    without the hidden column. However, it doesn't remove the hidden column
    from the `row` data, instead it substututes the hidden column row data
    with an `undefined` value. Therefore, the `row` array length never changes,
    despite the `headerGroups[0].headers` length changing at every column removal.
    This makes all footer reduce calculations AFTER the first hidden column
    in the `headerGroups[0].headers` break, since the indexing of both
    arrays is no longer in parity.

    So, here we simply recursively test for the "hidden" columns
    from `headerGroups[0].headers`. Each column has an ID property that corresponds
    to its own index, therefore if (`filterField.id` !== `String(index)`),
    we know there is one or more hidden columns; at which point we update
    the index with an ersatz placeholder with just an `id` property.
  */
  addMissingColumnIndex(filterFields);

  return filterFields.map((data, i) => {
    // Then test for numerical data - this will filter out placeholder `filterFields` as well.
    if (data?.field?.type !== FieldType.number) {
      // Show the reducer type ("Total", "Range", "Count", "Delta", etc) in the first non "Row Number" column, only if it cannot be numerically reduced.
      if (i === 1 && options.reducer && options.reducer.length > 0) {
        const reducer = fieldReducers.get(options.reducer[0]);
        return reducer.name;
      }
      // Render an <EmptyCell />.
      return undefined;
    }

    let newField = clone(data.field);
    newField.values = new ArrayVector(values[data.id]);
    newField.state = undefined;

    data.field = newField;

    if (options.fields && options.fields.length > 0) {
      const f = options.fields.find((f) => f === data?.field?.name);
      if (f) {
        return getFormattedValue(data.field, options.reducer, theme2);
      }
      return undefined;
    }
    return getFormattedValue(data.field, options.reducer || [], theme2);
  });
}

function getFormattedValue(field: Field, reducer: string[], theme: GrafanaTheme2) {
  const fmt = field.display ?? getDisplayProcessor({ field, theme });
  const calc = reducer[0];
  const v = reduceField({ field, reducers: reducer })[calc];
  return formattedValueToString(fmt(v));
}

// This strips the raw vales from the `rows` object.
export function createFooterCalculationValues(rows: Row[]): any[number] {
  const values: any[number] = [];

  for (const key in rows) {
    for (const [valKey, val] of Object.entries(rows[key].values)) {
      if (values[valKey] === undefined) {
        values[valKey] = [];
      }
      values[valKey].push(val);
    }
  }

  return values;
}

const defaultCellOptions: TableAutoCellOptions = { type: TableCellDisplayMode.Auto };

export function getCellOptions(field: Field): TableCellOptions {
  if (field.config.custom?.displayMode) {
    return migrateTableDisplayModeToCellOptions(field.config.custom?.displayMode);
  }

  if (!field.config.custom?.cellOptions) {
    return defaultCellOptions;
  }

  return (field.config.custom as TableFieldOptions).cellOptions;
}

/**
 * Migrates table cell display mode to new object format.
 *
 * @param displayMode The display mode of the cell
 * @returns TableCellOptions object in the correct format
 * relative to the old display mode.
 */
export function migrateTableDisplayModeToCellOptions(displayMode: TableCellDisplayMode): TableCellOptions {
  switch (displayMode) {
    // In the case of the gauge we move to a different option
    case 'basic':
    case 'gradient-gauge':
    case 'lcd-gauge':
      let gaugeMode = BarGaugeDisplayMode.Basic;

      if (displayMode === 'gradient-gauge') {
        gaugeMode = BarGaugeDisplayMode.Gradient;
      } else if (displayMode === 'lcd-gauge') {
        gaugeMode = BarGaugeDisplayMode.Lcd;
      }

      return {
        type: TableCellDisplayMode.Gauge,
        mode: gaugeMode,
      };
    // Also true in the case of the color background
    case 'color-background':
    case 'color-background-solid':
      let mode = TableCellBackgroundDisplayMode.Basic;

      // Set the new mode field, somewhat confusingly the
      // color-background mode is for gradient display
      if (displayMode === 'color-background') {
        mode = TableCellBackgroundDisplayMode.Gradient;
      }

      return {
        type: TableCellDisplayMode.ColorBackground,
        mode: mode,
      };
    default:
      return {
        // @ts-ignore
        type: displayMode,
      };
  }
}

/*
  For building the column data for the togglable Row Number field.
  `values` property is omitted, as it will be added at a later time.
*/
export const defaultRowNumberColumnFieldData: Omit<Field, 'values'> = {
  /*
    Single whitespace as value for `name` property so as to render an empty/invisible column header;
    without the single whitespace, falsey headers (empty strings) are given a default name of "Value".
  */
  name: ' ',
  display: function (value) {
    return {
      numeric: Number(value),
      text: value != null ? String(value) : '',
    };
  },
  type: FieldType.string,
  config: {
    color: { mode: 'thresholds' },
    custom: {
      align: 'auto',
      cellOptions: { type: 'auto' },
      inspect: false,
      width: OPTIONAL_ROW_NUMBER_COLUMN_WIDTH,
    },
  },
};

/**
 * This recurses through an array of `filterFields` (Array<{ id: string; field?: Field } | undefined>)
 * and adds back the missing indecies that are removed due to hiding a column through an panel override.
 * This is necessary to create Array.length parity between the `filterFields` array and the `values` array (any[number]),
 * since the footer value calculations are based on the corresponding index values of both arrays.
 *
 * @remarks
 * This function uses the splice() method, and therefore mutates the array.
 *
 * @param columns - An array of `filterFields` (Array<{ id: string; field?: Field } | undefined>).
 * @returns void; this function returns nothing; it only mutates values as a side effect.
 */
function addMissingColumnIndex(columns: Array<{ id: string; field?: Field } | undefined>): void {
  const missingIndex = columns.findIndex((field, index) => field?.id !== String(index));

  // Base case
  if (missingIndex === -1) {
    return;
  }

  // Splice in missing column
  columns.splice(missingIndex, 0, { id: String(missingIndex) });

  // Recurse
  addMissingColumnIndex(columns);
}
