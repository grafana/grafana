import { dateTime, getDefaultTimeRange } from '@grafana/data';

import { LokiDatasource } from '../datasource';
import { createLokiDatasource } from '../mocks';
import { LokiQuery, LokiQueryType } from '../types';

import { getStats, getTimeRange, shouldUpdateStats } from './stats';

describe('shouldUpdateStats', () => {
  const timerange = getDefaultTimeRange();
  let queryType = LokiQueryType.Range;
  let prevQueryType = LokiQueryType.Range;

  it('should return true if the query has changed', () => {
    const query = '{job="grafana"}';
    const prevQuery = '{job="not-grafana"}';
    expect(shouldUpdateStats(query, prevQuery, timerange, timerange, queryType, prevQueryType)).toBe(true);
  });

  it('should return true if the timerange has changed', () => {
    const query = '{job="grafana"}';
    const prevQuery = '{job="grafana"}';
    timerange.raw.from = 'now-14h';
    const prevTimerange = getDefaultTimeRange();
    expect(shouldUpdateStats(query, prevQuery, timerange, prevTimerange, queryType, prevQueryType)).toBe(true);
  });

  it('should return true if the previous query was undefined', () => {
    const query = '{job="grafana"}';
    const prevQuery = undefined;
    expect(shouldUpdateStats(query, prevQuery, timerange, timerange, queryType, prevQueryType)).toBe(true);
  });

  it('should return true if the query really changed, otherwise false', () => {
    const prevQuery = '{job="grafana"}';
    const query = `${prevQuery} `;
    expect(shouldUpdateStats(query, prevQuery, timerange, timerange, queryType, prevQueryType)).toBe(false);
  });

  it('should return false if the query and timerange have not changed', () => {
    const query = '{job="grafana"}';
    const prevQuery = '{job="grafana"}';
    expect(shouldUpdateStats(query, prevQuery, timerange, timerange, queryType, prevQueryType)).toBe(false);
  });

  it('should return false if the query and timerange with absolute and relative mixed have not changed', () => {
    const query = '{job="grafana"}';
    const prevQuery = '{job="grafana"}';
    const now = dateTime(Date.now());
    timerange.raw.from = now;

    const prevTimerange = getDefaultTimeRange();
    prevTimerange.raw.from = now;
    expect(shouldUpdateStats(query, prevQuery, timerange, prevTimerange, queryType, prevQueryType)).toBe(false);
  });

  it('should return true if the query type has changed', () => {
    const query = '{job="grafana"}';
    const prevQuery = '{job="grafana"}';
    prevQueryType = LokiQueryType.Instant;
    expect(shouldUpdateStats(query, prevQuery, timerange, timerange, queryType, prevQueryType)).toBe(true);
  });
});

describe('makeStatsRequest', () => {
  const datasource = createLokiDatasource();
  let query: LokiQuery;

  beforeEach(() => {
    query = { refId: 'A', expr: '', queryType: LokiQueryType.Range };
  });

  it('should return null if there is no query', () => {
    query.expr = '';
    expect(getStats(datasource, query)).resolves.toBe(null);
  });

  it('should return null if the query is invalid', () => {
    query.expr = '{job="grafana",';
    expect(getStats(datasource, query)).resolves.toBe(null);
  });

  it('should return null if the response has no data', () => {
    query.expr = '{job="grafana"}';
    datasource.getQueryStats = jest.fn().mockResolvedValue({ streams: 0, chunks: 0, bytes: 0, entries: 0 });
    expect(getStats(datasource, query)).resolves.toBe(null);
  });

  it('should return the stats if the response has data', () => {
    query.expr = '{job="grafana"}';

    datasource.getQueryStats = jest
      .fn()
      .mockResolvedValue({ streams: 1, chunks: 12611, bytes: 12913664, entries: 78344 });
    expect(getStats(datasource, query)).resolves.toEqual({
      streams: 1,
      chunks: 12611,
      bytes: 12913664,
      entries: 78344,
    });
  });

  it('should support queries with variables', () => {
    query.expr = 'count_over_time({job="grafana"}[$__interval])';

    datasource.interpolateString = jest
      .fn()
      .mockImplementationOnce((value: string) => value.replace('$__interval', '1h'));
    datasource.getQueryStats = jest
      .fn()
      .mockResolvedValue({ streams: 1, chunks: 12611, bytes: 12913664, entries: 78344 });
    expect(getStats(datasource, query)).resolves.toEqual({
      streams: 1,
      chunks: 12611,
      bytes: 12913664,
      entries: 78344,
    });
  });
});

describe('getTimeRange', () => {
  let query: LokiQuery;
  let datasource: LokiDatasource;

  beforeEach(() => {
    query = { refId: 'A', expr: '', queryType: LokiQueryType.Range };
    datasource = createLokiDatasource();

    datasource.getTimeRangeParams = jest.fn().mockReturnValue({
      start: 1672552800000000000, // 01 Jan 2023 06:00:00 GMT
      end: 1672639200000000000, //   02 Jan 2023 06:00:00 GMT
    });
  });

  it('should return the ds picker timerange for a logs query with range type', () => {
    // log queries with range type should request the ds picker timerange
    // in this case (1 day)
    query.expr = '{job="grafana"}';

    expect(getTimeRange(datasource, query, 0)).toEqual({
      start: 1672552800000000000, // 01 Jan 2023 06:00:00 GMT
      end: 1672639200000000000, //   02 Jan 2023 06:00:00 GMT
    });
  });

  it('should return nothing for a logs query with instant type', () => {
    // log queries with instant type should be invalid.
    query.queryType = LokiQueryType.Instant;
    query.expr = '{job="grafana"}';

    expect(getTimeRange(datasource, query, 0)).toEqual({
      start: undefined,
      end: undefined,
    });
  });

  it('should return the ds picker timerange', () => {
    // metric queries with range type should request ds picker timerange
    // in this case (1 day)
    query.expr = 'rate({job="grafana"}[5m])';

    expect(getTimeRange(datasource, query, 0)).toEqual({
      start: 1672552800000000000, // 01 Jan 2023 05:55:00 GMT
      end: 1672639200000000000, //   02 Jan 2023 06:00:00 GMT
    });
  });

  it('should return the range duration for an instant metric query', () => {
    // metric queries with instant type should request range duration
    // in this case (5 minutes)
    query.queryType = LokiQueryType.Instant;
    query.expr = 'rate({job="grafana"}[5m])';

    expect(getTimeRange(datasource, query, 0)).toEqual({
      start: 1672638900000000000, // 02 Jan 2023 05:55:00 GMT
      end: 1672639200000000000, //   02 Jan 2023 06:00:00 GMT
    });
  });
});
