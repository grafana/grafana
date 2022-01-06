import { ArrayVector } from '@grafana/data';

export const DEFAULT_TS = {
  name: 'ts',
  type: 'time',
  values: new ArrayVector([]),
  config: {
    displayName: 'Time',
  },
};

export const DEFAULT_LINE = {
  name: 'line',
  type: 'string',
  values: new ArrayVector([]),
  config: {},
};

export const DEFAULT_ID = {
  name: 'id',
  type: 'string',
  values: new ArrayVector([]),
  config: {},
};

export const DEFAULT_TS_NS = {
  name: 'tsNs',
  type: 'time',
  values: new ArrayVector([]),
  config: {
    displayName: 'Time ns',
  },
};
