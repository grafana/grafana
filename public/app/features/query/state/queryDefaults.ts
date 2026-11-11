import { type DataQuery } from '@grafana/data';

export function createDefaultQuery(): DataQuery {
  return { refId: 'A' };
}
