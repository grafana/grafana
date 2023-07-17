import { dateTimeFormat, dateTimeFormatTimeAgo, dateTimeFormatWithAbbrevation, timeZoneAbbrevation } from './formatter';

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
    it('should format with default formatting in correct time zone', () => {
      const options = { timeZone: 'Europe/London' };
      expect(dateTimeFormat(1587126975779, options)).toBe('2020-04-17 13:36:15');
    });
    it('should format with default formatting in correct time zone', () => {
      const options = { timeZone: 'Europe/Berlin' };
      expect(dateTimeFormat(1587126975779, options)).toBe('2020-04-17 14:36:15');
    });
    it('should format with default formatting in correct time zone', () => {
      const options = { timeZone: 'Europe/Moscow' };
      expect(dateTimeFormat(1587126975779, options)).toBe('2020-04-17 15:36:15');
    });
    it('should format with default formatting in correct time zone', () => {
      const options = { timeZone: 'Europe/Madrid' };
      expect(dateTimeFormat(1587126975779, options)).toBe('2020-04-17 14:36:15');
    });
    it('should format with default formatting in correct time zone', () => {
      const options = { timeZone: 'America/New_York' };
      expect(dateTimeFormat(1587126975779, options)).toBe('2020-04-17 08:36:15');
    });
    it('should format with default formatting in correct time zone', () => {
      const options = { timeZone: 'America/Chicago' };
      expect(dateTimeFormat(1587126975779, options)).toBe('2020-04-17 07:36:15');
    });
    it('should format with default formatting in correct time zone', () => {
      const options = { timeZone: 'America/Denver' };
      expect(dateTimeFormat(1587126975779, options)).toBe('2020-04-17 06:36:15');
    });
  });

  describe('DateTimeFormatISO', () => {
    it('should format with correct ISO formatting', () => {
      const options = { timeZone: 'Europe/Stockholm', format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' };
      expect(dateTimeFormat(1587126975779, options)).toBe('2020-04-17T14:36:15.779+02:00');
    });
    it('should format with correct ISO formatting', () => {
      const options = { timeZone: 'America/New_York', format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' };
      expect(dateTimeFormat(1587126975779, options)).toBe('2020-04-17T08:36:15.779-04:00');
    });
    it('should format with correct ISO formatting', () => {
      const options = { timeZone: 'Europe/Madrid', format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' };
      expect(dateTimeFormat(1587126975779, options)).toBe('2020-04-17T14:36:15.779+02:00');
    });
  });

  describe('dateTimeFormatTimeAgo', () => {
    it('should return the correct format for 3 years ago', () => {
      const options = { timeZone: 'Europe/Stockholm' };
      expect(dateTimeFormatTimeAgo(1587126975779, options)).toBe('3 years ago');
    });
    it('should return the correct format for 2 year ago', () => {
      const options = { timeZone: 'Europe/Stockholm' };
      expect(dateTimeFormatTimeAgo(1626154993000, options)).toBe('2 years ago');
    });
    it('should return the correct format for 1 year ago', () => {
      const options = { timeZone: 'Europe/Stockholm' };
      expect(dateTimeFormatTimeAgo(1657731795000, options)).toBe('a year ago');
    });
  });
  describe('dateTimeFormatWithAbbreviation', () => {
    it('should return the correct format with zone abbreviation', () => {
      const options = { timeZone: 'Europe/Stockholm' };
      expect(dateTimeFormatWithAbbrevation(1587126975779, options)).toBe('2020-04-17 14:36:15 CEST');
    });
    it('should return the correct format with zone abbreviation', () => {
      const options = { timeZone: 'America/New_York' };
      expect(dateTimeFormatWithAbbrevation(1587126975779, options)).toBe('2020-04-17 08:36:15 EDT');
    });
    it('should return the correct format with zone abbreviation', () => {
      const options = { timeZone: 'Europe/Bucharest' };
      expect(dateTimeFormatWithAbbrevation(1587126975779, options)).toBe('2020-04-17 15:36:15 EEST');
    });
  });
  describe('timeZoneAbbrevation', () => {
    it('should return the correct abbreviation', () => {
      const options = { timeZone: 'Europe/Stockholm' };
      expect(timeZoneAbbrevation(1587126975779, options)).toBe('CEST');
    });
    it('should return the correct abbreviation', () => {
      const options = { timeZone: 'America/New_York' };
      expect(timeZoneAbbrevation(1587126975779, options)).toBe('EDT');
    });
    it('should return the correct abbreviation', () => {
      const options = { timeZone: 'Europe/Bucharest' };
      expect(timeZoneAbbrevation(1587126975779, options)).toBe('EEST');
    });
  });
});
