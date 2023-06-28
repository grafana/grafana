/* eslint-disable @typescript-eslint/no-explicit-any */
import XLSX from 'xlsx';

import { getFieldDisplayName } from '../field';
import { DataFrame, Field } from '../types';
import { formattedValueToString } from '../valueFormats';

type FieldWriter = (value: any) => any;

function writeValue(value: any): string {
  const str = value.toString();
  return str;
}

function writeDate(value: any): Date {
  return new Date(value);
}

function writeNumber(value: any): Number {
  return Number(value);
}

function makeFieldWriter(field: Field): FieldWriter {
  if (field.type === 'time' || (field.type === 'number' && field.config.unit === 'dateTimeAsIso')) {
    return (value: any) => writeDate(value);
  }

  if (field.config.unit === 'dateTimeAsIso') {
    return (value: any) => writeDate(value);
  }

  if (field.type === 'number') {
    return (value: any) => writeNumber(value);
  }

  if (field.display) {
    return (value: any) => {
      const displayValue = field.display!(value);
      return writeValue(formattedValueToString(displayValue));
    };
  }
  return (value: any) => writeValue(value);
}

export function toExcel(data: DataFrame[]): any {
  let array: string[][] = [];
  let headers = [];
  for (const series of data) {
    const { fields } = series;

    // ignore frames with no fields
    if (fields.length === 0) {
      continue;
    }

    const length = fields[0].values.length;

    if (length > 0) {
      const writers = fields.map((field) => makeFieldWriter(field));
      for (let i = 0; i < length; i++) {
        if (array[i] === undefined) {
          array.push([]);
        }
        for (let j = 0; j < fields.length; j++) {
          if (i === 0) {
            headers.push(getFieldDisplayName(fields[j], series));
          }

          const v = fields[j].values.get(i);
          if (v !== null) {
            array[i].push(writers[j](v));
          } else {
            // Null values should display empty cells
            array[i].push('');
          }
        }
      }
    }
  }

  array.unshift(headers);

  const ws = XLSX.utils.aoa_to_sheet(array, { dateNF: 'yyyy"-"mm"-"dd" "HH":"MM":"SS' });
  const wb = XLSX.utils.book_new();

  /**
   console.log(ws);
   const targetColumn = XLSX.utils.decode_col('A');
   const range = XLSX.utils.decode_range(ws['!ref']);
   for (let i = range.s.r + 1; i <= range.e.r; i += 1) {
    const ref = XLSX.utils.encode_cell({ r: i, c: targetColumn });
    if (!ws[ref]) {
      continue;
    }
    ws[ref].t = 'd';
  }
   */

  XLSX.utils.book_append_sheet(wb, ws, 'Grafana');

  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}
