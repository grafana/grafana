import { dateTimeFormat } from './formatter';

describe('dateTimeFormat', () => {
  describe('when no time zone have been set', () => {
    const browserTime = dateTimeFormat(1587126975779, { timeZone: 'browser' });

    it('should format with default formatting in browser/local time zone', () => {
      expect(dateTimeFormat(1587126975779)).toBe(browserTime);
    });
  });

  describe('when invalid time zone have been set', () => {
    const browserTime = dateTimeFormat(1587126975779, { timeZone: 'browser' });
    const options = { timeZone: 'asdf123' };

    it('should format with default formatting in browser/local time zone', () => {
      expect(dateTimeFormat(1587126975779, options)).toBe(browserTime);
    });
  });

  describe('when UTC time zone have been set', () => {
    const options = { timeZone: 'utc' };

    it('should format with default formatting in correct time zone', () => {
      expect(dateTimeFormat(1587126975779, options)).toBe('2020-04-17 12:36:15');
    });
  });

  describe('when Europe/Stockholm time zone have been set', () => {
    const options = { timeZone: 'Europe/Stockholm' };

    it('should format with default formatting in correct time zone', () => {
      expect(dateTimeFormat(1587126975779, options)).toBe('2020-04-17 14:36:15');
    });
  });

  describe('when Australia/Perth time zone have been set', () => {
    const options = { timeZone: 'Australia/Perth' };

    it('should format with default formatting in correct time zone', () => {
      expect(dateTimeFormat(1587126975779, options)).toBe('2020-04-17 20:36:15');
    });
  });

  describe('when Asia/Yakutsk time zone have been set', () => {
    const options = { timeZone: 'Asia/Yakutsk' };

    it('should format with default formatting in correct time zone', () => {
      expect(dateTimeFormat(1587126975779, options)).toBe('2020-04-17 21:36:15');
    });
  });

  describe('when America/Panama time zone have been set', () => {
    const options = { timeZone: 'America/Panama' };

    it('should format with default formatting in correct time zone', () => {
      expect(dateTimeFormat(1587126975779, options)).toBe('2020-04-17 07:36:15');
    });
  });

  describe('when America/Los_Angeles time zone have been set', () => {
    const options = { timeZone: 'America/Los_Angeles' };

    it('should format with default formatting in correct time zone', () => {
      expect(dateTimeFormat(1587126975779, options)).toBe('2020-04-17 05:36:15');
    });
  });

  describe('when Africa/Djibouti time zone have been set', () => {
    const options = { timeZone: 'Africa/Djibouti' };

    it('should format with default formatting in correct time zone', () => {
      expect(dateTimeFormat(1587126975779, options)).toBe('2020-04-17 15:36:15');
    });
  });
});
