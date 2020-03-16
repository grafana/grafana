import fs from 'fs';
import path from 'path';

import { resultsToDataFrames, grafanaDataFrameToArrowTable, arrowTableToDataFrame } from './ArrowDataFrame';
import { toDataFrameDTO, toDataFrame } from './processDataFrame';
import { FieldType } from '../types';
import { Table } from 'apache-arrow';

/* eslint-disable */
const resp = {
  results: {
    '': {
      refId: '',
      dataframes: [
        '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',
      ],
      series: [] as any[],
      tables: null as any,
      frames: null as any,
    },
  },
};
/* eslint-enable */

describe('GEL Utils', () => {
  test('should parse output with dataframe', () => {
    const frames = resultsToDataFrames(resp);
    for (const frame of frames) {
      console.log('Frame', frame.refId);
      for (const field of frame.fields) {
        console.log(' > ', field.name, field.labels);
        console.log(' (values)= ', field.values.toArray());
      }
    }

    const norm = frames.map(f => toDataFrameDTO(f));
    expect(norm).toMatchSnapshot();
  });

  test('processEmptyResults', () => {
    const frames = resultsToDataFrames({
      results: { '': { refId: '', meta: null, series: null, tables: null, dataframes: null } },
    });
    expect(frames.length).toEqual(0);
  });
});

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
