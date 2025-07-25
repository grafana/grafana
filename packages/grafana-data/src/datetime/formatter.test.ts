import { initRegionalFormatForTests } from '@grafana/i18n';

import * as featureToggles from '../utils/featureToggles';

import { dateTimeFormat, dateTimeFormatTimeAgo, dateTimeFormatWithAbbrevation, timeZoneAbbrevation } from './formatter';

// Default time zone ("browser") is set to Pacific/Easter in jest.config.js
const referenceDate = '2020-04-17T12:36:15.779Z';

describe('dateTimeFormat (regionalFormatPreference)', () => {
  let mockGetFeatureToggle: jest.SpyInstance;

  beforeAll(() => {
    initRegionalFormatForTests('en-AU');
    mockGetFeatureToggle = jest.spyOn(featureToggles, 'getFeatureToggle').mockImplementation((featureName) => {
      return featureName === 'localeFormatPreference';
    });
  });

  afterAll(() => {
    mockGetFeatureToggle.mockRestore();
  });

  it('formats dates in the browsers timezone by default', () => {
    expect(dateTimeFormat(referenceDate)).toBe('17/04/2020, 6:36:15 am');
  });

  it('formats dates in the browsers timezone by default when invalid time zone is set', () => {
    const options = { timeZone: 'asdf123' };
    expect(dateTimeFormat(referenceDate, options)).toBe('17/04/2020, 6:36:15 am');
  });

  it.each([
    ['UTC', '17/04/2020, 12:36:15 pm'],
    ['Europe/Stockholm', '17/04/2020, 2:36:15 pm'],
    ['Australia/Perth', '17/04/2020, 8:36:15 pm'],
    ['Asia/Yakutsk', '17/04/2020, 9:36:15 pm'],
    ['America/Panama', '17/04/2020, 7:36:15 am'],
    ['America/Los_Angeles', '17/04/2020, 5:36:15 am'],
    ['Africa/Djibouti', '17/04/2020, 3:36:15 pm'],
    ['Europe/London', '17/04/2020, 1:36:15 pm'],
    ['Europe/Berlin', '17/04/2020, 2:36:15 pm'],
    ['Europe/Moscow', '17/04/2020, 3:36:15 pm'],
    ['Europe/Madrid', '17/04/2020, 2:36:15 pm'],
    ['America/New_York', '17/04/2020, 8:36:15 am'],
    ['America/Chicago', '17/04/2020, 7:36:15 am'],
    ['America/Denver', '17/04/2020, 6:36:15 am'],
  ])('formats with the supplied time zone %s', (timeZone, expected) => {
    expect(dateTimeFormat(referenceDate, { timeZone })).toBe(expected);
  });

  it('does not include seconds in the output if the time does not', () => {
    expect(dateTimeFormat('2020-04-17T12:36:00.000Z')).toBe('17/04/2020, 6:36 am');
  });

  it("includes milliseconds in the output when 'defaultWithMS' is set to true", () => {
    expect(dateTimeFormat('2020-04-17T12:36:15.123Z', { defaultWithMS: true })).toBe('17/04/2020, 6:36:15.123 am');
  });

  it.each([
    ['en-GB', '17/04/2020, 06:36:15'],
    ['en-US', '4/17/2020, 6:36:15 AM'],
    ['fr-FR', '17/04/2020 06:36:15'],
    ['es-ES', '17/4/2020, 6:36:15'],
    ['de-DE', '17.4.2020, 06:36:15'],
    ['pt-BR', '17/04/2020, 06:36:15'],
    ['zh-Hans', '2020/4/17 06:36:15'],
    ['it-IT', '17/04/2020, 06:36:15'],
    ['ja-JP', '2020/4/17 6:36:15'],
    ['id-ID', '17/4/2020, 06.36.15'],
    ['ko-KR', '2020. 4. 17. 오전 6:36:15'],
    ['ru-RU', '17.04.2020, 06:36:15'],
    ['cs-CZ', '17. 4. 2020 6:36:15'],
    ['nl-NL', '17-4-2020, 06:36:15'],
    ['hu-HU', '2020. 04. 17. 6:36:15'],
    ['pt-PT', '17/04/2020, 06:36:15'],
    ['pl-PL', '17.04.2020, 06:36:15'],
    ['sv-SE', '2020-04-17 06:36:15'],
    ['tr-TR', '17.04.2020 06:36:15'],
    ['zh-Hant', '2020/4/17 上午6:36:15'],
  ])('with locale %s', (locale, expected) => {
    initRegionalFormatForTests(locale);

    expect(dateTimeFormat(referenceDate)).toBe(expected);
  });
});

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
