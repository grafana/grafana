import {
  dateTimeFormat,
  dateTimeFormatTimeAgo,
  dateTimeFormatTimeAgoShort,
  dateTimeFormatWithAbbrevation,
  timeZoneAbbrevation,
} from './formatter';

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

  describe('when time zone have been set', () => {
    it.each([
      ['Africa/Djibouti', '2020-04-17 15:36:15'],
      ['Europe/London', '2020-04-17 13:36:15'],
      ['Europe/Berlin', '2020-04-17 14:36:15'],
      ['Europe/Moscow', '2020-04-17 15:36:15'],
      ['Europe/Madrid', '2020-04-17 14:36:15'],
      ['America/New_York', '2020-04-17 08:36:15'],
      ['America/Chicago', '2020-04-17 07:36:15'],
      ['America/Denver', '2020-04-17 06:36:15'],
    ])('should format with default formatting in correct time zone', (timeZone, expected) => {
      expect(dateTimeFormat(1587126975779, { timeZone })).toBe(expected);
    });
  });

  describe('with custom ISO format', () => {
    it('should format according to ISO standard', () => {
      const options = { timeZone: 'Europe/Stockholm', format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' };
      expect(dateTimeFormat(1587126975779, options)).toBe('2020-04-17T14:36:15.779+02:00');
    });
    it('should format according to ISO standard', () => {
      const options = { timeZone: 'America/New_York', format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' };
      expect(dateTimeFormat(1587126975779, options)).toBe('2020-04-17T08:36:15.779-04:00');
    });
    it('should format according to ISO standard', () => {
      const options = { timeZone: 'Europe/Madrid', format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' };
      expect(dateTimeFormat(1587126975779, options)).toBe('2020-04-17T14:36:15.779+02:00');
    });
  });
});

describe('dateTimeFormatTimeAgo', () => {
  it('should return the correct format for years ago', () => {
    const options = { timeZone: 'Europe/Stockholm' };
    expect(dateTimeFormatTimeAgo(1587126975779, options)).toContain('years ago');
  });
});

describe('dateTimeFormatTimeAgoShort', () => {
  const now = 1587126975779;
  const ago = (ms: number) => dateTimeFormatTimeAgoShort(now - ms, { now });

  it.each([
    [400, '0s ago'],
    [5_000, '5s ago'],
    [11 * 60_000, '11m ago'],
    // Rounds before picking the unit, so 59.6 minutes is an hour, not 60m.
    [59.6 * 60_000, '1h ago'],
    [2 * 3_600_000, '2h ago'],
    [3 * 86_400_000, '3d ago'],
    [45 * 86_400_000, '2mo ago'],
    [2 * 365 * 86_400_000, '2y ago'],
    [-5 * 60_000, 'in 5m'],
  ])('formats a difference of %i ms as %s', (ms, expected) => {
    expect(ago(ms)).toBe(expected);
  });

  it('returns Invalid date for invalid input', () => {
    expect(dateTimeFormatTimeAgoShort(new Date(NaN), { now })).toBe('Invalid date');
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
  it('should return UTC for the utc time zone (like moment-timezone)', () => {
    expect(timeZoneAbbrevation(1587126975779, { timeZone: 'utc' })).toBe('UTC');
  });
  it('should return an empty string for zone names that do not resolve to an IANA zone (like moment)', () => {
    expect(timeZoneAbbrevation(1587126975779, { timeZone: 'browser' })).toBe('');
    expect(timeZoneAbbrevation(1587126975779, { timeZone: 'not/a-zone' })).toBe('');
  });
});
