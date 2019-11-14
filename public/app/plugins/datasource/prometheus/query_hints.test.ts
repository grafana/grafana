import { getQueryHints } from './query_hints';

describe('getQueryHints', () => {
  describe('when called without datapoints in series', () => {
    it('then it should use rows instead and return correct hint', () => {
      const series = [
        {
          fields: [
            {
              name: 'Some Name',
            },
          ],
          rows: [[1], [2]],
        },
      ];

      const result = getQueryHints('up', series);
      expect(result).toEqual([
        {
          fix: { action: { query: 'up', type: 'ADD_RATE' }, label: 'Fix by adding rate().' },
          label: 'Time series is monotonically increasing.',
          type: 'APPLY_RATE',
        },
      ]);
    });
  });

  describe('when called without datapoints and rows in series', () => {
    it('then it should use an empty array and return null', () => {
      const series = [
        {
          fields: [
            {
              name: 'Some Name',
            },
          ],
        },
      ];

      const result = getQueryHints('up', series);
      expect(result).toEqual(null);
    });
  });
});
