import { dateTime, type Field, FieldType, type TimeRange, toDataFrame } from '@grafana/data';

const fields: Field[] = [
  {
    name: 'time',
    type: FieldType.time,
    config: {},
    values: [1655838068000, 1655838068050, 1655838068100, 1655838068150],
  },
  {
    name: '0',
    type: FieldType.number,
    config: {
      custom: {
        type: 'linear',
      },
    },
    values: [51, 72, 57, 11],
  },
  {
    name: '10',
    type: FieldType.number,
    config: {
      custom: {
        type: 'linear',
      },
    },
    values: [10, 73, 79, 55],
  },
  {
    name: '20',
    type: FieldType.number,
    config: {
      custom: {
        type: 'linear',
      },
    },
    values: [73, 60, 24, 72],
  },
  {
    name: '30',
    type: FieldType.number,
    config: {
      custom: {
        type: 'linear',
      },
    },
    values: [43, 56, 96, 82],
  },
  {
    name: '40',
    type: FieldType.number,
    config: {
      custom: {
        type: 'linear',
      },
    },
    values: [20, 34, 96, 4],
  },
  {
    name: '50',
    type: FieldType.number,
    config: {
      custom: {
        type: 'linear',
      },
    },
    values: [88, 89, 80, 12],
  },
  {
    name: '60',
    type: FieldType.number,
    config: {
      custom: {
        type: 'linear',
      },
    },
    values: [8, 60, 52, 59],
  },
  {
    name: '70',
    type: FieldType.number,
    config: {
      custom: {
        type: 'linear',
      },
    },
    values: [96, 22, 30, 19],
  },
  {
    name: '80',
    type: FieldType.number,
    config: {
      custom: {
        type: 'linear',
      },
    },
    values: [63, 95, 98, 12],
  },
  {
    name: '90',
    type: FieldType.number,
    config: {
      custom: {
        type: 'linear',
      },
    },
    values: [93, 33, 44, 17],
  },
];

export const LinearBucketData = toDataFrame({ fields });
export const LinearBucketTimeRange: TimeRange = {
  from: dateTime(1655838068000),
  to: dateTime(1655838069000),
  raw: {
    from: 'now',
    to: 'now-5m',
  },
};
