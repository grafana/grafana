export const CLONE_KEY = '-clone-';
export const CLONE_SEPARATOR = '|';

// Regular expression to match '-clone-' followed by a number, but not '-clone-0' as it is the reference object
export const CLONE_REGEX = new RegExp(`${CLONE_KEY}(?!0)`);
// Regular expression to remove '-clone-' followed by any number
export const CLONE_REPLACE_REGEX = new RegExp(`${CLONE_KEY}\\d+`);

/**
 * Create a key for a given scene object key
 * @param key - key of source scene object
 * @param index - index of the clone
 */
export function getCloneKey(key: string, index: number): string {
  return `${key}${CLONE_KEY}${index}`;
}

/**
 * Checks if the key is a clone key
 * @param key - key to check
 */
export function isClonedKey(key: string): boolean {
  return CLONE_REGEX.test(key);
}

/**
 * Get the original key from a clone key
 * @param key - key to get original key from
 */
export function getOriginalKey(key: string): string {
  return key.replace(CLONE_REPLACE_REGEX, '');
}

/**
 * Checks if key1 is a clone of key2
 * @param key1 - scene object to check
 * @param key2 - scene object to check against
 */
export function isClonedKeyOf(key1: string, key2: string): boolean {
  return isClonedKey(key1) && getOriginalKey(key1) === getOriginalKey(key2);
}

/**
 * Get the last key from a clone key
 * @param key - key to get last key from
 */
export function getLastKeyFromClone(key: string): string {
  const keys = key.split(CLONE_SEPARATOR);
  return keys[keys.length - 1];
}

/**
 * Get the ancestors from a clone key
 * @param key - key to get ancestors from
 */
export function getAncestorsFromClone(key: string): string {
  const keys = key.split(CLONE_SEPARATOR);
  return keys.slice(0, keys.length - 1).join(CLONE_SEPARATOR);
}

/**
 * Join clone keys
 * @param keys - keys to join
 */
export function joinCloneKeys(...keys: string[]): string {
  return keys.filter(Boolean).join(CLONE_SEPARATOR);
}

/**
 * Checks if the key or any of its ancestors are cloned
 * @param key - key to check
 */
export function hasClonedAncestors(key: string): boolean {
  return key.split(CLONE_SEPARATOR).some(isClonedKey);
}

/**
 * Checks if a key contains the '-clone-' string
 * @param key - key to check
 */
export function containsCloneKey(key: string): boolean {
  return key.includes(CLONE_KEY);
}
