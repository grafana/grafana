import { customAlphabet } from 'nanoid';

// Lowercase alphanumerics only, so a minted name stays a valid, readable key.
const randomSuffix = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 6);

/**
 * `<base>-<random>`, retried on the (vanishingly unlikely) clash with a name already in use, so a
 * collision can never merge two cells into one `elements` entry.
 *
 * Element names are the key a cell is addressed by, including by comments anchored to it. A name
 * minted from a counter is reissued once its cell is deleted, which would silently attach the old
 * cell's comments to whatever takes the name next. A random suffix makes a name effectively
 * never-reused without a spec field to track retired ones.
 */
export function mintElementName(
  base: string,
  isTaken: (name: string) => boolean,
  suffix: () => string = randomSuffix
): string {
  let candidate = `${base}-${suffix()}`;
  while (isTaken(candidate)) {
    candidate = `${base}-${suffix()}`;
  }

  return candidate;
}
