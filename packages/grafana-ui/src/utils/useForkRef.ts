import * as React from 'react';
import { MutableRefOrFunction, setRef } from './setRef';

/**
 * @internal
 */
export function useForkRef<T>(refA: MutableRefOrFunction<T>, refB: MutableRefOrFunction<T>) {
  /**
   * This will create a new function if the ref props change and are defined.
   * This means react will call the old forkRef with `null` and the new forkRef
   * with the ref. Cleanup naturally emerges from this behavior.
   */
  return React.useMemo(() => {
    if (refA == null && refB == null) {
      return null;
    }
    return (refValue: T) => {
      setRef(refA, refValue);
      setRef(refB, refValue);
    };
  }, [refA, refB]);
}
