import { cloneDeep } from 'lodash';

import { ArrayVector, DataFrame, DataQueryResponse, FieldType } from '@grafana/data';

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
      values: new ArrayVector([1645030244810, 1645030247027]),
    },
    {
      name: 'value',
      type: FieldType.string,
      config: {},
      values: new ArrayVector(['line1', 'line2']),
    },
    {
      name: 'labels',
      type: FieldType.string,
      config: {
        custom: {
          json: true,
        },
      },
      values: new ArrayVector(['{ "level": "info", "code": "41🌙" }', '{ "level": "error", "code": "41🌙" }']),
    },
    {
      name: 'tsNs',
      type: FieldType.string,
      config: {},
      values: new ArrayVector(['1645030244810757120', '1645030247027735040']),
    },
    {
      name: 'id',
      type: FieldType.string,
      config: {},
      values: new ArrayVector(['id1', 'id2']),
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
      custom: {
        lokiQueryStatKey: 'Summary: total bytes processed',
      },
    };
    expectedFrame.fields[3].type = FieldType.time;

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
