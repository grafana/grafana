import { Property } from 'csstype';
import { clone, sampleSize } from 'lodash';
import memoize from 'micro-memoize';
import { HeaderGroup, Row } from 'react-table';
import tinycolor from 'tinycolor2';

import {
  DataFrame,
  DisplayValue,
  DisplayValueAlignmentFactors,
  Field,
  FieldConfigSource,
  fieldReducers,
  FieldType,
  formattedValueToString,
  getDisplayProcessor,
  getFieldDisplayName,
  GrafanaTheme2,
  isDataFrame,
  isDataFrameWithValue,
  isTimeSeriesFrame,
  reduceField,
  SelectableValue,
} from '@grafana/data';
import {
  BarGaugeDisplayMode,
  TableAutoCellOptions,
  TableCellBackgroundDisplayMode,
  TableCellDisplayMode,
} from '@grafana/schema';

import { getTextColorForAlphaBackground } from '../../utils';

import { ActionsCell } from './ActionsCell';
import { BarGaugeCell } from './BarGaugeCell';
import { DataLinksCell } from './DataLinksCell';
import { DefaultCell } from './DefaultCell';
import { getFooterValue } from './FooterRow';
import { GeoCell } from './GeoCell';
import { ImageCell } from './ImageCell';
import { JSONViewCell } from './JSONViewCell';
import { RowExpander } from './RowExpander';
import { SparklineCell } from './SparklineCell';
import { TableStyles } from './styles';
import {
  CellColors,
  CellComponent,
  FooterItem,
  GrafanaTableColumn,
  TableCellOptions,
  TableFieldOptions,
  TableFooterCalc,
} from './types';

export const EXPANDER_WIDTH = 50;

