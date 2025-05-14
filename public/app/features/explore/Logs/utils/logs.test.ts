import { DataQuery } from '@grafana/data';

import { canKeepDisplayedFields } from './logs';

describe('canKeepDisplayedFields', () => {
  test('Returns false when passing no queries', () => {
    expect(canKeepDisplayedFields(undefined, [])).toBe(false);
  });

  test('Returns false when some prev queries are undefined', () => {
    const logQueries: DataQuery[] = [{ refId: 'A' }, { refId: 'B' }];
    const prevLogQueries = [{ refId: 'C' }];
    expect(canKeepDisplayedFields(logQueries, prevLogQueries)).toBe(false);
  });

  test('Returns false when some new queries are undefined', () => {
    const logQueries: DataQuery[] = [{ refId: 'A' }];
    const prevLogQueries = [{ refId: 'C' }, { refId: 'B' }];
    expect(canKeepDisplayedFields(logQueries, prevLogQueries)).toBe(false);
  });

  test('Returns true when the queries exactly match', () => {
    const logQueries: DataQuery[] = [{ refId: 'C' }, { refId: 'B' }];
    const prevLogQueries = [{ refId: 'C' }, { refId: 'B' }];
    expect(canKeepDisplayedFields(logQueries, prevLogQueries)).toBe(true);
  });
});
