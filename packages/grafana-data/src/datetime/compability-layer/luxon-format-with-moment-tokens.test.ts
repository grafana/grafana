import { DateTime as LuxonDateTime } from 'luxon';
import {formatWithMomentTokens} from "./luxon-format-with-moment-tokens";

describe('formatWithMomentTokens', () => {
  it('keeps moment-compatible meridiem and zone tokens', () => {
    const value = LuxonDateTime.fromISO('2020-04-17T08:36:15.779', { zone: 'America/New_York' });

    expect(formatWithMomentTokens(value, 'YYYY-MM-DD hh:mm:ss a A z')).toBe('2020-04-17 08:36:15 am AM EDT');
  });

  it('does not replace escaped moment tokens', () => {
    const value = LuxonDateTime.fromISO('2020-04-17T08:36:15.779', { zone: 'America/New_York' });

    expect(formatWithMomentTokens(value, '\\a \\A \\z')).toBe('a A z');
  });
});
