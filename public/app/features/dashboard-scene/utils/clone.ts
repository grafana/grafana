const CLONE_KEY = '-clone-';
const CLONE_SEPARATOR = '/';

const CLONED_KEY_REGEX = new RegExp(`${CLONE_KEY}[1-9][0-9]*$`);
const ORIGINAL_REGEX = new RegExp(`${CLONE_KEY}\\d+$`);

/**
 * Create or alter the last key for a key
 * @param key
 * @param index
 */
export function getCloneKey(key: string, index: number): string {
  const parts = key.split(CLONE_SEPARATOR).slice(0, -1);
  const lastKey = getOriginalKey(getLastKeyFromClone(key));
  return [...parts, `${lastKey}${CLONE_KEY}${index}`].join(CLONE_SEPARATOR);
}

/**
 * Get the original key from a clone key
 * @param key
 */
export function getOriginalKey(key: string): string {
  return getLastKeyFromClone(key).replace(ORIGINAL_REGEX, '');
}

/**
 * Checks if the last key is a clone key
 * @param key
 */
export function isClonedKey(key: string): boolean {
  return CLONED_KEY_REGEX.test(getLastKeyFromClone(key));
}

/**
 * Checks if key1 is a clone of key2
 * @param key1
 * @param key2
 */
export function isClonedKeyOf(key1: string, key2: string): boolean {
  return isClonedKey(key1) && getOriginalKey(key1) === getOriginalKey(key2);
}

/**
 * Checks if the key or any of its ancestors are cloned
 * @param key
 */
export function isInCloneChain(key: string): boolean {
  return key.split(CLONE_SEPARATOR).some(isClonedKey);
}

/**
 * Get the last key from a clone key
 * @param key
 */
export function getLastKeyFromClone(key: string): string {
  return key.split(CLONE_SEPARATOR).pop() ?? '';
}

/**
 * Join clone keys
 * @param keys
 */
export function joinCloneKeys(...keys: string[]): string {
  return keys.filter(Boolean).join(CLONE_SEPARATOR);
}

/**
 * Checks if a key contains the '-clone-' string
 * @param key
 */
export function containsCloneKey(key: string): boolean {
  return key.includes(CLONE_KEY);
}
