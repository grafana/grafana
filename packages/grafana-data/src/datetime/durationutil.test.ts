import { intervalToAbbreviatedDurationString, addDurationToDate, parseDuration } from './durationutil';

describe('Duration util', () => {
  describe('intervalToAbbreviatedDurationString', () => {
    it('creates a duration string for a provided interval', () => {
      const startDate = new Date();
      const endDate = addDurationToDate(startDate, { months: 1, weeks: 1, days: 1, hours: 1, minutes: 1, seconds: 1 });
      expect(intervalToAbbreviatedDurationString({ start: startDate, end: endDate })).toEqual('1M 8d 1h 1m 1s');
    });
  });

  describe('parseDuration', () => {
    it('parses a duration string', () => {
      const durationString = '3M 5d 20m';
      expect(parseDuration(durationString)).toEqual({ months: '3', days: '5', minutes: '20' });
    });

    it('strips out non valid durations', () => {
      const durationString = '3M 6v 5b 4m';
      expect(parseDuration(durationString)).toEqual({ months: '3', minutes: '4' });
    });
  });
});
