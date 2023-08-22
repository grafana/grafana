import { dateTime, getDefaultTimeRange } from '@grafana/data';

import { createLokiDatasource } from '../mocks';

import { getStats, shouldUpdateStats } from './stats';

describe('shouldUpdateStats', () => {
  const timerange = getDefaultTimeRange();
  it('should return true if the query has changed', () => {
    const query = '{job="grafana"}';
    const prevQuery = '{job="not-grafana"}';
    expect(shouldUpdateStats(query, prevQuery, timerange, timerange)).toBe(true);
  });

  it('should return true if the timerange has changed', () => {
    const query = '{job="grafana"}';
    const prevQuery = '{job="grafana"}';
    timerange.raw.from = 'now-14h';
    const prevTimerange = getDefaultTimeRange();
    expect(shouldUpdateStats(query, prevQuery, timerange, prevTimerange)).toBe(true);
  });

  it('should return true if the previous query was undefined', () => {
    const query = '{job="grafana"}';
    const prevQuery = undefined;
    expect(shouldUpdateStats(query, prevQuery, timerange, timerange)).toBe(true);
  });

  it('should return true if the query really changed, otherwise false', () => {
    const prevQuery = '{job="grafana"}';
    const query = `${prevQuery} `;
    expect(shouldUpdateStats(query, prevQuery, timerange, timerange)).toBe(false);
  });

  it('should return false if the query and timerange have not changed', () => {
    const query = '{job="grafana"}';
    const prevQuery = '{job="grafana"}';
    expect(shouldUpdateStats(query, prevQuery, timerange, timerange)).toBe(false);
  });

  it('should return false if the query and timerange with absolute and relative mixed have not changed', () => {
    const query = '{job="grafana"}';
    const prevQuery = '{job="grafana"}';
    const now = dateTime(Date.now());
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

  it('should support queries with variables', () => {
    const query = 'count_over_time({job="grafana"}[$__interval])';

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
