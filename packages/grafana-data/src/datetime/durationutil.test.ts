import {
  intervalToAbbreviatedDurationString,
  addDurationToDate,
  parseDuration,
  isValidDuration,
  isValidGoDuration,
} from './durationutil';

describe('Duration util', () => {
  describe('intervalToAbbreviatedDurationString', () => {
    it('creates a duration string for a provided interval', () => {
      const startDate = new Date();
      const endDate = addDurationToDate(startDate, { months: 1, weeks: 1, days: 1, hours: 1, minutes: 1, seconds: 1 });
      expect(intervalToAbbreviatedDurationString({ start: startDate, end: endDate })).toEqual('1M 8d 1h 1m 1s');
    });

    it('should return an empty string if start date is after end date', () => {
      const endDate = new Date();
      const startDate = addDurationToDate(endDate, { minutes: 1 });
      expect(intervalToAbbreviatedDurationString({ start: startDate, end: endDate })).toEqual('');
    });
  });

  describe('parseDuration', () => {
    it('parses a duration string', () => {
      const durationString = '3M 5d 20m';
      expect(parseDuration(durationString)).toEqual({ months: 3, days: 5, minutes: 20 });
    });

    it('strips out non valid durations', () => {
      const durationString = '3M 6v 5b 4m';
      expect(parseDuration(durationString)).toEqual({ months: 3, minutes: 4 });
    });
  });

  describe('isValidDuration', () => {
    it('valid duration string returns true', () => {
      const durationString = '3M 5d 20m';
      expect(isValidDuration(durationString)).toEqual(true);
    });

    it('invalid duration string returns false', () => {
      const durationString = '3M 6v 5b 4m';
      expect(isValidDuration(durationString)).toEqual(false);
    });
  });

  describe('isValidGoDuration', () => {
    it('valid duration string returns true', () => {
      const durationString = '3h 4m 1s 2ms 3us 5ns';
      expect(isValidGoDuration(durationString)).toEqual(true);
    });

    it('valid float number duration string returns true', () => {
      const durationString = '3.1h 4.0m 0.1s 2.11ms 0.03us 5.3333ns';
      expect(isValidGoDuration(durationString)).toEqual(true);
    });

    it('invalid duration string returns false', () => {
      const durationString = '3M 6v 5b 4m';
      expect(isValidGoDuration(durationString)).toEqual(false);
    });

    it('invalid float number duration string returns false', () => {
      const durationString = '3.h -4.0m 0.s 2.ms -0.us 5.ns';
      expect(isValidGoDuration(durationString)).toEqual(false);
    });
  });
});
