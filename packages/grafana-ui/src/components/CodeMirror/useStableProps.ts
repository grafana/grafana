import { useCallback, useInsertionEffect, useRef } from 'react';

import { shallowCompare } from '@grafana/data';

function isShallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }

  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }

  // An array must not compare equal to an object with matching indices.
  if (Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }

  return shallowCompare(a, b);
}

/**
 * Returns the previous reference whenever `value` is shallow-equal to it.
 *
 * A new `extensions` or `basicSetup` identity makes `@uiw/react-codemirror`
 * reconfigure the whole editor, discarding extension state such as an open
 * completion popup. Call sites pass inline literals, so identity alone is too
 * eager a signal.
 */
export function useShallowStable<T>(value: T): T {
  const stable = useRef(value);

  // Safe during render: a repeated render derives the same reference.
  if (!isShallowEqual(stable.current, value)) {
    stable.current = value;
  }

  return stable.current;
}

/**
 * Wraps `callback` in a reference that never changes but always invokes the
 * latest version.
 *
 * `onChange` reconfigures the editor too (see {@link useShallowStable}), and a
 * controlled editor re-renders its parent on every keystroke.
 */
export function useStableCallback<Args extends unknown[], Return>(
  callback: (...args: Args) => Return
): (...args: Args) => Return {
  const latest = useRef(callback);

  // Runs only for a committed render, and still before any layout effect or
  // event handler can read the ref.
  useInsertionEffect(() => {
    latest.current = callback;
  }, [callback]);

  return useCallback((...args: Args) => latest.current(...args), []);
}
