import { DataFrameDTO } from '@grafana/data';

export const data: DataFrameDTO = {
  name: 'response',
  refId: 'A',
  // @ts-ignore
  meta: { preferredVisualisationType: 'flamegraph' },
  fields: [
    {
      name: 'level',
      values: [0, 1, 2, 3, 2, 1],
    },
    {
      name: 'value',
      values: [10000, 5000, 4000, 3000, 500, 3000],
      config: {
        unit: 'ms',
      },
    },
    {
      name: 'self',
      values: [10000, 500, 1000, 3000, 500, 3000],
      config: {
        unit: 'ms',
      },
    },
    {
      name: 'label',
      values: ['total', 'fn_1', 'fn_2', 'fn_3', 'fn_4', 'fn_5'],
    },
  ],
};
