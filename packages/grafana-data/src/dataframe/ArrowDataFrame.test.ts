import fs from 'fs';
import path from 'path';

import { grafanaDataFrameToArrowTable, arrowTableToDataFrame } from './ArrowDataFrame';
import { toDataFrameDTO, toDataFrame } from './processDataFrame';
import { FieldType } from '../types';
import { Table } from 'apache-arrow';

describe('Read/Write arrow Table to DataFrame', () => {
  test('should parse output with dataframe', () => {
    const frame = toDataFrame({
      name: 'Hello',
      refId: 'XYZ',
      meta: {
        aaa: 'xyz',
        anything: 'xxx',
      },
      fields: [
        { name: 'time', config: {}, type: FieldType.time, values: [1, 2, 3] },
        { name: 'value', config: { min: 0, max: 50, unit: 'somthing' }, type: FieldType.number, values: [1, 2, 3] },
        { name: 'str', config: {}, type: FieldType.string, values: ['a', 'b', 'c'] },
      ],
    });

    const table = grafanaDataFrameToArrowTable(frame);
    expect(table.length).toEqual(frame.length);

    // Now back to DataFrame
    const before = JSON.stringify(toDataFrameDTO(frame), null, 2);
    const after = JSON.stringify(toDataFrameDTO(arrowTableToDataFrame(table)), null, 2);
    expect(after).toEqual(before);
  });

  test('should support duplicate field names', () => {
    const frame = toDataFrame({
      name: 'Hello',
      refId: 'XYZ',
      fields: [
        { name: 'time', config: {}, type: FieldType.time, values: [1, 2, 3] },
        { name: 'a', values: [1, 2, 3] },
        { name: 'a', values: ['a', 'b', 'c'] },
      ],
    });

    const table = grafanaDataFrameToArrowTable(frame);
    expect(table.length).toEqual(frame.length);

    // Now back to DataFrame
    const before = JSON.stringify(toDataFrameDTO(frame), null, 2);
    const after = JSON.stringify(toDataFrameDTO(arrowTableToDataFrame(table)), null, 2);
    expect(after).toEqual(before);
  });

  test('should read all types', () => {
    const fullpath = path.resolve(__dirname, './__snapshots__/all_types.golden.arrow');
    const arrow = fs.readFileSync(fullpath);
    const table = Table.from([arrow]);
    const frame = arrowTableToDataFrame(table);
    expect(toDataFrameDTO(frame)).toMatchSnapshot();
  });
});
