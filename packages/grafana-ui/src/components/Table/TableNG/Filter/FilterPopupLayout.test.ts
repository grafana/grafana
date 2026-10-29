import { formatRowCount } from './FilterPopupLayout';

it.each([
  [0, '0'],
  [999, '999'],
  [1000, '1000'],
  [1001, '1.0k'],
  [1100, '1.1k'],
  [1_100_000, '1.1M'],
  [1_100_000_000, '1.1B'],
])('formats %i rows as %s', (count, expected) => {
  expect(formatRowCount(count)).toBe(expected);
});

it('uses the supplied locale for compact row counts', () => {
  expect(formatRowCount(1100, 'fr-FR')).toBe('1,1 k');
});
