import { empty, notEmpty, getObjectRules } from './object_rules';

describe('is empty', () => {
  [undefined, null, NaN, ' ', {}, []].forEach(input =>
    it(`should return true when input "${input}" is empty`, () => {
      const res = empty(input);
      expect(res).toBeTruthy();
    })
  );

  ['s', 1].forEach(input =>
    it(`should return false when input "${input}" is not empty`, () => {
      const res = empty(input);
      expect(res).toBeFalsy();
    })
  );
});

describe('is not empty contains', () => {
  [undefined, null, NaN, '', {}, []].forEach(input =>
    it(`should return false when input "${input}" is not empty`, () => {
      const res = notEmpty(input);
      expect(res).toBeFalsy();
    })
  );

  ['s', 1].forEach(input =>
    it(`should return true when input "${input}" is not empty`, () => {
      const res = notEmpty(input);
      expect(res).toBeTruthy();
    })
  );
});

describe('getObjectRules', () => {
  it('should return object rules', () => {
    const res = getObjectRules();
    expect(res.length).toBeGreaterThan(0);
  });
});
