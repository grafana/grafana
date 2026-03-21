import { looseMomentParseFormat } from './loose-moment-parse-format';

describe('looseMomentParseFormat', () => {
  it('returns the prefix that matches the format', () => {
    expect(looseMomentParseFormat('2021-07-19 00:00:00.000', 'yyyy-LL-dd HH:mm:ss.SSS')).toBe('2021-07-19 00:00:00.000');
  });
});
