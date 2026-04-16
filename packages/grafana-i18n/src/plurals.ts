import { type Resources } from './types';

const PLURAL_SUFFIXES = ['_zero', '_one', '_two', '_few', '_many', '_other'] as const;

function isPluralKey(key: string): boolean {
  return PLURAL_SUFFIXES.some((suffix) => key.endsWith(suffix));
}

function isResources(value: unknown): value is Resources {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function filterPluralKeys(resources: Resources): Resources {
  const result: Resources = {};

  for (const [key, value] of Object.entries(resources)) {
    if (isResources(value)) {
      const filtered = filterPluralKeys(value);
      if (Object.keys(filtered).length > 0) {
        result[key] = filtered;
      }
    } else if (isPluralKey(key)) {
      result[key] = value;
    }
  }

  return result;
}
