import { queryCoauthoringDiff } from './queryCoauthoringDiff';

describe('queryCoauthoringDiff', () => {
  it('marks both wrapping insertions outside a focused rate expression', () => {
    expect(queryCoauthoringDiff('rate(x[5m])', 'sum by (code) (rate(x[5m]))', [{ from: 0, to: 11 }])).toEqual([
      { from: 0, to: 0, original: '', proposed: 'sum by (code) (', focus: 'outside' },
      { from: 11, to: 11, original: '', proposed: ')', focus: 'outside' },
    ]);
  });

  it('marks a recording rule rename within Focus', () => {
    expect(
      queryCoauthoringDiff('job:http_requests:rate5m', 'job:http_requests:rate10m', [{ from: 0, to: 24 }])
    ).toEqual([{ from: 18, to: 24, original: 'rate5m', proposed: 'rate10m', focus: 'inside' }]);
  });

  it('marks only the second repeated range in Baseline coordinates', () => {
    expect(
      queryCoauthoringDiff('rate(x{code="500"}[5m]) / rate(x[5m])', 'rate(x{code="500"}[5m]) / rate(x[10m])', [
        { from: 33, to: 35 },
      ])
    ).toEqual([{ from: 33, to: 34, original: '5', proposed: '10', focus: 'inside' }]);
  });

  it.each([
    { ranges: [{ from: 0, to: 7 }], focus: 'inside' },
    { ranges: [{ from: 0, to: 6 }], focus: 'outside' },
    { ranges: [{ from: 6, to: 7 }], focus: 'outside' },
  ])('classifies a pure insertion as $focus for $ranges', ({ ranges, focus }) => {
    expect(queryCoauthoringDiff('rate(x)', 'rate(x + y)', ranges)).toEqual([
      { from: 6, to: 6, original: '', proposed: ' + y', focus },
    ]);
  });

  it('hides whitespace-only hunks', () => {
    expect(queryCoauthoringDiff('rate(x)', '  rate( x ) \n', [{ from: 0, to: 7 }])).toEqual([]);
  });

  it('keeps whitespace changes inside quoted strings visible', () => {
    expect(queryCoauthoringDiff('x{code="a b"}', 'x{code="a  b"}', [{ from: 0, to: 13 }])).toEqual([
      { from: 7, to: 12, original: '"a b"', proposed: '"a  b"', focus: 'inside' },
    ]);
  });

  it('marks a replacement that straddles Focus outside', () => {
    expect(queryCoauthoringDiff('rate(x)', 'increase(y)', [{ from: 0, to: 2 }])).toEqual([
      { from: 0, to: 4, original: 'rate', proposed: 'increase', focus: 'outside' },
      { from: 5, to: 6, original: 'x', proposed: 'y', focus: 'outside' },
    ]);
  });
});
