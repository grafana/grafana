import { type FieldMatcherInfo } from '../../types/transformations';
import { areMatcherOptionsValid, fieldMatchers } from '../matchers';

import { FieldMatcherID } from './ids';

describe('Matchers', () => {
  it('should load all matchers', () => {
    for (const name of Object.keys(FieldMatcherID)) {
      const matcher = fieldMatchers.get(name);
      expect(matcher.id).toBe(name);
    }
  });
});

describe('areMatcherOptionsValid', () => {
  const noValidator = {} as FieldMatcherInfo<unknown>;
  const stringValidator = {
    validateOptions: (o: unknown): o is string => typeof o === 'string',
  } as FieldMatcherInfo<string>;

  it('accepts any options when the matcher declares no validateOptions', () => {
    expect(areMatcherOptionsValid(noValidator, 'a')).toBe(true);
    expect(areMatcherOptionsValid(noValidator, { foo: 'bar' })).toBe(true);
    expect(areMatcherOptionsValid(noValidator, null)).toBe(true);
    expect(areMatcherOptionsValid(noValidator, undefined)).toBe(true);
  });

  it('delegates entirely to validateOptions when present', () => {
    expect(areMatcherOptionsValid(stringValidator, 'a')).toBe(true);
    expect(areMatcherOptionsValid(stringValidator, { foo: 'bar' })).toBe(false);
    expect(areMatcherOptionsValid(stringValidator, 1)).toBe(false);
    expect(areMatcherOptionsValid(stringValidator, null)).toBe(false);
  });
});
