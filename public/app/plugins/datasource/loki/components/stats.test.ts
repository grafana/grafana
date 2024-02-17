import { dateTime, getDefaultTimeRange } from '@grafana/data';

import { LokiQueryType } from '../types';

import { shouldUpdateStats } from './stats';

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
