/**
 * Collects cleanup functions so journey wiring doesn't need
 * manual unsub1/unsub2/unsub3 bookkeeping.
 */
export function collectUnsubs() {
  const unsubs: Array<() => void> = [];
  return {
    add: (unsub: () => void) => { unsubs.push(unsub); },
    cleanup: () => unsubs.forEach((fn) => fn()),
  };
}

/**
 * Coerces an interaction property to a string attribute. Nullish values become ''
 * so we don't emit the literal strings 'undefined' / 'null' as span attributes.
 */
export function str(value: unknown): string {
  return value == null ? '' : String(value);
}
