import { type DataQuery } from '@grafana/schema';
import { type LokiQuery } from 'app/features/loki-helpers/types';

export const isLokiQuery = (query: DataQuery): query is LokiQuery => {
  if (!query) {
    return false;
  }

  return 'expr' in query && query.expr !== undefined;
};
