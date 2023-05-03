import { read, utils, WorkSheet, WorkBook, Range, ColInfo, CellObject, ExcelDataType } from 'xlsx';

import { DataFrame, FieldType } from '@grafana/data';

export function readSpreadsheet(file: ArrayBuffer): DataFrame[] {
  return workBookToFrames(read(file, { type: 'buffer' }));
}

export function workBookToFrames(wb: WorkBook): DataFrame[] {
  return wb.SheetNames.map((name) => workSheetToFrame(wb.Sheets[name], name));
}

export function workSheetToFrame(sheet: WorkSheet, name?: string): DataFrame {
  const columns = sheetAsColumns(sheet);
  if (!columns?.length) {
    return {
      fields: [],
      name: name,
      length: 0,
    };
  }

  return {
    fields: columns.map((c, idx) => {
      let type = FieldType.string;
      let values: unknown[] = [];
      switch (c.type ?? 's') {
        case 'b':
          type = FieldType.boolean;
          values = c.data.map((v) => (v?.v == null ? v?.v : Boolean(v.v)));
          break;

        case 'n':
          type = FieldType.number;
          values = c.data.map((v) => (v?.v == null ? v?.v : +v.v));
          break;

        case 'd':
          type = FieldType.time;
          values = c.data.map((v) => (v?.v == null ? v?.v : +v.v)); // ???
          break;

        default:
          type = FieldType.string;
          values = c.data.map((v) => (v?.v == null ? v?.v : utils.format_cell(v)));
          break;
      }

      return {
        name: c.name,
        config: {}, // TODO? we could apply decimal formatting from worksheet
        type,
        values,
      };
    }),
    name: name,
    length: columns[0].data.length,
  };
}

interface ColumnData {
  index: number;
  name: string;
  info?: ColInfo;
  data: CellObject[];
  type?: ExcelDataType;
}

function sheetAsColumns(sheet: WorkSheet): ColumnData[] | null {
  const r = sheet['!ref'];
  if (!r) {
    return null;
  }
  const columnInfo = sheet['!cols'];
  const cols: ColumnData[] = [];
  const range = safe_decode_range(r);
  const types = new Set<ExcelDataType>();
  let firstRowIsHeader = true;

  for (let c = range.s.c; c <= range.e.c; ++c) {
    types.clear();
    const info = columnInfo?.[c] ?? {};
    if (info.hidden) {
      continue; // skip the column
    }
    const field: ColumnData = {
      index: c,
      name: utils.encode_col(c),
      data: [],
      info,
    };
    const pfix = utils.encode_col(c);
    for (let r = range.s.r; r <= range.e.r; ++r) {
      const cell = sheet[pfix + utils.encode_row(r)];
      if (cell) {
        if (field.data.length) {
          types.add(cell.t);
        } else if (cell.t !== 's') {
          firstRowIsHeader = false;
        }
      }
      field.data.push(cell);
    }
    cols.push(field);
    if (types.size === 1) {
      field.type = Array.from(types)[0];
    }
  }

  if (firstRowIsHeader) {
    return cols.map((c) => {
      const first = c.data[0];
      if (first?.v) {
        c.name = utils.format_cell(first);
      }
      c.data = c.data.slice(1);
      return c;
    });
  }
  return cols;
}

/**
 * Copied from Apache 2 licensed sheetjs:
 * https://git.sheetjs.com/sheetjs/sheetjs/src/branch/master/xlsx.flow.js#L4338
 */
function safe_decode_range(range: string): Range {
  let o = { s: { c: 0, r: 0 }, e: { c: 0, r: 0 } };
  let idx = 0,
    i = 0,
    cc = 0;
  let len = range.length;
  for (idx = 0; i < len; ++i) {
    if ((cc = range.charCodeAt(i) - 64) < 1 || cc > 26) {
      break;
    }
    idx = 26 * idx + cc;
  }
  o.s.c = --idx;

  for (idx = 0; i < len; ++i) {
    if ((cc = range.charCodeAt(i) - 48) < 0 || cc > 9) {
      break;
    }
    idx = 10 * idx + cc;
  }
  o.s.r = --idx;

  if (i === len || cc !== 10) {
    o.e.c = o.s.c;
    o.e.r = o.s.r;
    return o;
  }
  ++i;

  for (idx = 0; i !== len; ++i) {
    if ((cc = range.charCodeAt(i) - 64) < 1 || cc > 26) {
      break;
    }
    idx = 26 * idx + cc;
  }
  o.e.c = --idx;

  for (idx = 0; i !== len; ++i) {
    if ((cc = range.charCodeAt(i) - 48) < 0 || cc > 9) {
      break;
    }
    idx = 10 * idx + cc;
  }
  o.e.r = --idx;
  return o;
}
