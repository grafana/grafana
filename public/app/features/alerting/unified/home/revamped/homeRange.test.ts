import { dateTime } from '@grafana/data';

import { describeRangeShort } from './homeRange';

function relative(from: string, to = 'now') {
  const range = { from: dateTime(), to: dateTime(), raw: { from, to } };
  return describeRangeShort(range);
}

describe('describeRangeShort', () => {
  it.each`
    from         | expected
    ${'now-7d'}  | ${'last 7d'}
    ${'now-24h'} | ${'last 24h'}
    ${'now-30m'} | ${'last 30m'}
    ${'now-2w'}  | ${'last 2w'}
  `('writes a range from $from to now as "$expected"', ({ from, expected }) => {
    expect(relative(from)).toBe(expected);
  });

  it('falls back to the picker wording, in lower case, for a range that is not "the last N units"', () => {
    expect(relative('now-1d/d', 'now-1d/d')).toBe('yesterday');
  });

  it('spells out an absolute range with its dates', () => {
    const from = dateTime('2026-11-01T00:00:00Z');
    const to = dateTime('2026-11-03T00:00:00Z');
    expect(describeRangeShort({ from, to, raw: { from, to } })).toMatch(
      /^\d{4}-\d{2}-\d{2} [\d:]+ to \d{4}-\d{2}-\d{2} [\d:]+$/
    );
  });
});
