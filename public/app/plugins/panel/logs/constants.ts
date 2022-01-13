import { ArrayVector } from '@grafana/data';

export const DEFAULT_TIME = {
  name: 'ts',
  type: 'time',
  values: new ArrayVector([]),
  config: {
    displayName: 'Time',
  },
};

export const DEFAULT_MESSAGE = {
  name: 'line',
  type: 'string',
  values: new ArrayVector([]),
  config: {},
};

export const DEFAULT_CONTAINER_ID = {
  name: 'id',
  type: 'string',
  values: new ArrayVector([]),
  config: {},
};

export const DEFAULT_HOSTNAME = {
  name: 'tsNs',
  type: 'time',
  values: new ArrayVector([]),
  config: {
    displayName: 'Time ns',
  },
};
