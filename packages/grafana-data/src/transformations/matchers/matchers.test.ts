import { fieldMatchers } from '../matchers';

import { FieldMatcherID } from './ids';

describe('Matchers', () => {
  it('should load all matchers', () => {
    for (const name of Object.keys(FieldMatcherID)) {
      const matcher = fieldMatchers.get(name);
      expect(matcher.id).toBe(name);
    }
  });
});
