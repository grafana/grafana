/**
 * Collects cleanup functions so journey wiring doesn't need
 * manual unsub1/unsub2/unsub3 bookkeeping.
 */
export function collectUnsubs() {
  const unsubs: Array<() => void> = [];
  return {
    add: (unsub: () => void) => {
      unsubs.push(unsub);
    },
    cleanup: () => unsubs.forEach((fn) => fn()),
  };
}

/**
 * Coerces an interaction property to a string attribute.
 *
 * Whitelisted: string, number (finite), bigint, boolean. Nullish becomes ''
 * so we don't emit literal 'undefined' / 'null'. Everything else (objects,
 * arrays, functions, symbols, NaN, Infinity) becomes '' to prevent
 * '[object Object]' or 'NaN' from leaking into Tempo span attributes; in
 * dev a warning fires once per offending type so the caller fixes the
 * upstream `reportInteraction` payload instead of the str() call site.
 */
export function str(value: unknown): string {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (typeof value === 'number') {
    if (Number.isFinite(value)) {
      return String(value);
    }
    warnUnsupported(`number:${value}`);
    return '';
  }
  warnUnsupported(typeof value);
  return '';
}

const warnedTypes = new Set<string>();
function warnUnsupported(kind: string): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }
  if (warnedTypes.has(kind)) {
    return;
  }
  warnedTypes.add(kind);
  console.warn(
    `[CUJ] str() received unsupported value of type "${kind}"; coerced to ''. ` +
      `Pass primitives (string/number/boolean) to reportInteraction so journey attributes stay queryable in Tempo.`
  );
}
