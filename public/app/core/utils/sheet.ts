import { read, utils } from 'xlsx';

import { ArrayDataFrame, DataFrame } from '@grafana/data';

export function readSpreadsheet(file: ArrayBuffer): DataFrame[] {
  const wb = read(file, { type: 'buffer' });
  return wb.SheetNames.map((name) => {
    const frame = new ArrayDataFrame(utils.sheet_to_json(wb.Sheets[name]));
    frame.name = name;
    return frame;
  });
}
