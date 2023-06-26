import { DataFrameDTO } from '@grafana/data';

export const flameGraphEmptyData: DataFrameDTO = {
  name: 'response',
  refId: 'A',
  // @ts-ignore
  meta: { preferredVisualisationType: 'flamegraph' },
  fields: [
    {
      name: 'level',
      values: [0],
    },
    {
      name: 'value',
      values: [0],
      config: {
        unit: 'short',
      },
    },
    {
      name: 'self',
      values: [0],
      config: {
        unit: 'short',
      },
    },
    {
      name: 'label',
      values: ['total'],
    },
  ],
};
