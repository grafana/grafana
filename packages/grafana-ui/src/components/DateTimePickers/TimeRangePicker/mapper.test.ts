import { set } from 'lodash';

import { DateTime, dateTimeParse, FeatureToggles } from '@grafana/data';
import { initRegionalFormatForTests } from '@grafana/i18n';

import * as commonFormatModule from '../commonFormat';

import { mapOptionToTimeRange, mapRangeToTimeOption } from './mapper';

// If this flag is deleted, this mock also should be, and the additional tests for when
// the flag was disabled.
type LocaleFormatPreferenceType = FeatureToggles['localeFormatPreference'];
jest.mock('../commonFormat', () => {
  const format = 'YYYY-MM-DD HH:mm:ss' as const;
  const moduleObject = {
    __esModule: true,
    commonFormat: format as undefined | 'YYYY-MM-DD HH:mm:ss',
    mockSetCommonFormat,
  };
  function mockSetCommonFormat(enabled: LocaleFormatPreferenceType = true) {
    moduleObject.commonFormat = enabled ? format : undefined;
  }
  return moduleObject;
});
// @ts-expect-error mockSetCommonFormat doesn't exist on the export type of commonFormat,
// but it's added above in the mock.
const mockSetCommonFormat: (enabled: LocaleFormatPreferenceType) => void = commonFormatModule.mockSetCommonFormat;

function setRegionalFormatToggle(enabled: LocaleFormatPreferenceType) {
  mockSetCommonFormat(enabled);
  set(window, 'grafanaBootData.settings.featureToggles.localeFormatPreference', enabled);
}

beforeAll(() => {
  initRegionalFormatForTests('en-AU');
});

beforeEach(() => {
  setRegionalFormatToggle(true);
});

describe('when mapOptionToTimeRange is passed a TimeOption and timezone', () => {
  it('returns the equivalent TimeRange', () => {
    const result = mapOptionToTimeRange(
      {
        from: '2025-04-13 04:13:14',
        to: '2025-04-13 05:14:15',
        display: '13/04/25, 4:13:14 am - 5:14:15 am',
      },
      'America/New_York'
    );

    function toISOStringIfDate(date: string | DateTime) {
      return typeof date === 'string' ? date : date.toISOString();
    }
    expect(result.from.toISOString()).toBe('2025-04-13T08:13:14.000Z');
    expect(result.to.toISOString()).toBe('2025-04-13T09:14:15.000Z');
    expect(toISOStringIfDate(result.raw.from)).toBe('2025-04-13T08:13:14.000Z');
    expect(toISOStringIfDate(result.raw.to)).toBe('2025-04-13T09:14:15.000Z');
  });
});

describe('when mapRangeToTimeOption is passed a TimeRange and timezone', () => {
  it('returns the equivalent TimeOption', () => {
    expect(
      mapRangeToTimeOption(
        {
          from: dateTimeParse('2025-04-13T08:13:14Z'),
          to: dateTimeParse('2025-04-13T09:14:15Z'),
          raw: {
            from: dateTimeParse('2025-04-13T08:13:14Z'),
            to: dateTimeParse('2025-04-13T09:14:15Z'),
          },
        },
        'America/New_York'
      )
    ).toStrictEqual({
      from: '2025-04-13 04:13:14',
      to: '2025-04-13 05:14:15',
      display: '13/4/25, 4:13:14 am – 5:14:15 am', // "narrow no-break space"s, and "en dash" are the odd characters
    });
  });

  describe('and localeFormatPreference flag is off', () => {
    beforeEach(() => {
      setRegionalFormatToggle(false);
    });

    it('returns the equivalent TimeOption', () => {
      expect(
        mapRangeToTimeOption(
          {
            from: dateTimeParse('2025-04-13T08:13:14Z'),
            to: dateTimeParse('2025-04-13T09:14:15Z'),
            raw: {
              from: dateTimeParse('2025-04-13T08:13:14Z'),
              to: dateTimeParse('2025-04-13T09:14:15Z'),
            },
          },
          'America/New_York'
        )
      ).toStrictEqual({
        from: '2025-04-13 04:13:14',
        to: '2025-04-13 05:14:15',
        display: '2025-04-13 04:13:14 to 2025-04-13 05:14:15',
      });
    });
  });
});
