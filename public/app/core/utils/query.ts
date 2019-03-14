import _ from 'lodash';
import { DataQuery } from '@grafana/ui/';

export const getNextQueryLetter = (queries: DataQuery[]): string => {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  return _.find(letters, refId => {
    return _.every(queries, other => {
      return other.refId !== refId;
    });
  });
};
