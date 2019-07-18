import { dataMatchers } from './matchers';
import { DataMatcherID } from './ids';

describe('Matchers', () => {
  it('should load all matchers', () => {
    for (const name of Object.keys(DataMatcherID)) {
      const calc = dataMatchers.get(name);
      expect(calc.id).toBe(name);
    }
  });
});
