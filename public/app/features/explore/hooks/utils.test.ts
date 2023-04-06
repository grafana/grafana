import { dateTime } from '@grafana/data';

import { getTimeRangeFromUrl } from './utils';

describe('getTimeRangeFromUrl', () => {
  it('should parse moment date', () => {
    // convert date strings to moment object
    const range = { from: dateTime('2020-10-22T10:44:33.615Z'), to: dateTime('2020-10-22T10:49:33.615Z') };
    const result = getTimeRangeFromUrl(range, 'browser');
    expect(result.raw).toEqual(range);
  });

  it('should parse epoch strings', () => {
    const range = {
      from: dateTime('2020-10-22T10:00:00Z').valueOf().toString(),
      to: dateTime('2020-10-22T11:00:00Z').valueOf().toString(),
    };
    const result = getTimeRangeFromUrl(range, 'browser');
    expect(result.from.valueOf()).toEqual(dateTime('2020-10-22T10:00:00Z').valueOf());
    expect(result.to.valueOf()).toEqual(dateTime('2020-10-22T11:00:00Z').valueOf());
    expect(result.raw.from.valueOf()).toEqual(dateTime('2020-10-22T10:00:00Z').valueOf());
    expect(result.raw.to.valueOf()).toEqual(dateTime('2020-10-22T11:00:00Z').valueOf());
  });

  it('should parse ISO strings', () => {
    const range = {
      from: dateTime('2020-10-22T10:00:00Z').toISOString(),
      to: dateTime('2020-10-22T11:00:00Z').toISOString(),
    };
    const result = getTimeRangeFromUrl(range, 'browser');
    expect(result.from.valueOf()).toEqual(dateTime('2020-10-22T10:00:00Z').valueOf());
    expect(result.to.valueOf()).toEqual(dateTime('2020-10-22T11:00:00Z').valueOf());
    expect(result.raw.from.valueOf()).toEqual(dateTime('2020-10-22T10:00:00Z').valueOf());
    expect(result.raw.to.valueOf()).toEqual(dateTime('2020-10-22T11:00:00Z').valueOf());
  });
});
