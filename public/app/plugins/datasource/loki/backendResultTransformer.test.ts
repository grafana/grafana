import { cloneDeep } from 'lodash';

import { DataFrame, DataQueryResponse, Field, FieldType } from '@grafana/data';

import { transformBackendResult } from './backendResultTransformer';

// needed because the derived-fields functionality calls it
jest.mock('@grafana/runtime', () => ({
  // @ts-ignore
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => {
    return {
      getInstanceSettings: () => {
        return { name: 'Loki1' };
      },
    };
  },
}));

const LOKI_EXPR = '{level="info"} |= "thing1"';
const inputFrame: DataFrame = {
  refId: 'A',
  meta: {
    executedQueryString: LOKI_EXPR,
    custom: {
      frameType: 'LabeledTimeValues',
    },
  },
  fields: [
    {
      name: 'Time',
      type: FieldType.time,
      config: {},
      values: [1645030244810, 1645030247027],
    },
    {
      name: 'Line',
      type: FieldType.string,
      config: {},
      values: ['line1', 'line2'],
    },
    {
      name: 'labels',
      type: FieldType.other,
      config: {},
      values: [
        { level: 'info', code: '41🌙' },
        { level: 'error', code: '41🌙' },
      ],
    },
    {
      name: 'tsNs',
      type: FieldType.string,
      config: {},
      values: ['1645030244810757120', '1645030247027735040'],
    },
    {
      name: 'id',
      type: FieldType.string,
      config: {},
      values: ['id1', 'id2'],
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
        ...expectedFrame.meta?.custom,
        lokiQueryStatKey: 'Summary: total bytes processed',
      },
    };

    const expected: DataQueryResponse = { data: [expectedFrame] };

    const result = transformBackendResult(
      response,
      [
        {
          refId: 'A',
          expr: LOKI_EXPR,
        },
      ],
      []
    );
    expect(result).toEqual(expected);
  });

  it('applies maxLines correctly', () => {
    const response: DataQueryResponse = { data: [cloneDeep(inputFrame)] };

    const frame1: DataFrame = transformBackendResult(
      response,
      [
        {
          refId: 'A',
          expr: LOKI_EXPR,
        },
      ],
      []
    ).data[0];

    expect(frame1.meta?.limit).toBeUndefined();

    const frame2 = transformBackendResult(
      response,
      [
        {
          refId: 'A',
          expr: LOKI_EXPR,
          maxLines: 42,
        },
      ],
      []
    ).data[0];

    expect(frame2.meta?.limit).toBe(42);
  });

  it('processed derived fields correctly', () => {
    const input: DataFrame = {
      length: 1,
      fields: [
        {
          name: 'time',
          config: {},
          values: [1],
          type: FieldType.time,
        },
        {
          name: 'line',
          config: {},
          values: ['line1'],
          type: FieldType.string,
        },
      ],
    };
    const response: DataQueryResponse = { data: [input] };
    const result = transformBackendResult(
      response,
      [{ refId: 'A', expr: '' }],
      [
        {
          matcherRegex: 'trace=(w+)',
          name: 'derived1',
          url: 'example.com',
        },
      ]
    );

    expect(
      result.data[0].fields.filter((field: Field) => field.name === 'derived1' && field.type === 'string').length
    ).toBe(1);
  });

  it('handle loki parsing errors', () => {
    const clonedFrame = cloneDeep(inputFrame);
    clonedFrame.fields[2] = {
      name: 'labels',
      type: FieldType.string,
      config: {},
      values: [
        { level: 'info', code: '41🌙', __error__: 'LogfmtParserErr' },
        { level: 'error', code: '41🌙' },
      ],
    };
    const response: DataQueryResponse = { data: [clonedFrame] };

    const result = transformBackendResult(
      response,
      [
        {
          refId: 'A',
          expr: LOKI_EXPR,
        },
      ],
      []
    );
    expect(result.data[0]?.meta?.custom?.error).toBe('Error when parsing some of the logs');
  });

  it('improve loki escaping error message when query contains escape', () => {
    const response: DataQueryResponse = {
      data: [],
      error: {
        refId: 'A',
        message: 'parse error at line 1, col 2: invalid char escape',
      },
    };

    const result = transformBackendResult(
      response,
      [
        {
          refId: 'A',
          expr: '{place="g\\arden"}',
        },
      ],
      []
    );
    expect(result.error?.message).toBe(
      `parse error at line 1, col 2: invalid char escape. Make sure that all special characters are escaped with \\. For more information on escaping of special characters visit LogQL documentation at https://grafana.com/docs/loki/latest/logql/.`
    );
  });

  it('do not change loki escaping error message when query does not contain escape', () => {
    const response: DataQueryResponse = {
      data: [],
      error: {
        refId: 'A',
        message: 'parse error at line 1, col 2: invalid char escape',
      },
    };

    const result = transformBackendResult(
      response,
      [
        {
          refId: 'A',
          expr: '{place="garden"}',
        },
      ],
      []
    );
    expect(result.error?.message).toBe('parse error at line 1, col 2: invalid char escape');
  });
});
