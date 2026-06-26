import { DataFrame, DataFrameType, FieldType } from '@grafana/data';

export function getMockFrames() {
  const logFrameA: DataFrame = {
    refId: 'A',
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {},
        values: [3, 4],
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
          {
            label: 'value',
          },
          {
            otherLabel: 'other value',
          },
        ],
      },
      {
        name: 'tsNs',
        type: FieldType.string,
        config: {},
        values: ['3000000', '4000000'],
      },
      {
        name: 'id',
        type: FieldType.string,
        config: {},
        values: ['id1', 'id2'],
      },
    ],
    meta: {
      custom: {
        frameType: 'LabeledTimeValues',
      },
      stats: [
        { displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 11 },
        { displayName: 'Ingester: total reached', value: 1 },
      ],
    },
    length: 2,
  };

  const logFrameB: DataFrame = {
    refId: 'A',
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {},
        values: [1, 2],
      },
      {
        name: 'Line',
        type: FieldType.string,
        config: {},
        values: ['line3', 'line4'],
      },
      {
        name: 'labels',
        type: FieldType.other,
        config: {},
        values: [
          {
            otherLabel: 'other value',
          },
        ],
      },
      {
        name: 'tsNs',
        type: FieldType.string,
        config: {},
        values: ['1000000', '2000000'],
      },
      {
        name: 'id',
        type: FieldType.string,
        config: {},
        values: ['id3', 'id4'],
      },
    ],
    meta: {
      custom: {
        frameType: 'LabeledTimeValues',
      },
      stats: [
        { displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 22 },
        { displayName: 'Ingester: total reached', value: 2 },
      ],
    },
    length: 2,
  };

  const logFrameAB: DataFrame = {
    refId: 'A',
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {},
        values: [1, 2, 3, 4],
      },
      {
        name: 'Line',
        type: FieldType.string,
        config: {},
        values: ['line3', 'line4', 'line1', 'line2'],
      },
      {
        name: 'labels',
        type: FieldType.other,
        config: {},
        values: [
          {
            otherLabel: 'other value',
          },
          undefined,
          {
            label: 'value',
          },
          {
            otherLabel: 'other value',
          },
        ],
      },
      {
        name: 'tsNs',
        type: FieldType.string,
        config: {},
        values: ['1000000', '2000000', '3000000', '4000000'],
      },
      {
        name: 'id',
        type: FieldType.string,
        config: {},
        values: ['id3', 'id4', 'id1', 'id2'],
      },
    ],
    meta: {
      custom: {
        frameType: 'LabeledTimeValues',
      },
      stats: [
        {
          displayName: 'Summary: total bytes processed',
          unit: 'decbytes',
          value: 22,
        },
      ],
    },
    length: 4,
  };

  const metricFrameA: DataFrame = {
    refId: 'A',
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {},
        values: [3000000, 4000000],
      },
      {
        name: 'Value',
        type: FieldType.number,
        config: {},
        values: [5, 4],
        labels: {
          level: 'debug',
        },
      },
    ],
    meta: {
      type: DataFrameType.TimeSeriesMulti,
      stats: [
        { displayName: 'Ingester: total reached', value: 1 },
        { displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 11 },
      ],
    },
    length: 2,
  };

  const metricFrameB: DataFrame = {
    refId: 'A',
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {},
        values: [1000000, 2000000],
      },
      {
        name: 'Value',
        type: FieldType.number,
        config: {},
        values: [6, 7],
        labels: {
          level: 'debug',
        },
      },
    ],
    meta: {
      type: DataFrameType.TimeSeriesMulti,
      stats: [
        { displayName: 'Ingester: total reached', value: 2 },
        { displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 22 },
      ],
    },
    length: 2,
  };

  const metricFrameC: DataFrame = {
    refId: 'A',
    name: 'some-time-series',
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {},
        values: [3000000, 4000000],
      },
      {
        name: 'Value',
        type: FieldType.number,
        config: {},
        values: [6, 7],
        labels: {
          level: 'error',
        },
      },
    ],
    meta: {
      type: DataFrameType.TimeSeriesMulti,
      stats: [
        { displayName: 'Ingester: total reached', value: 2 },
        { displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 33 },
      ],
    },
    length: 2,
  };

  const emptyFrame: DataFrame = {
    refId: 'A',
    fields: [
      {
        name: 'Time',
        type: FieldType.time,
        config: {},
        values: [],
      },
      {
        name: 'Line',
        type: FieldType.string,
        config: {},
        values: [],
      },
      {
        name: 'labels',
        type: FieldType.other,
        config: {},
        values: [],
      },
      {
        name: 'tsNs',
        type: FieldType.string,
        config: {},
        values: [],
      },
      {
        name: 'id',
        type: FieldType.string,
        config: {},
        values: [],
      },
    ],
    meta: {
      custom: {
        frameType: 'LabeledTimeValues',
      },
      stats: [
        { displayName: 'Summary: total bytes processed', unit: 'decbytes', value: 0 },
        { displayName: 'Ingester: total reached', value: 0 },
      ],
    },
    length: 2,
  };

  return {
    logFrameA,
    logFrameB,
    logFrameAB,
    metricFrameA,
    metricFrameB,
    metricFrameC,
    emptyFrame,
  };
}
