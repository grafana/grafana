import _ from 'lodash';
import { DataQuery } from '@grafana/data';

export const getNextRefIdChar = (queries: DataQuery[]): string | undefined => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  return _.find(letters, refId => {
    return _.every(queries, other => {
      return other.refId !== refId;
    });
  });
};

export function addQuery(queries: DataQuery[], query?: Partial<DataQuery>): DataQuery[] {
  const q = query || {};
  q.refId = getNextRefIdChar(queries);
  return [...queries, q as DataQuery];
}
