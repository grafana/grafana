const CLONE_KEY = '-clone-';
const CLONE_SEPARATOR = '|';

const REPLACE_REGEX = new RegExp(`(.+?)(?:${CLONE_KEY}\\d+)?$`);
const ORIGINAL_REGEX = new RegExp(`(?:.*\\|)?(.+?)(?:${CLONE_KEY}\\d+)?$`);
const CLONED_KEY_REGEX = new RegExp(`${CLONE_KEY}(?!0\\b)\\d+$`);
const CLONE_CHAIN_REGEX = new RegExp(`(?:\\b${CLONE_KEY}(?!0\\b)\\d+\\b.*)+`);
const LAST_SEGMENT_REGEX = new RegExp('(?:.*\\|)?(.+?)?$');
const CONTAINS_CLONE_KEY_REGEX = new RegExp(`.*${CLONE_KEY}\\d+.*`);

/**
 * Create or alter the last key for a key
 * @param key
 * @param index
 */
export function getCloneKey(key: string, index: number): string {
  return key.replace(REPLACE_REGEX, `$1${CLONE_KEY}${index}`);
}

/**
 * Get the original key from a clone key
 * @param key
 */
export function getOriginalKey(key: string): string {
  return key.replace(ORIGINAL_REGEX, '$1');
}

/**
 * Checks if the last key is a clone key
 * @param key
 */
export function isClonedKey(key: string): boolean {
  return CLONED_KEY_REGEX.test(key);
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
  return CLONE_CHAIN_REGEX.test(key);
}

/**
 * Get the last key from a clone key
 * @param key
 */
export function getLastKeyFromClone(key: string): string {
  return key.replace(LAST_SEGMENT_REGEX, '$1');
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
  return CONTAINS_CLONE_KEY_REGEX.test(key);
}
