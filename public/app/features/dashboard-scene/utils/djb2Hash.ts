/**
 * Hashes a string using the DJB2 algorithm.
 */
export function djb2Hash(str: string): number {
  let hash = 5381;

  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }

  return hash >>> 0; // Ensure the result is an unsigned 32-bit integer
}
