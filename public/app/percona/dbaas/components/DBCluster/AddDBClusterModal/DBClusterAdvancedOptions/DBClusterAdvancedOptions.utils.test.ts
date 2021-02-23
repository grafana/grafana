import { resourceValidator } from './DBClusterAdvancedOptions.utils';

describe('DBClusterAdvancedOptions.utils::', () => {
  describe('resourceValidator::', () => {
    it('returns undefined on undefined value', () => {
      expect(resourceValidator(undefined)).toBeUndefined();
    });
    it('returns undefined when value is integer', () => {
      expect(resourceValidator(10)).toBeUndefined();
    });
    it('returns undefined when has one decimal place', () => {
      expect(resourceValidator(2.5)).toBeUndefined();
    });
    it("doesn't return undefined when value has more than one decimal place", () => {
      expect(resourceValidator(3.74)).not.toBeUndefined();
    });
  });
});
