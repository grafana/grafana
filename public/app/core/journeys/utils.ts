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
