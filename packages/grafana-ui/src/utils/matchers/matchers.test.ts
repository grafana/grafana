import { seriesDataMatchers } from './matchers';
import { SeriesDataMatcherID } from './ids';

describe('Matchers', () => {
  it('should load all matchers', () => {
    for (const name of Object.keys(SeriesDataMatcherID)) {
      const calc = seriesDataMatchers.get(name);
      expect(calc.id).toBe(name);
    }
  });
});
