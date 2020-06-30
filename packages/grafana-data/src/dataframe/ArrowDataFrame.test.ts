import fs from 'fs';
import path from 'path';

import { grafanaDataFrameToArrowTable, arrowTableToDataFrame } from './ArrowDataFrame';
import { toDataFrameDTO, toDataFrame } from './processDataFrame';
import { FieldType, DataFrame } from '../types';
import { Table } from 'apache-arrow';
import { ArrayVector } from '../vector';

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
        { name: 'value', config: { min: 0, max: 50, unit: 'something' }, type: FieldType.number, values: [1, 2, 3] },
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

  test('Export arrow table names', () => {
    const simple: DataFrame = {
      name: 'hello',
      fields: [
        {
          name: 'fname',
          labels: {
            a: 'AAA',
            b: 'BBB',
          },
          config: {},
          type: FieldType.number,
          values: new ArrayVector([1, 2]),
        },
      ],
      length: 2,
    };
    const t1 = grafanaDataFrameToArrowTable(simple);
    const t2 = grafanaDataFrameToArrowTable(simple, true);
    expect(t1.getColumnAt(0)?.name).toEqual('fname {a="AAA", b="BBB"}');
    expect(t2.getColumnAt(0)?.name).toEqual('fname');
  });
});
