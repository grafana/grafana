import moment from 'moment-timezone';
import { DateTime as LuxonDateTime } from 'luxon';

import { looseMomentParseString } from './loose-moment-parse-string';

describe('looseMomentParseString compatibility', () => {
  describe('extra trailing precision', () => {
    const input = '2021-07-19 00:00:00.000';
    const momentFormat = 'YYYY-MM-DD HH:mm:ss';
    const luxonFormat = 'yyyy-LL-dd HH:mm:ss';

    describe('luxon', () => {
      it('fails when the input contains more precision than the format allows', () => {
        const parsed = LuxonDateTime.fromFormat(input, luxonFormat, { zone: 'utc' });

        expect(parsed.isValid).toBe(false);
      });
    });

    describe('moment support', () => {
      it('matches moment by accepting the valid prefix of the input', () => {
        const momentParsed = moment.utc(input, momentFormat);
        const parsed = looseMomentParseString(input, momentFormat, 'utc', 'en');

        expect(momentParsed.isValid()).toBe(true);
        expect(momentParsed.toISOString()).toBe('2021-07-19T00:00:00.000Z');
        expect(parsed.isValid).toBe(true);
        expect(parsed.toISO()).toBe('2021-07-19T00:00:00.000Z');
      });
    });
  });

  describe('optional punctuation in month names', () => {
    const input = 'Aug 20, 2020 10:30:20 am';
    const momentFormat = 'MMMM D YYYY h:mm:ss a';
    const luxonFormat = 'LLLL d yyyy h:mm:ss a';

    describe('luxon', () => {
      it('fails when the input includes punctuation that is not present in the format', () => {
        const parsed = LuxonDateTime.fromFormat(input, luxonFormat, { zone: 'utc', locale: 'en' });

        expect(parsed.isValid).toBe(false);
      });
    });

    describe('moment support', () => {
      it('matches moment by accepting the same input after loosening the format', () => {
        const momentParsed = moment.utc(input, momentFormat);
        const parsed = looseMomentParseString(input, momentFormat, 'utc', 'en');

        expect(momentParsed.isValid()).toBe(true);
        expect(momentParsed.toISOString()).toBe('2020-08-20T10:30:20.000Z');
        expect(parsed.isValid).toBe(true);
        expect(parsed.toISO()).toBe('2020-08-20T10:30:20.000Z');
      });
    });
  });
});