export function getTextAlign(field?: Field): Property.JustifyContent {
  if (!field) {
    return 'flex-start';
  }

  if (field.config.custom) {
    const custom: TableFieldOptions = field.config.custom;

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
      // @ts-expect-error
      // TODO fix type error here
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
    const fieldTableOptions: TableFieldOptions = field.config.custom || {};
    if (fieldTableOptions.hidden || field.type === FieldType.nestedFrames) {
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
        case FieldType.frame:
          return 'number';
        case FieldType.time:
          return 'basic';
        default:
          return 'alphanumeric-insensitive';
      }
    };

    const Cell = getCellComponent(fieldTableOptions.cellOptions?.type, field);
    columns.push({
      // @ts-expect-error
      // TODO fix type error here
      Cell,
      id: fieldIndex.toString(),
      field: field,
      Header: fieldTableOptions.hideHeader ? '' : getFieldDisplayName(field, data),
      accessor: (_row, i) => field.values[i],
      sortType: selectSortType(field.type),
      width: fieldTableOptions.width,
      minWidth: fieldTableOptions.minWidth ?? columnMinWidth,
      filter: memoize(filterByValue(field)),
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

export function getCellComponent(displayMode: TableCellDisplayMode, field: Field): CellComponent {
  switch (displayMode) {
    case TableCellDisplayMode.Custom:
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
    case TableCellDisplayMode.DataLinks:
      return DataLinksCell;
    case TableCellDisplayMode.Actions:
      return ActionsCell;
  }

  if (field.type === FieldType.geo) {
    return GeoCell;
  }

  if (field.type === FieldType.frame) {
    const firstValue = field.values[0];
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

  const fieldValue = field.values[row.index];
  const displayValue = field.display ? field.display(fieldValue) : fieldValue;
  const value = field.display ? formattedValueToString(displayValue) : displayValue;

  return value;
}

export function valuesToOptions(unique: Record<string, unknown>): SelectableValue[] {
  return Object.keys(unique)
    .reduce<SelectableValue[]>((all, key) => all.concat({ value: unique[key], label: key }), [])
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

export function sortCaseInsensitive(a: Row, b: Row, id: string) {
  return String(a.values[id]).localeCompare(String(b.values[id]), undefined, { sensitivity: 'base' });
}

// sortNumber needs to have great performance as it is called a lot
export function sortNumber(rowA: Row, rowB: Row, id: string) {
  const a = toNumber(rowA.values[id]);
  const b = toNumber(rowB.values[id]);
  return a === b ? 0 : a > b ? 1 : -1;
}

function toNumber(value: any): number {
  if (isDataFrameWithValue(value)) {
    return value.value ?? Number.NEGATIVE_INFINITY;
  }

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
      // Show the reducer in the first column
      if (i === 0 && options.reducer && options.reducer.length > 0) {
        const reducer = fieldReducers.get(options.reducer[0]);
        return reducer.name;
      }
      // Render an <EmptyCell />.
      return undefined;
    }

    let newField = clone(data.field);
    newField.values = values[data.id];
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
  // If we don't have anything to return then we display nothing
  const calc = reducer[0];
  if (calc === undefined) {
    return '';
  }

  // Calculate the reduction
  const format = field.display ?? getDisplayProcessor({ field, theme });
  const fieldCalcValue = reduceField({ field, reducers: reducer })[calc];

  // If the reducer preserves units then format the
  // end value with the field display processor
  const reducerInfo = fieldReducers.get(calc);
  if (reducerInfo.preservesUnits) {
    return formattedValueToString(format(fieldCalcValue));
  }

  // Otherwise we simply return the formatted string
  return formattedValueToString({ text: fieldCalcValue });
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

  return field.config.custom.cellOptions;
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
  if (missingIndex === -1 || columns[missingIndex]?.id === 'expander') {
    return;
  }

  // Splice in missing column
  columns.splice(missingIndex, 0, { id: String(missingIndex) });

  // Recurse
  addMissingColumnIndex(columns);
}

/**
 * Getting gauge or sparkline values to align is very tricky without looking at all values and passing them through display processor.
 * For very large tables that could pretty expensive. So this is kind of a compromise. We look at the first 1000 rows and cache the longest value.
 * If we have a cached value we just check if the current value is longer and update the alignmentFactor. This can obviously still lead to
 * unaligned gauges but it should a lot less common.
 **/
export function getAlignmentFactor(
  field: Field,
  displayValue: DisplayValue,
  rowIndex: number
): DisplayValueAlignmentFactors {
  let alignmentFactor = field.state?.alignmentFactors;

  if (alignmentFactor) {
    // check if current alignmentFactor is still the longest
    if (formattedValueToString(alignmentFactor).length < formattedValueToString(displayValue).length) {
      alignmentFactor = { ...displayValue };
      field.state!.alignmentFactors = alignmentFactor;
    }
    return alignmentFactor;
  } else {
    // look at the next 1000 rows
    alignmentFactor = { ...displayValue };
    const maxIndex = Math.min(field.values.length, rowIndex + 1000);

    for (let i = rowIndex + 1; i < maxIndex; i++) {
      const nextDisplayValue = field.display!(field.values[i]);
      if (formattedValueToString(alignmentFactor).length > formattedValueToString(nextDisplayValue).length) {
        alignmentFactor.text = displayValue.text;
      }
    }

    if (field.state) {
      field.state.alignmentFactors = alignmentFactor;
    } else {
      field.state = { alignmentFactors: alignmentFactor };
    }

    return alignmentFactor;
  }
}

// since the conversion from timeseries panel crosshair to time is pixel based, we need
// to set a threshold where the table row highlights when the crosshair is hovered over a certain point
// because multiple pixels (converted to times) may represent the same point/row in table
export function isPointTimeValAroundTableTimeVal(pointTime: number, rowTime: number, threshold: number) {
  return Math.abs(Math.floor(pointTime) - rowTime) < threshold;
}

// calculate the threshold for which we consider a point in a chart
// to match a row in a table based on a time value
export function calculateAroundPointThreshold(timeField: Field): number {
  let max = -Number.MAX_VALUE;
  let min = Number.MAX_VALUE;

  if (timeField.values.length < 2) {
    return 0;
  }

  for (let i = 0; i < timeField.values.length; i++) {
    const value = timeField.values[i];
    if (value > max) {
      max = value;
    }
    if (value < min) {
      min = value;
    }
  }

  return (max - min) / timeField.values.length;
}

/**
 * Retrieve colors for a table cell (or table row).
 *
 * @param tableStyles
 *  Styles for the table
 * @param cellOptions
 *  Table cell configuration options
 * @param displayValue
 *  The value that will be displayed
 * @returns CellColors
 */
export function getCellColors(
  tableStyles: TableStyles,
  cellOptions: TableCellOptions,
  displayValue: DisplayValue
): CellColors {
  // How much to darken elements depends upon if we're in dark mode
  const darkeningFactor = tableStyles.theme.isDark ? 1 : -0.7;

  // Setup color variables
  let textColor: string | undefined = undefined;
  let bgColor: string | undefined = undefined;
  let bgHoverColor: string | undefined = undefined;

  if (cellOptions.type === TableCellDisplayMode.ColorText) {
    textColor = displayValue.color;
  } else if (cellOptions.type === TableCellDisplayMode.ColorBackground) {
    const mode = cellOptions.mode ?? TableCellBackgroundDisplayMode.Gradient;

    if (mode === TableCellBackgroundDisplayMode.Basic) {
      textColor = getTextColorForAlphaBackground(displayValue.color!, tableStyles.theme.isDark);
      bgColor = tinycolor(displayValue.color).toRgbString();
      bgHoverColor = tinycolor(displayValue.color).setAlpha(1).toRgbString();
    } else if (mode === TableCellBackgroundDisplayMode.Gradient) {
      const hoverColor = tinycolor(displayValue.color).setAlpha(1).toRgbString();
      const bgColor2 = tinycolor(displayValue.color)
        .darken(10 * darkeningFactor)
        .spin(5);
      textColor = getTextColorForAlphaBackground(displayValue.color!, tableStyles.theme.isDark);
      bgColor = `linear-gradient(120deg, ${bgColor2.toRgbString()}, ${displayValue.color})`;
      bgHoverColor = `linear-gradient(120deg, ${bgColor2.setAlpha(1).toRgbString()}, ${hoverColor})`;
    }
  }

  return { textColor, bgColor, bgHoverColor };
}

/**
 * Calculate an estimated bounding box for a block
 * of text using an offscreen canvas.
 */
export function guessTextBoundingBox(
  text: string,
  headerGroup: HeaderGroup,
  osContext: OffscreenCanvasRenderingContext2D | null,
  lineHeight: number,
  defaultRowHeight: number,
  padding = 0
) {
  const width = Number(headerGroup?.width ?? 300);
  const LINE_SCALE_FACTOR = 1.17;
  const LOW_LINE_PAD = 42;
  const PADDING = padding * 2;

  if (osContext !== null && typeof text === 'string') {
    const words = text.split(/\s/);
    const lines = [];
    let currentLine = '';
    let wordCount = 0;
    let extraLines = 0;

    // Let's just wrap the lines and see how well the measurement works
    for (let i = 0; i < words.length; i++) {
      const currentWord = words[i];
      let lineWidth = osContext.measureText(currentLine + ' ' + currentWord).width;

      if (lineWidth < width - PADDING) {
        currentLine += ' ' + currentWord;
        wordCount++;
      } else {
        lines.push({
          width: lineWidth,
          line: currentLine,
        });

        currentLine = currentWord;
        wordCount = 0;
      }
    }

    // We can have extra long strings, for these
    // we estimate if it overshoots the line by
    // at least one other line
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].width > width) {
        let extra = Math.floor(lines[i].width / width) - 1;
        extraLines += extra;
      }
    }

    // Estimated height would be lines multiplied
    // by the line height
    let lineNumber = lines.length + extraLines;
    let height = 38;
    if (lineNumber > 5) {
      height = lineNumber * lineHeight * LINE_SCALE_FACTOR;
    } else {
      height = lineNumber * lineHeight + LOW_LINE_PAD;
    }
    height += PADDING;

    return { width, height };
  }

  return { width, height: defaultRowHeight };
}

/**
 * A function to guess at which field has the longest text.
 * To do this we either select a single record if there aren't many records
 * or we select records at random and sample their size.
 */
export function guessLongestField(fieldConfig: FieldConfigSource, data: DataFrame) {
  let longestField = undefined;
  const SAMPLE_SIZE = 3;

  // If the default field option is set to allow text wrapping
  // we determine the field to wrap text with here and then
  // pass it to the RowsList
  if (fieldConfig.defaults.custom?.cellOptions?.wrapText) {
    const stringFields = data.fields.filter((field: Field) => field.type === FieldType.string);

    if (stringFields.length >= 1 && stringFields[0].values.length > 0) {
      const numValues = stringFields[0].values.length;
      let longestLength = 0;

      // If we have less than 30 values we assume
      // that the first record is representative
      // of the overall data
      if (numValues <= 30) {
        for (const field of stringFields) {
          const fieldLength = field.values[0].length;
          if (fieldLength > longestLength) {
            longestLength = fieldLength;
            longestField = field;
          }
        }
      }
      // Otherwise we randomly sample SAMPLE_SIZE values and take
      // the mean length
      else {
        for (const field of stringFields) {
          // This could result in duplicate values but
          // that should be fairly unlikely. This could potentially
          // be improved using a Set datastructure but
          // going to leave that one as an exercise for
          // the reader to contemplate and possibly code
          const vals = sampleSize(field.values, SAMPLE_SIZE);
          const meanLength = (vals[0]?.length + vals[1]?.length + vals[2]?.length) / 3;

          if (meanLength > longestLength) {
            longestLength = meanLength;
            longestField = field;
          }
        }
      }
    }
  }

  return longestField;
}
