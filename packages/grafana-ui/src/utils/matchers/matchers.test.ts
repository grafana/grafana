import { seriesMatchers } from './matchers';
import { SeriesMatcherID } from './ids';

describe('Matchers', () => {
  it('should load all matchers', () => {
    for (const name of Object.keys(SeriesMatcherID)) {
      const calc = seriesMatchers.get(name);
      expect(calc.id).toBe(name);
    }
  });
});
