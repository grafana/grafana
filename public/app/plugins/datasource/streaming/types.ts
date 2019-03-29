import { DataQuery } from '@grafana/ui';

export enum StreamingMethod {
  fetch = 'fetch',
  random = 'random',
  //  websocket = 'websocket',
}

export interface StreamingQuery extends DataQuery {
  method: StreamingMethod;
  throttle: number; // Min 50ms
}
