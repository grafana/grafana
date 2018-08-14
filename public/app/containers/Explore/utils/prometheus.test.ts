import { getCleanSelector } from './prometheus';

describe('getCleanSelector()', () => {
  it('returns a clean selector from an empty selector', () => {
    expect(getCleanSelector('{}', 1)).toBe('{}');
  });
  it('throws if selector is broken', () => {
    expect(() => getCleanSelector('{foo')).toThrow();
  });
  it('returns the selector sorted by label key', () => {
    expect(getCleanSelector('{foo="bar"}')).toBe('{foo="bar"}');
    expect(getCleanSelector('{foo="bar",baz="xx"}')).toBe('{baz="xx",foo="bar"}');
  });
  it('returns a clean selector from an incomplete one', () => {
    expect(getCleanSelector('{foo}')).toBe('{}');
    expect(getCleanSelector('{foo="bar",baz}')).toBe('{foo="bar"}');
    expect(getCleanSelector('{foo="bar",baz="}')).toBe('{foo="bar"}');
  });
  it('throws if not inside a selector', () => {
    expect(() => getCleanSelector('foo{}', 0)).toThrow();
    expect(() => getCleanSelector('foo{} + bar{}', 5)).toThrow();
  });
  it('returns the selector nearest to the cursor offset', () => {
    expect(() => getCleanSelector('{foo="bar"} + {foo="bar"}', 0)).toThrow();
    expect(getCleanSelector('{foo="bar"} + {foo="bar"}', 1)).toBe('{foo="bar"}');
    expect(getCleanSelector('{foo="bar"} + {baz="xx"}', 1)).toBe('{foo="bar"}');
    expect(getCleanSelector('{baz="xx"} + {foo="bar"}', 16)).toBe('{foo="bar"}');
  });
  it('returns a selector with metric if metric is given', () => {
    expect(getCleanSelector('bar{foo}', 4)).toBe('{__name__="bar"}');
    expect(getCleanSelector('baz{foo="bar"}', 12)).toBe('{__name__="baz",foo="bar"}');
  });
});
