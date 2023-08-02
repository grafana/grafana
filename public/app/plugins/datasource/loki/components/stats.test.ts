import { dateTime, getDefaultTimeRange } from '@grafana/data';

import { createLokiDatasource } from '../mocks';

import { getStats, shouldUpdateStats } from './stats';

describe('shouldUpdateStats', () => {
  it('should return true if the query has changed', () => {
    const query = '{job="grafana"}';
    const prevQuery = '{job="not-grafana"}';
    const timerange = getDefaultTimeRange();
    const prevTimerange = timerange;
    expect(shouldUpdateStats(query, prevQuery, timerange, prevTimerange)).toBe(true);
  });

  it('should return true if the timerange has changed', () => {
    const query = '{job="grafana"}';
    const prevQuery = '{job="grafana"}';
    const timerange = getDefaultTimeRange();
    timerange.raw.from = 'now-14h';
    const prevTimerange = getDefaultTimeRange();
    expect(shouldUpdateStats(query, prevQuery, timerange, prevTimerange)).toBe(true);
  });

  it('should return false if the query and timerange have not changed', () => {
    const query = '{job="grafana"}';
    const prevQuery = '{job="grafana"}';
    const timerange = getDefaultTimeRange();
    const prevTimerange = timerange;
    expect(shouldUpdateStats(query, prevQuery, timerange, prevTimerange)).toBe(false);
  });

  it('should return false if the query and timerange have not changed', () => {
    const query = '{job="grafana"}';
    const prevQuery = '{job="grafana"}';
    const timerange = getDefaultTimeRange();
    const prevTimerange = getDefaultTimeRange();
    expect(shouldUpdateStats(query, prevQuery, timerange, prevTimerange)).toBe(false);
  });

  it('should return false if the query and timerange with absolute and relative mixed have not changed', () => {
    const query = '{job="grafana"}';
    const prevQuery = '{job="grafana"}';
    const now = dateTime(Date.now());
    const timerange = getDefaultTimeRange();
    timerange.raw.from = now;

    const prevTimerange = getDefaultTimeRange();
    prevTimerange.raw.from = now;
    expect(shouldUpdateStats(query, prevQuery, timerange, prevTimerange)).toBe(false);
  });
});

describe('makeStatsRequest', () => {
  const datasource = createLokiDatasource();

  it('should return null if there is no query', () => {
    const query = '';
    expect(getStats(datasource, query)).resolves.toBe(null);
  });

  it('should return null if the query is invalid', () => {
    const query = '{job="grafana",';
    expect(getStats(datasource, query)).resolves.toBe(null);
  });

  it('should return null if the response has no data', () => {
    const query = '{job="grafana"}';
    datasource.getQueryStats = jest.fn().mockResolvedValue({ streams: 0, chunks: 0, bytes: 0, entries: 0 });
    expect(getStats(datasource, query)).resolves.toBe(null);
  });

  it('should return the stats if the response has data', () => {
    const query = '{job="grafana"}';

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
