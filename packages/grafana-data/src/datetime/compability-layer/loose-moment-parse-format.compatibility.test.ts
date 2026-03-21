import moment from 'moment-timezone';
import { DateTime as LuxonDateTime } from 'luxon';

import { looseMomentParseFormat } from './loose-moment-parse-format';

describe('looseMomentParseFormat compatibility', () => {
  const input = '2021-07-19 00:00:00.000';
  const luxonFormat = 'yyyy-LL-dd HH:mm:ss';
  const momentFormat = 'YYYY-MM-DD HH:mm:ss';

  describe('luxon', () => {
    it('rejects extra trailing input that does not match the format', () => {
      const parsed = LuxonDateTime.fromFormat(input, luxonFormat, { zone: 'utc' });

      expect(parsed.isValid).toBe(false);
    });
  });

  describe('moment support', () => {
    it('keeps the prefix that moment can still parse', () => {
      const parsed = moment.utc(input, momentFormat);

      expect(parsed.isValid()).toBe(true);
      expect(looseMomentParseFormat(input, luxonFormat)).toBe('2021-07-19 00:00:00');
    });
  });
});
