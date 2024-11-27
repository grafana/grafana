import {
  FieldType,
  Field,
  formattedValueToString,
  reduceField,
  GrafanaTheme2,
  FieldCalcs,
  FormattedValue,
} from '@grafana/data';

import { TableRow } from '../types';

export function getCellHeight(
  text: string,
  cellWidth: number, // width of the cell without padding
  osContext: OffscreenCanvasRenderingContext2D | null,
  lineHeight: number,
  defaultRowHeight: number,
  padding = 0
) {
  const PADDING = padding * 2;

  if (osContext !== null && typeof text === 'string') {
    const words = text.split(/\s/);
    const lines = [];
    let currentLine = '';

    // Let's just wrap the lines and see how well the measurement works
    for (let i = 0; i < words.length; i++) {
      const currentWord = words[i];
      // TODO: this method is not accurate
      let lineWidth = osContext.measureText(currentLine + ' ' + currentWord).width;

      // if line width is less than the cell width, add the word to the current line and continue
      // else add the current line to the lines array and start a new line with the current word
      if (lineWidth < cellWidth) {
        currentLine += ' ' + currentWord;
      } else {
        lines.push({
          width: lineWidth,
          line: currentLine,
        });

        currentLine = currentWord;
      }

      // if we are at the last word, add the current line to the lines array
      if (i === words.length - 1) {
        lines.push({
          width: lineWidth,
          line: currentLine,
        });
      }
    }

    if (lines.length === 1) {
      return defaultRowHeight;
    }

    // TODO: double padding to adjust osContext.measureText() results
    const height = lines.length * lineHeight + PADDING * 2;

    return height;
  }

  return defaultRowHeight;
}

export function getRowHeight(
  row: Record<string, string>,
  columnTypes: Record<string, string>,
  headerCellRefs: React.MutableRefObject<Record<string, HTMLDivElement>>,
  osContext: OffscreenCanvasRenderingContext2D | null,
  lineHeight: number,
  defaultRowHeight: number,
  padding: number,
  textWrap: boolean
): number {
  if (!textWrap) {
    return defaultRowHeight;
  }
  /**
   * 0. loop through all cells in row
   * 1. find text cell in row
   * 2. find width of text cell
   * 3. calculate height based on width and text length
   * 4. return biggest height
   */

  let biggestHeight = defaultRowHeight;

  for (const key in row) {
    if (isTextCell(key, columnTypes)) {
      if (Object.keys(headerCellRefs.current).length === 0 || !headerCellRefs.current[key]) {
        return biggestHeight;
      }
      const cellWidth = headerCellRefs.current[key].offsetWidth;
      const cellText = row[key];
      const newCellHeight = getCellHeight(cellText, cellWidth, osContext, lineHeight, defaultRowHeight, padding);

      if (newCellHeight > biggestHeight) {
        biggestHeight = newCellHeight;
      }
    }
  }

  return biggestHeight;
}

function isTextCell(key: string, columnTypes: Record<string, string>): boolean {
  return columnTypes[key] === FieldType.string;
}

export function shouldTextOverflow(
  key: string,
  row: Record<string, string>,
  columnTypes: Record<string, string>,
  headerCellRefs: React.MutableRefObject<Record<string, HTMLDivElement>>,
  osContext: OffscreenCanvasRenderingContext2D | null,
  lineHeight: number,
  defaultRowHeight: number,
  padding: number,
  textWrap: boolean
): boolean {
  if (textWrap) {
    return false;
  }

  if (isTextCell(key, columnTypes)) {
    const cellWidth = headerCellRefs.current[key].offsetWidth;
    const cellText = row[key];
    const newCellHeight = getCellHeight(cellText, cellWidth, osContext, lineHeight, defaultRowHeight, padding);

    if (newCellHeight > defaultRowHeight) {
      return true;
    }
  }

  return false;
}

export interface TableFooterCalc {
  show: boolean;
  reducer: string[]; // actually 1 value
  fields?: string[];
  enablePagination?: boolean;
  countRows?: boolean;
}

export function getFooterItemNG(
  rows: TableRow[],
  columnName: string,
  field: Field,
  options: TableFooterCalc | undefined,
  theme: GrafanaTheme2
): string {
  if (!options) {
    return '';
  }

  if (field.type !== FieldType.number) {
    return '';
  }

  const calc = options.reducer[0];
  if (calc === undefined) {
    return '';
  }

  let values = rows.map((row) => row[columnName]);

  // ...use above values array with reducer
  // const reducer = fieldReducers.get(options.reducer[0]);
  // console.log({ reducer });
  const value = reduceValues(field, values, options.reducer)[calc];

  // format reduced value to string using formatInfo (from field config)
  const formattedValue = valueToDisplayValue(value, field);
  // const formattedValue = getFormattedValue(field, options.reducer, theme);
  console.log({ formattedValue });

  return formattedValue;
}

export const valueToDisplayValue = (value: FormattedValue, field?: Field): string => {
  if (field?.display) {
    return formattedValueToString(field.display(value));
  }

  return formattedValueToString(value);
};

export function reduceValues(field: Field, values: number[], reducers: string[]): FieldCalcs {
  const wrappedField: Field = {
    ...field,
    values: values,
  };

  return reduceField({ field: wrappedField, reducers });
}
