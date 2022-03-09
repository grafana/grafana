import { ArrayVector, CoreApp, DataFrame, DataQueryRequest, DataQueryResponse, FieldType, toUtc } from '@grafana/data';
import { cloneDeep } from 'lodash';

import { transformBackendResult } from './backendResultTransformer';
import { LokiQuery } from './types';

const frame: DataFrame = {
  name: 'frame1',
  refId: 'A',
  meta: {
    executedQueryString: 'something1',
  },
  fields: [
    {
      name: 'Time',
      type: FieldType.time,
      config: {},
      values: new ArrayVector([1645029699311, 1645029699312, 1645029699313]),
    },
    {
      name: 'Value',
      type: FieldType.string,
      labels: {
        level: 'error',
        location: 'moon',
        protocol: 'http',
      },
      config: {
        displayNameFromDS: '{level="error", location="moon", protocol="http"}',
      },
      values: new ArrayVector(['line1', 'line2', 'line3']),
    },
    {
      name: 'tsNs',
      type: FieldType.string,
      config: {},
      values: new ArrayVector(['1645029699311000500', '1645029699312000500', '1645029699313000500']),
    },
  ],
  length: 1,
};

function makeRequest(expr: string): DataQueryRequest<LokiQuery> {
  return {
    requestId: 'test1',
    interval: '1s',
    intervalMs: 1000,
    range: {
      from: toUtc('2022-02-22T13:14:15'),
      to: toUtc('2022-02-22T13:15:15'),
      raw: {
        from: toUtc('2022-02-22T13:14:15'),
        to: toUtc('2022-02-22T13:15:15'),
      },
    },
    scopedVars: {},
    targets: [
      {
        refId: 'A',
        expr,
      },
    ],
    timezone: 'UTC',
    app: CoreApp.Explore,
    startTime: 0,
  };
}

describe('loki backendResultTransformer', () => {
  it('processes a logs-dataframe correctly', () => {
    const response: DataQueryResponse = { data: [cloneDeep(frame)] };
    const request = makeRequest('{level="info"} |= "thing1"');

    const expectedFrame = cloneDeep(frame);
    expectedFrame.meta = {
      executedQueryString: 'something1',
      preferredVisualisationType: 'logs',
      searchWords: ['thing1'],
    };
    expectedFrame.fields[2].type = FieldType.time;

    const expected: DataQueryResponse = { data: [expectedFrame] };

    const result = transformBackendResult(response, request);
    expect(result).toEqual(expected);
  });
});
