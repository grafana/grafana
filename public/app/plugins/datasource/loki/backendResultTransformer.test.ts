import { ArrayVector, DataFrame, DataQueryResponse, FieldType } from '@grafana/data';
import { cloneDeep } from 'lodash';

import { transformBackendResult } from './backendResultTransformer';

const LOKI_EXPR = '{level="info"} |= "thing1"';
const inputFrame: DataFrame = {
  refId: 'A',
  meta: {
    executedQueryString: LOKI_EXPR,
  },
  fields: [
    {
      name: 'time',
      type: FieldType.time,
      config: {},
      values: new ArrayVector([1645030244810, 1645030247027, 1645030246277, 1645030245539, 1645030244091]),
    },
    {
      name: 'value',
      type: FieldType.string,
      config: {},
      values: new ArrayVector(['line1', 'line2', 'line3', 'line4', 'line5']),
    },
    {
      name: 'labels',
      type: FieldType.string,
      config: {},
      values: new ArrayVector([
        '{"level":"info", "code":"41"}',
        '{"level":"error", "code":"41"}',
        '{"level":"error", "code":"43"}',
        '{"level":"error", "code":"41"}',
        '{"level":"info", "code":"41"}',
      ]),
    },
    {
      name: 'tsNs',
      type: FieldType.other,
      config: {},
      values: new ArrayVector([
        '1645030244810757120',
        '1645030247027735040',
        '1645030246277587968',
        '1645030245539423744',
        '1645030244091700992',
      ]),
    },
    {
      name: 'id',
      type: FieldType.string,
      config: {},
      values: new ArrayVector(['id1', 'id2', 'id3', 'id4', 'id5']),
    },
  ],
  length: 5,
};

describe('loki backendResultTransformer', () => {
  it('processes a logs-dataframe correctly', () => {
    const response: DataQueryResponse = { data: [cloneDeep(inputFrame)] };

    const expectedFrame = cloneDeep(inputFrame);
    expectedFrame.meta = {
      ...expectedFrame.meta,
      preferredVisualisationType: 'logs',
      searchWords: ['thing1'],
    };
    expectedFrame.fields[2].type = FieldType.other;
    expectedFrame.fields[2].values = new ArrayVector([
      { level: 'info', code: '41' },
      { level: 'error', code: '41' },
      { level: 'error', code: '43' },
      { level: 'error', code: '41' },
      { level: 'info', code: '41' },
    ]);

    const expected: DataQueryResponse = { data: [expectedFrame] };

    const result = transformBackendResult(response, [
      {
        refId: 'A',
        expr: LOKI_EXPR,
      },
    ]);
    expect(result).toEqual(expected);
  });
});
