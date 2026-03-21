import moment from 'moment-timezone';
import { DateTime as LuxonDateTime } from 'luxon';

import { formatWithMomentTokens } from './luxon-format-with-moment-tokens';

describe('formatWithMomentTokens compatibility', () => {
  const input = '2020-04-17T08:36:15.779';
  const zone = 'America/New_York';
  const format = 'YYYY-MM-DD hh:mm:ss a A z';

  describe('luxon', () => {
    it('does not treat moment tokens as moment-compatible output', () => {
      const value = LuxonDateTime.fromISO(input, { zone });

      expect(value.toFormat(format)).toBe('YYYY-04-Apr 17, 2020 08:36:15 AM A America/New_York');
    });
  });

  describe('moment support', () => {
    it('matches moment output for meridiem casing and zone abbreviation', () => {
      const value = LuxonDateTime.fromISO(input, { zone });
      const momentValue = moment.tz(input, zone);

      expect(momentValue.format(format)).toBe('2020-04-17 08:36:15 am AM EDT');
      expect(formatWithMomentTokens(value, format)).toBe(momentValue.format(format));
    });
  });
});
